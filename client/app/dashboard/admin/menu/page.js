'use client';
import {
  UtensilsCrossed, Search, Plus, Filter,
  Edit2, Trash2, CheckCircle2, XCircle,
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package, Save, X,
  FileText, List, ChevronDown, ChevronUp, Minus,
  Zap
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

export default function MenuManagementPage() {
  const { selectedLocation, user } = useAuth();
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'categories'
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('All'); // 'All', 'Available', 'Unavailable'

  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  // Recipe state
  const [showRecipeEditor, setShowRecipeEditor] = useState(false);
  const [recipeData, setRecipeData] = useState({
    ingredients: [{ name: '', quantity: '', unit: 'grams' }],
    instructions: [{ step: 1, text: '' }],
    notes: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Form refs
  const itemFileRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedLocation) params.locationId = selectedLocation._id || selectedLocation;

      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu', { params }),
        api.get('/categories')
      ]);
      setMenuItems(itemsRes.data.data);
      setCategories(catsRes.data.data);
    } catch (error) {
      toast.error('Failed to sync menu matrix');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedLocation]);

  const fetchRecipe = async (menuItemId) => {
    try {
      const res = await api.get(`/recipes/${menuItemId}`);
      setRecipeData(res.data.data);
    } catch (error) {
      setRecipeData({
        ingredients: [{ name: '', quantity: '', unit: 'grams' }],
        instructions: [{ step: 1, text: '' }],
        notes: ''
      });
    }
  };

  // Category CRUD
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    const loadToast = toast.loading(editingCategory ? 'Updating sector...' : 'Initializing sector...');
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory._id}`, data);
        toast.success('Sector synchronized', { id: loadToast });
      } else {
        await api.post('/categories', data);
        toast.success('New sector established', { id: loadToast });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    }
  };

  const deleteCategory = async (id) => {
    if (!confirm('Deactivate this sector? All linked nodes will be orphaned.')) return;
    const loadToast = toast.loading('Deactivating sector...');
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Sector offline', { id: loadToast });
      fetchData();
    } catch (error) {
      toast.error('Deactivation failed', { id: loadToast });
    }
  };

  // MenuItem CRUD
  const handleItemSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    if (selectedLocation && !formData.has('locationId')) {
      formData.append('locationId', selectedLocation._id || selectedLocation);
    }

    // Validation: discountedPrice < originalPrice
    const originalPrice = formData.get('originalPrice') ? parseFloat(formData.get('originalPrice')) : null;
    const discPrice = formData.get('discountedPrice') ? parseFloat(formData.get('discountedPrice')) : null;

    if (originalPrice && discPrice && discPrice >= originalPrice) {
      return toast.error('Fiscal logic error: Discounted price must be below original price');
    }

    const loadToast = toast.loading(editingItem ? 'Updating node...' : 'Deploying node...');
    try {
      let itemId;
      if (editingItem) {
        const res = await api.put(`/menu/${editingItem._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        itemId = res.data.data._id;
        toast.success('Node synchronized', { id: loadToast });
      } else {
        const res = await api.post('/menu', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        itemId = res.data.data._id;
        toast.success('New node operational', { id: loadToast });
      }

      // Handle Recipe Upsert if visible
      if (showRecipeEditor) {
        await api.post('/recipes', {
          menuItemId: itemId,
          ...recipeData
        });
        toast.success('Recipe matrix synced');
      }

      setShowItemModal(false);
      setEditingItem(null);
      setImagePreview(null);
      setShowRecipeEditor(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Deployment failure', { id: loadToast });
    }
  };

  const toggleAvailability = async (id) => {
    try {
      await api.put(`/menu/${id}/availability`);
      setMenuItems(items => items.map(item =>
        item._id === id ? { ...item, isAvailable: !item.isAvailable } : item
      ));
      toast.success('Matrix state toggled');
    } catch (error) {
      toast.error('Toggle failed');
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('Erase this menu node permanently?')) return;
    const loadToast = toast.loading('Erasing node...');
    try {
      await api.delete(`/menu/${id}`);
      toast.success('Node erased', { id: loadToast });
      fetchData();
    } catch (error) {
      toast.error('Erasure failed', { id: loadToast });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Recipe Editor Handlers
  const addIngredient = () => {
    setRecipeData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', quantity: '', unit: 'grams' }]
    }));
  };

  const updateIngredient = (index, field, value) => {
    const newIngredients = [...recipeData.ingredients];
    newIngredients[index][field] = value;
    setRecipeData(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const removeIngredient = (index) => {
    setRecipeData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const addInstruction = () => {
    setRecipeData(prev => ({
      ...prev,
      instructions: [...prev.instructions, { step: prev.instructions.length + 1, text: '' }]
    }));
  };

  const updateInstruction = (index, value) => {
    const newInstructions = [...recipeData.instructions];
    newInstructions[index].text = value;
    setRecipeData(prev => ({ ...prev, instructions: newInstructions }));
  };

  const removeInstruction = (index) => {
    setRecipeData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index).map((ins, i) => ({ ...ins, step: i + 1 }))
    }));
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category?.name === selectedCategory;

    const price = item.discountedPrice || item.price;
    const matchesMinPrice = minPrice === '' || price >= parseFloat(minPrice);
    const matchesMaxPrice = maxPrice === '' || price <= parseFloat(maxPrice);

    const matchesAvailability =
      availabilityFilter === 'All' ||
      (availabilityFilter === 'Available' && item.isAvailable) ||
      (availabilityFilter === 'Unavailable' && !item.isAvailable);

    return matchesSearch && matchesCat && matchesMinPrice && matchesMaxPrice && matchesAvailability;
  });

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAvailability =
      availabilityFilter === 'All' ||
      (availabilityFilter === 'Available' && cat.isActive) ||
      (availabilityFilter === 'Unavailable' && !cat.isActive);

    const matchesCat = selectedCategory === 'All' || cat.name === selectedCategory;

    // Price filter for categories: show category if any item within it matches price range
    // Or if no items exist in category and no price filter is active
    const isPriceFilterActive = minPrice !== '' || maxPrice !== '';
    const itemsInCat = menuItems.filter(item => (item.category?._id || item.category) === cat._id);
    const matchesPrice = itemsInCat.some(item => {
      const price = item.discountedPrice || item.price;
      return (minPrice === '' || price >= parseFloat(minPrice)) &&
        (maxPrice === '' || price <= parseFloat(maxPrice));
    });

    return matchesSearch && matchesAvailability && matchesCat && (!isPriceFilterActive || matchesPrice);
  });

  if (loading && menuItems.length === 0) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4">
              <UtensilsCrossed className="text-amber-600" size={36} strokeWidth={2.5} />
              Menu <span className="text-amber-600">Hub</span>
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Manage culinary nodes, logical sectors, and recipes.</p>
          </div>
          <div className="flex gap-3 bg-muted/30 p-1.5 rounded-2xl border border-border">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'items' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Package size={16} /> Inventory
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'categories' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Layers size={16} /> Sectors
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <SlideIn direction="down">
          <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <input
                  type="text"
                  placeholder={activeTab === 'items' ? "Search inventory nodes..." : "Search logical sectors..."}
                  className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <Button
                  variant="outline"
                  icon={Filter}
                  onClick={() => setShowFilters(!showFilters)}
                  className={`!py-4 px-6 rounded-2xl border-2 transition-all ${showFilters ? 'bg-amber-600 border-amber-600 text-white' : ''}`}
                >
                  Filters
                </Button>
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => activeTab === 'items' ? setShowItemModal(true) : setShowCategoryModal(true)}
                  className="!py-4 px-8 rounded-2xl flex-1 md:flex-none"
                >
                  Create {activeTab === 'items' ? 'Node' : 'Sector'}
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-border">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {activeTab === 'items' ? 'Inventory Filter' : 'Sector Filter'}
                      </label>
                      <select
                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none appearance-none font-bold text-sm"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="All">All {activeTab === 'items' ? 'Inventory' : 'Sectors'}</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Availability</label>
                      <select
                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none appearance-none font-bold text-sm"
                        value={availabilityFilter}
                        onChange={(e) => setAvailabilityFilter(e.target.value)}
                      >
                        <option value="All">All Status</option>
                        <option value="Available">Online Only</option>
                        <option value="Unavailable">Offline Only</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {activeTab === 'items' ? 'Price Floor' : 'Min Range'}
                      </label>
                      <input
                        type="number"
                        placeholder="Min ₹"
                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        {activeTab === 'items' ? 'Price Ceiling' : 'Max Range'}
                      </label>
                      <input
                        type="number"
                        placeholder="Max ₹"
                        className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SlideIn>

        {activeTab === 'items' ? (
          /* Menu Items Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredItems.map((item, i) => (
                <SlideIn key={item._id} delay={i * 0.05}>
                  <CardHover>
                    <div className={`group bg-card rounded-[2.5rem] overflow-hidden border border-border relative flex flex-col h-full transition-all duration-300 ${!item.isAvailable && 'opacity-60 grayscale'}`}>
                      {/* Image Hub */}
                      <div className="h-52 relative overflow-hidden bg-muted">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon size={48} strokeWidth={1} />
                          </div>
                        )}
                        <div className="absolute top-4 left-4">
                          <span className="px-3 py-1 bg-background/80 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-border">
                            {item.category?.name || 'Unsorted'}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleAvailability(item._id)}
                          className={`absolute top-4 right-4 p-2 rounded-xl backdrop-blur-md border transition-all ${item.isAvailable ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}
                        >
                          {item.isAvailable ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        </button>

                        {item.discountedPrice && (
                          <div className="absolute bottom-4 left-4">
                            <span className="px-3 py-1 bg-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/30">
                              Offer Node
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content Hub */}
                      <div className="p-6 md:p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-black tracking-tight line-clamp-1">{item.name}</h3>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-amber-600 flex items-center">
                              <IndianRupee size={16} />{item.discountedPrice || item.price}
                            </span>
                            {item.discountedPrice && (
                              <span className="text-[10px] text-muted-foreground line-through font-bold">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 font-medium mb-6 leading-relaxed">
                          {item.description || 'No descriptive data available for this node.'}
                        </p>

                        <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
                          <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                            <Clock size={14} className="text-amber-600" />
                            {item.preparationTime} Min Sync
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                                setImagePreview(item.image);
                                fetchRecipe(item._id);
                              }}
                              className="p-3 rounded-xl bg-muted hover:bg-amber-600 text-muted-foreground hover:text-white transition-all shadow-sm"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteItem(item._id)}
                              className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all shadow-sm"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHover>
                </SlideIn>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Categories Management */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((cat, i) => (
              <SlideIn key={cat._id} delay={i * 0.05}>
                <Card className="!p-8 group relative overflow-hidden border border-border hover:border-amber-600/30 transition-all">
                  <div className="absolute top-0 right-0 p-8 text-amber-600 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Layers size={80} />
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-amber-600/10 border border-amber-600/20 flex items-center justify-center text-2xl">
                      {cat.icon || '🍽️'}
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{cat.name}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order: {cat.sortOrder}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground font-medium mb-8 min-h-[40px]">{cat.description || 'Logical sector for organizing culinary nodes.'}</p>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${cat.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {cat.isActive ? 'Active' : 'Offline'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                        className="p-2.5 rounded-xl bg-muted hover:bg-amber-600 text-muted-foreground hover:text-white transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat._id)}
                        className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              </SlideIn>
            ))}
          </div>
        )}

        {/* Item Modal */}
        <Modal
          isOpen={showItemModal}
          onClose={() => { setShowItemModal(false); setEditingItem(null); setImagePreview(null); setShowRecipeEditor(false); }}
          title={editingItem ? "Reconfigure Node" : "Deploy Menu Node"}
          className="max-w-4xl"
        >
          <form onSubmit={handleItemSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Designation</label>
                  <input name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" placeholder="e.g. Arabica Cold Brew" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Sector</label>
                    <select name="category" defaultValue={editingItem?.category?._id} required className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold appearance-none">
                      {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Sync Time (Min)</label>
                    <input name="preparationTime" type="number" defaultValue={editingItem?.preparationTime || 10} required className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Current Price (₹)</label>
                    <input name="price" type="number" defaultValue={editingItem?.price} required className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                  </div>
                  {(user?.role === 'admin' || user?.role === 'location_admin' || user?.role === 'super_admin') && (
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1.5 block ml-1">Cost Price (₹)</label>
                      <input name="costPrice" type="number" defaultValue={editingItem?.costPrice || 0} required className="w-full px-4 py-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-900 dark:text-amber-100" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Original Price (₹)</label>
                    <input name="originalPrice" type="number" defaultValue={editingItem?.originalPrice} className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Offer Price (₹)</label>
                    <input name="discountedPrice" type="number" defaultValue={editingItem?.discountedPrice} className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Contextual Description</label>
                  <textarea name="description" defaultValue={editingItem?.description} rows="3" className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none" placeholder="Enter node specifications..."></textarea>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Imagery Core</label>
                  <div
                    onClick={() => itemFileRef.current.click()}
                    className="aspect-[4/3] rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-amber-600/5 hover:border-amber-600/30 transition-all overflow-hidden relative group"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-black uppercase tracking-widest gap-2">
                          <ImageIcon size={20} /> Replace Imagery
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-16 w-16 rounded-3xl bg-muted flex items-center justify-center mb-4 text-muted-foreground group-hover:scale-110 transition-transform">
                          <ImageIcon size={32} />
                        </div>
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Upload Frame Scan</span>
                        <p className="text-[8px] text-muted-foreground/50 mt-1 uppercase">JPG, PNG or WEBP (Max 5MB)</p>
                      </>
                    )}
                  </div>
                  <input type="file" name="image" ref={itemFileRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                </div>

                <div className="p-6 bg-muted/30 rounded-3xl border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="text-amber-600" size={18} />
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Recipe Matrix</p>
                        <p className="text-[8px] text-muted-foreground uppercase">Ingredients & Protocols</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRecipeEditor(!showRecipeEditor)}
                      className={`p-2 rounded-xl border transition-all ${showRecipeEditor ? 'bg-amber-600 border-amber-600 text-white' : 'bg-background border-border text-muted-foreground'}`}
                    >
                      {showRecipeEditor ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showRecipeEditor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-8 pt-8 border-t border-border"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                          <List size={14} /> Ingredient Registry
                        </h4>
                        <button type="button" onClick={addIngredient} className="text-[9px] font-black uppercase text-amber-600 hover:underline">+ Append Asset</button>
                      </div>
                      <div className="space-y-4">
                        {recipeData.ingredients.map((ing, idx) => (
                          <div key={idx} className="flex gap-3 items-end">
                            <div className="flex-[2]">
                              <input
                                placeholder="Ingredient"
                                value={ing.name}
                                onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                                className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border text-xs font-bold"
                              />
                            </div>
                            <div className="flex-1">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={ing.quantity}
                                onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                                className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border text-xs font-bold text-center"
                              />
                            </div>
                            <div className="flex-1">
                              <select
                                value={ing.unit}
                                onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                                className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border text-[10px] font-black uppercase appearance-none text-center"
                              >
                                <option value="grams">Grams</option>
                                <option value="ml">ML</option>
                                <option value="pcs">Pcs</option>
                                <option value="tsp">TSP</option>
                              </select>
                            </div>
                            <button type="button" onClick={() => removeIngredient(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                              <Minus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                          <Zap size={14} /> Preparation Protocols
                        </h4>
                        <button type="button" onClick={addInstruction} className="text-[9px] font-black uppercase text-amber-600 hover:underline">+ Append Step</button>
                      </div>
                      <div className="space-y-4">
                        {recipeData.instructions.map((ins, idx) => (
                          <div key={idx} className="flex gap-4">
                            <div className="h-8 w-8 rounded-full bg-amber-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-1">
                              {ins.step}
                            </div>
                            <textarea
                              placeholder="Describe protocol step..."
                              value={ins.text}
                              onChange={(e) => updateInstruction(idx, e.target.value)}
                              rows="2"
                              className="w-full px-4 py-3 bg-muted/50 rounded-xl border border-border text-xs font-bold resize-none"
                            ></textarea>
                            <button type="button" onClick={() => removeInstruction(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all h-fit">
                              <Minus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Technical Notes</label>
                    <textarea
                      value={recipeData.notes}
                      onChange={(e) => setRecipeData(prev => ({ ...prev, notes: e.target.value }))}
                      rows="2"
                      className="w-full px-4 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none"
                      placeholder="Enter additional culinary details..."
                    ></textarea>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" variant="primary" icon={Save} className="w-full py-5 !rounded-3xl shadow-2xl shadow-amber-600/20">
              Synchronize Node Data
            </Button>
          </form>
        </Modal>

        {/* Category Modal (Simplified) */}
        <Modal
          isOpen={showCategoryModal}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
          title={editingCategory ? "Update Sector" : "Establish Sector"}
        >
          <form onSubmit={handleCategorySubmit} className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Sector Designation</label>
                <input name="name" defaultValue={editingCategory?.name} required className="w-full px-5 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" placeholder="e.g. Beverages" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Icon Core</label>
                <input name="icon" defaultValue={editingCategory?.icon || '🍽️'} required className="w-full px-5 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center text-2xl" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Categorical Scope</label>
              <textarea name="description" defaultValue={editingCategory?.description} rows="3" className="w-full px-5 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none" placeholder="Define the sector parameters..."></textarea>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block ml-1">Hierarchy Index</label>
                <input name="sortOrder" type="number" defaultValue={editingCategory?.sortOrder || 0} required className="w-full px-5 py-4 bg-muted/50 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-4 cursor-pointer select-none group">
                  <div className="relative">
                    <input type="checkbox" name="isActive" defaultChecked={editingCategory ? editingCategory.isActive : true} className="peer hidden" />
                    <div className="w-12 h-6 bg-muted rounded-full peer-checked:bg-amber-600 transition-colors"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-amber-600 transition-colors">Operational</span>
                </label>
              </div>
            </div>

            <Button type="submit" variant="primary" icon={Save} className="w-full py-5 !rounded-3xl shadow-2xl shadow-amber-600/20">
              Initialize Sector Node
            </Button>
          </form>
        </Modal>

        {(filteredItems.length === 0 && activeTab === 'items' && !loading) || (filteredCategories.length === 0 && activeTab === 'categories' && !loading) ? (
          <div className="text-center py-32 bg-amber-600/[0.02] rounded-[4rem] border border-dashed border-amber-600/20 col-span-full w-full">
            <UtensilsCrossed size={64} className="mx-auto text-amber-600/10 mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">No {activeTab === 'items' ? 'Culinary Nodes' : 'Logical Sectors'} Detected</h3>
            <p className="text-muted-foreground font-medium mt-2 max-w-sm mx-auto">The {activeTab === 'items' ? 'menu' : 'sector'} matrix is currently empty for the selected filters. Establish a new {activeTab === 'items' ? 'node' : 'sector'} to begin.</p>
            <Button variant="outline" className="mt-8 px-10 rounded-2xl" icon={Plus} onClick={() => activeTab === 'items' ? setShowItemModal(true) : setShowCategoryModal(true)}>Establish {activeTab === 'items' ? 'Node' : 'Sector'}</Button>
          </div>
        ) : null}
      </div>
    </PageTransition>
  );
}
