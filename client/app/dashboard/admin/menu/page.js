'use client';
import {
  UtensilsCrossed, Search, Plus, Filter,
  Edit2, Trash2, CheckCircle2, XCircle,
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package, Save, X,
  FileText, List, ChevronDown, ChevronUp, Minus,
  Zap,
  Users,
  MapPin,
  TrendingDown,
  TrendingUp,
  Utensils,
  Target,
  Leaf,
  Drumstick,
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import ExportActions from '../../../components/ui/ExportActions';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const SUGGESTED_ICONS = [
  '🍽️', '🍕', '🍔', '🍟', '🌭', '🍿', '🥗', '🍝', '🍜', '🍲', '🍣', '🍱', '🍛', '🍚', '🥯', '🥞', '🥓', '🍳', '🍞', '🥐', 
  '🍰', '🍦', '🍩', '🍪', '🍫', '☕', '🍵', '🧃', '🥤', '🍺', '🍸', '🍹', '🍷', '🥂', '🍗', '🥩', '🐟', '🍤', '🌮', '🌯'
];

export default function MenuManagementPage() {
  const router = useRouter();
  const { selectedLocation, user } = useAuth();
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'categories'
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [graphMetric, setGraphMetric] = useState('value'); // 'value' (revenue) or 'count' (volume)

  // Analytics states
  const [locations, setLocations] = useState([]);
  const [filterLocation, setFilterLocation] = useState('all');
  const [timeFilter, setTimeFilter] = useState('7d');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [isLocSelectorOpen, setIsLocSelectorOpen] = useState(false);

  const [analytics, setAnalytics] = useState({
      summary: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, netProfit: 0, totalExpenses: 0 },
      timeSeries: [],
      categorySales: [],
      staffPerformance: []
    });


      const fetchLocations = async () => {
        try {
          const res = await api.get('/locations');
          setLocations(res.data.data);
        } catch (error) {
          console.error("Failed to fetch locations");
        }
      };

      const fetchAnalytics = async () => {
        try {
          const locId = filterLocation === 'all' ? '' : filterLocation;
          let query = `?locationId=${locId}`;
    
          const now = new Date();
          let start = '';
          if (timeFilter === '7d') {
            const d = new Date();
            d.setDate(now.getDate() - 7);
            start = d.toISOString().split('T')[0];
          } else if (timeFilter === '30d') {
            const d = new Date();
            d.setDate(now.getDate() - 30);
            start = d.toISOString().split('T')[0];
          } else if (timeFilter === 'custom' && customDates.start) {
            start = customDates.start;
            if (customDates.end) query += `&endDate=${customDates.end}`;
          }
    
          if (start) query += `&startDate=${start}`;
    
          const res = await api.get(`/analytics/advanced${query}`);
          if (res.data.success) {
            setAnalytics(res.data.data);
          }
        } catch (error) {
          console.error("Analytics sync error:", error);
        }
      };
    
      useEffect(() => {
        fetchLocations();
      }, []);
    
      useEffect(() => {
        fetchAnalytics();
      }, [filterLocation, timeFilter, customDates]);

      useEffect(() => {
        if (selectedLocation) {
          setFilterLocation(selectedLocation._id || selectedLocation);
        }
      }, [selectedLocation]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('All'); // 'All', 'Available', 'Unavailable'
  const [dietaryFilter, setDietaryFilter] = useState('All'); // 'All', 'veg', 'non-veg'

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
  const [categoryIcon, setCategoryIcon] = useState('🍽️');

  useEffect(() => {
    if (editingCategory) {
      setCategoryIcon(editingCategory.icon || '🍽️');
    } else {
      setCategoryIcon('🍽️');
    }
  }, [editingCategory]);

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
    data.isActive = formData.get('isActive') === 'on';

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

    const isGlobal = formData.get('isGlobal') === 'on';
    if (isGlobal) {
      formData.set('locationId', ''); 
    } else if (selectedLocation && !formData.has('locationId')) {
      formData.append('locationId', selectedLocation._id || selectedLocation);
    }

    // Validation: discountedPrice < originalPrice
    const originalPrice = formData.get('originalPrice') ? parseFloat(formData.get('originalPrice')) : null;
    const discPrice = formData.get('discountedPrice') ? parseFloat(formData.get('discountedPrice')) : null;

    if (originalPrice && discPrice && discPrice >= originalPrice) {
      return toast.error(`Pricing logic error: Offer Price (₹${discPrice}) cannot be higher than the Original Price (₹${originalPrice})`);
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

    const matchesDietary = dietaryFilter === 'All' || item.dietaryType === dietaryFilter;

    return matchesSearch && matchesCat && matchesMinPrice && matchesMaxPrice && matchesAvailability && matchesDietary;
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
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
              <Utensils className="mr-4 text-amber-600" size={36} strokeWidth={2.5} /> Menu <span className="ml-3 text-amber-600">Management</span>
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mt-3 font-medium flex items-center">
              <Target size={14} className="mr-2 text-amber-600" /> Manage food items and categories for your branches.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 bg-muted/30 p-1.5 rounded-2xl border border-border">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'items' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Package size={16} /> Items
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'categories' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Layers size={16} /> Categories
            </button>
          </div>
        </div>

        {/* Analytics Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Location Selector */}
            <div className="relative">
              <button
                onClick={() => setIsLocSelectorOpen(!isLocSelectorOpen)}
                className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-amber-500/50 transition-all min-w-[140px] sm:min-w-[180px]"
              >
                <MapPin size={16} className="text-amber-500" />
                <div className="flex flex-col items-start">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Branch</span>
                  <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                    {filterLocation === 'all' ? 'All Branches' : locations.find(l => l._id === filterLocation)?.name}
                  </span>
                </div>
                <ChevronDown size={14} className={`ml-auto transition-transform ${isLocSelectorOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isLocSelectorOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-3 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl z-50 p-3 max-h-[300px] overflow-y-auto custom-scrollbar"
                  >
                    <button
                      onClick={() => { setFilterLocation('all'); setIsLocSelectorOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl mb-1 text-xs font-bold transition-colors ${filterLocation === 'all' ? 'bg-amber-500/10 text-amber-500' : 'hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-500'}`}
                    >
                      All Branches
                    </button>
                    {locations.map(loc => (
                      <button
                        key={loc._id}
                        onClick={() => { setFilterLocation(loc._id); setIsLocSelectorOpen(false); }}
                        className={`w-full text-left p-3 rounded-xl mb-1 text-xs font-bold transition-colors ${filterLocation === loc._id ? 'bg-amber-500/10 text-amber-500' : 'hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-500'}`}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-3 bg-white/40 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md overflow-x-auto no-scrollbar max-w-full">
              {['7d', '30d', 'all', 'custom'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${timeFilter === t ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {timeFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 p-6 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm"
          >
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 ml-1">Start Date</label>
              <input type="date" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 ml-1">End Date</label>
              <input type="date" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
            </div>
          </motion.div>
        )}

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="!p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
            <div className="flex items-center justify-between mb-8">
              <CardTitle className="text-lg">Popular Categories</CardTitle>
              <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-inner">
                <button 
                  onClick={() => setGraphMetric('value')}
                  className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all ${graphMetric === 'value' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                  Revenue
                </button>
                <button 
                  onClick={() => setGraphMetric('count')}
                  className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-md transition-all ${graphMetric === 'count' ? 'bg-amber-500 text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                  Volume
                </button>
              </div>
            </div>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.categorySales}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={10}
                    dataKey={graphMetric}
                  >
                    {analytics?.categorySales?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    itemStyle={{ color: '#f59e0b', fontSize: '12px', fontWeight: '900' }}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-zinc-900 dark:text-white">
                  {graphMetric === 'value' ? `₹${analytics?.summary?.totalRevenue?.toLocaleString()}` : analytics?.summary?.totalOrders}
                </span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                  {graphMetric === 'value' ? 'Gross Yield' : 'Total Orders'}
                </span>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {analytics?.categorySales?.slice(0, 4).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-300">{cat.name}</span>
                  </div>
                  <span className="text-xs font-black text-zinc-900 dark:text-white">
                    {graphMetric === 'value' ? `₹${cat.value.toLocaleString()}` : `${cat.count} Units`}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Crew Spotlight */}
          <Card className="lg:col-span-2 !p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50 overflow-hidden relative" hover={false}>
            <div className="absolute -right-20 -top-20 h-64 w-64 bg-amber-500/5 rounded-full blur-3xl" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <CardTitle className="text-lg">Branch Momentum</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Live operational performance</CardDescription>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Users size={18} />
              </div>
            </div>

            <div className="relative z-10">
              {analytics?.staffPerformance?.length === 1 ? (
                /* Solo Hero View */
                <div className="flex flex-col items-center justify-center py-10 text-center bg-amber-500/[0.02] rounded-[2rem] border border-dashed border-amber-500/20">
                  <div className="h-24 w-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
                    <Zap size={40} className="text-amber-500 animate-pulse" />
                  </div>
                  <h4 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter max-w-md">
                    <span className="text-amber-500">{analytics.staffPerformance[0].name}</span> is single-handedly driving the floor
                  </h4>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2">Solo Operation Mastery</p>
                  
                  <div className="flex gap-12 mt-10">
                    <div className="text-center">
                      <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{analytics.staffPerformance[0].totalOrders}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-1">Orders Synced</p>
                    </div>
                    <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800" />
                    <div className="text-center">
                      <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">₹{analytics.staffPerformance[0].revenue.toLocaleString()}</p>
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-1">Matrix Yield</p>
                    </div>
                  </div>
                </div>
              ) : analytics?.staffPerformance?.length > 1 ? (
                /* Team Mosaic View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics?.staffPerformance?.slice(0, 4).map((staff, idx) => (
                    <div key={idx} className="group p-5 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 hover:border-amber-500/30 transition-all duration-500">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-10 w-10 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-black text-amber-500 text-xs shadow-sm">
                          {staff.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{staff.name}</span>
                            <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase">Rank #{idx + 1}</span>
                          </div>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{staff.totalOrders} Orders Handled</p>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Efficiency Matrix</span>
                          <span className="text-xs font-black text-zinc-900 dark:text-white">₹{staff.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(staff.revenue / (analytics?.staffPerformance[0]?.revenue || 1)) * 100}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                  <Users size={32} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Active Personnel Data</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Control Center */}
        <SlideIn direction="down">
          <div className="bg-card p-6 md:p-10 rounded-[3rem] border border-border shadow-sm space-y-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder={activeTab === 'items' ? "Search culinary inventory..." : "Search sector categories..."}
                  className="w-full pl-14 pr-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none font-bold text-sm shadow-inner transition-all" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
                  <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-4 w-fit">
                    {[
                      { id: 'All', label: 'All Items' },
                      { id: 'veg', label: 'Veg Only', color: 'text-green-500' },
                      { id: 'non-veg', label: 'Non-Veg', color: 'text-red-500' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setDietaryFilter(f.id)}
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          dietaryFilter === f.id 
                            ? 'bg-amber-500 text-black shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                        } ${f.color || ''}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-3 h-14 px-6 rounded-2xl border transition-all font-black text-xs uppercase tracking-widest ${showFilters ? 'bg-amber-500 border-amber-600 text-black shadow-lg shadow-amber-500/30' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-amber-500/30'}`}
                >
                  <Filter size={18} />
                  Filters
                </button>

                <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />
                <div className="flex items-center gap-3 flex-1 sm:flex-none">
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (activeTab === 'items') {
                        setEditingItem(null);
                        setImagePreview(null);
                        setShowItemModal(true);
                      } else {
                        setEditingCategory(null);
                        setShowCategoryModal(true);
                      }
                    }}
                    className="flex-1 sm:flex-none h-14 px-8 rounded-2xl bg-amber-500 text-black border-none hover:bg-amber-600 transition-all gap-3"
                  >
                    <Plus size={20} strokeWidth={3} />
                    <span className="font-black text-xs uppercase tracking-widest">Add New</span>
                  </Button>

                  <ExportActions 
                    data={activeTab === 'items' ? filteredItems : filteredCategories} 
                    columns={activeTab === 'items' ? [
                      { header: 'Name', key: 'name' },
                      { header: 'Category', key: item => item.category?.name || 'Uncategorized' },
                      { header: 'Price', key: 'price' },
                      { header: 'Sale Price', key: 'discountedPrice' },
                      { header: 'Available', key: item => item.isAvailable ? 'Yes' : 'No' }
                    ] : [
                      { header: 'Name', key: 'name' },
                      { header: 'Order', key: 'sortOrder' },
                      { header: 'Status', key: item => item.isActive ? 'Active' : 'Inactive' }
                    ]}
                    filename={activeTab === 'items' ? 'inventory' : 'categories'}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard/admin/expenses')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
              >
                <TrendingDown size={14} /> Expenses
              </button>
              <button
                onClick={() => router.push('/dashboard/admin/revenue')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
              >
                <TrendingUp size={14} /> Income
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-8 mt-6 bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Category</label>
                        <select
                          className="w-full px-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-sm shadow-sm transition-all"
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                          <option value="All">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat._id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Status</label>
                        <select
                          className="w-full px-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-sm shadow-sm transition-all"
                          value={availabilityFilter}
                          onChange={(e) => setAvailabilityFilter(e.target.value)}
                        >
                          <option value="All">All Status</option>
                          <option value="Available">Active Only</option>
                          <option value="Unavailable">Inactive Only</option>
                        </select>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Min Price</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                          <input
                            type="number"
                            placeholder="Min"
                            className="w-full pl-10 pr-4 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none font-bold text-sm shadow-sm transition-all"
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Max Price</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                          <input
                            type="number"
                            placeholder="Max"
                            className="w-full pl-10 pr-4 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none font-bold text-sm shadow-sm transition-all"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">Dietary</label>
                        <select
                          className="w-full px-5 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-sm shadow-sm transition-all"
                          value={dietaryFilter}
                          onChange={(e) => setDietaryFilter(e.target.value)}
                        >
                          <option value="All">All Dietary</option>
                          <option value="veg">Veg Only</option>
                          <option value="non-veg">Non-Veg Only</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end">
                      <button 
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('All');
                          setAvailabilityFilter('All');
                          setMinPrice('');
                          setMaxPrice('');
                          setDietaryFilter('All');
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors py-2 px-4 bg-amber-500/10 rounded-xl"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SlideIn>

        {activeTab === 'items' ? (
          /* Items Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredItems.map((item, i) => (
                <SlideIn key={item._id} delay={i * 0.05}>
                  <CardHover>
                    <div className={`group bg-card rounded-[2.5rem] overflow-hidden border border-border relative flex flex-col h-full transition-all duration-300 ${!item.isAvailable && 'opacity-60 grayscale'}`}>
                      {/* Image */}
                      <div className="h-52 relative overflow-hidden bg-muted">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon size={48} strokeWidth={1} />
                          </div>
                        )}
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                          <span className="px-3 py-1 bg-background/80 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-border">
                            {item.category?.name || 'Unsorted'}
                          </span>
                          <span className={`px-3 py-1 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest border self-start ${
                            item.dietaryType === 'veg' ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-red-500/20 border-red-500/30 text-red-500'
                          }`}>
                            {item.dietaryType}
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
                              Sale
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6 md:p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-black tracking-tight line-clamp-1">{item.name}</h3>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-amber-600 flex items-center">
                              <IndianRupee size={16} />{item.discountedPrice || item.price}
                            </span>
                            {(item.discountedPrice || item.originalPrice) && (
                              <span className="text-[10px] text-muted-foreground line-through font-bold">
                                ₹{item.originalPrice || item.price}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 font-medium mb-6 leading-relaxed">
                          {item.description || 'No description added.'}
                        </p>

                        <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
                          <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                            <Clock size={14} className="text-amber-600" />
                            {item.preparationTime} Min
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
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                          Items: {menuItems.filter(m => (m.category?._id || m.category) === cat._id).length}
                        </p>
                        <div className="h-1 w-1 rounded-full bg-zinc-800" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                          Sold: {analytics.categorySales.find(cs => cs.name === cat.name)?.count || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground font-medium mb-8 min-h-[40px]">{cat.description || 'No description added.'}</p>

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] ${cat.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {cat.isActive ? 'Active' : 'Inactive'}
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
          title={editingItem ? "Edit Item" : "Add New Item"}
          maxWidth="max-w-5xl"
        >
          <form onSubmit={handleItemSubmit} className="p-2 space-y-12">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-10">
                
                {/* Specifications */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <UtensilsCrossed size={16} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Details</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Item Name</label>
                      <input 
                        name="name" 
                        defaultValue={editingItem?.name} 
                        required 
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all" 
                        placeholder="e.g. Masala Dosa" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Category</label>
                        <div className="relative">
                          <select 
                            name="category" 
                            defaultValue={editingItem?.category?._id} 
                            required 
                            className="w-full appearance-none px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all cursor-pointer"
                          >
                            <option value="">Select Category</option>
                            {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Prep Time (Min)</label>
                        <div className="relative">
                          <input 
                            name="preparationTime" 
                            type="number" 
                            defaultValue={editingItem?.preparationTime || 10} 
                            required 
                            className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all" 
                          />
                          <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Description</label>
                      <textarea 
                        name="description" 
                        defaultValue={editingItem?.description} 
                        rows="3" 
                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all resize-none" 
                        placeholder="Describe the item..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Dietary Type</label>
                      <div className="flex gap-4">
                        {['veg', 'non-veg'].map((type) => (
                          <label key={type} className="flex-1 flex items-center justify-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-amber-500/50 transition-all">
                            <input 
                              type="radio" 
                              name="dietaryType" 
                              value={type} 
                              defaultChecked={editingItem ? editingItem.dietaryType === type : type === 'veg'} 
                              className="w-4 h-4 accent-amber-600" 
                            />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${type === 'veg' ? 'text-green-500' : 'text-red-500'}`}>
                              {type}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Pricing */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <IndianRupee size={16} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Pricing</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Base Price (₹)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                          <input 
                            name="price" 
                            type="number" 
                            defaultValue={editingItem?.price} 
                            required 
                            className="w-full pl-10 pr-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-black transition-all" 
                          />
                        </div>
                      </div>
                      {(user?.role === 'admin' || user?.role === 'location_admin' || user?.role === 'super_admin') && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">Cost Price (₹)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/50 font-bold">₹</span>
                            <input 
                              name="costPrice" 
                              type="number" 
                              defaultValue={editingItem?.costPrice || 0} 
                              required 
                              className="w-full pl-10 pr-5 py-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 outline-none focus:ring-2 focus:ring-amber-500 font-black text-amber-600 transition-all" 
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 p-5 bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Original Price (Strikethrough ₹)</label>
                        <input 
                          name="originalPrice" 
                          type="number" 
                          defaultValue={editingItem?.originalPrice} 
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all" 
                          placeholder="The 'Old' price"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Offer Price (New Payable ₹)</label>
                        <input 
                          name="discountedPrice" 
                          type="number" 
                          defaultValue={editingItem?.discountedPrice} 
                          className="w-full px-4 py-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all" 
                          placeholder="The 'Sale' price"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-5 space-y-10">
                
                {/* Visuals */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <ImageIcon size={16} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Item Photo</h4>
                  </div>

                  <div
                    onClick={() => itemFileRef.current.click()}
                    className="aspect-square rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-500/5 hover:border-amber-500/30 transition-all overflow-hidden relative group"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-6 text-center">
                          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-3">
                            <ImageIcon size={20} />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest">Change Image</p>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center space-y-4">
                        <div className="h-20 w-20 rounded-[2rem] bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mx-auto text-zinc-400 group-hover:scale-110 transition-transform group-hover:text-amber-500">
                          <ImageIcon size={32} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Add Image</p>
                          <p className="text-[8px] text-zinc-400 uppercase mt-1">PNG / WEBP Supported</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input type="file" name="image" ref={itemFileRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                </section>

                {/* Status */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-zinc-500/10 flex items-center justify-center text-zinc-500">
                      <Zap size={16} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Settings</h4>
                  </div>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer group">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">Active Availability</span>
                      <input 
                        type="checkbox" 
                        name="isAvailable" 
                        defaultChecked={editingItem ? editingItem.isAvailable : true} 
                        className="w-5 h-5 accent-amber-600 rounded-lg" 
                      />
                    </label>
                    
                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                      <label className="flex items-center justify-between p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer group">
                        <div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block">Global Item</span>
                          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-tight italic">Available for every branch</span>
                        </div>
                        <input 
                          type="checkbox" 
                          name="isGlobal" 
                          defaultChecked={editingItem ? !editingItem.locationId : true} 
                          className="w-5 h-5 accent-amber-600 rounded-lg" 
                        />
                      </label>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Current Stock Level</label>
                      <div className="relative">
                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input 
                          name="stock" 
                          type="number" 
                          defaultValue={editingItem?.stock || 0} 
                          className="w-full pl-12 pr-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all" 
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recipe */}
                <div 
                  onClick={() => setShowRecipeEditor(!showRecipeEditor)}
                  className={`p-6 rounded-[2rem] border-2 cursor-pointer transition-all ${showRecipeEditor ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-amber-500/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${showRecipeEditor ? 'bg-amber-500 text-black' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${showRecipeEditor ? 'text-amber-600' : 'text-zinc-500'}`}>Recipe</p>
                        <p className="text-[8px] text-zinc-400 uppercase mt-0.5">Ingredients & Prep</p>
                      </div>
                    </div>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all ${showRecipeEditor ? 'bg-amber-500 border-amber-500 text-black rotate-180' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipe Editor */}
            <AnimatePresence>
              {showRecipeEditor && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="space-y-10 pt-10 border-t border-zinc-200 dark:border-zinc-800"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Ingredients */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <List size={18} className="text-amber-500" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ingredients</h4>
                        </div>
                        <button 
                          type="button" 
                          onClick={addIngredient} 
                          className="px-4 py-1.5 rounded-full bg-amber-500/10 text-[9px] font-black uppercase text-amber-600 hover:bg-amber-500 hover:text-black transition-all"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-3">
                        {recipeData.ingredients.map((ing, idx) => (
                          <motion.div 
                            layout
                            key={idx} 
                            className="flex gap-3 items-center p-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800"
                          >
                            <div className="flex-[3]">
                              <input
                                placeholder="Name"
                                value={ing.name}
                                onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                            <div className="flex-[1.5]">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={ing.quantity}
                                onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-center outline-none"
                              />
                            </div>
                            <div className="flex-2">
                              <select
                                value={ing.unit}
                                onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                                className="w-full px-3 py-2.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase appearance-none text-center outline-none"
                              >
                                <option value="grams">Grams</option>
                                <option value="ml">ML</option>
                                <option value="pcs">Pcs</option>
                                <option value="tsp">TSP</option>
                              </select>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => removeIngredient(idx)} 
                              className="h-10 w-10 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                            >
                              <Minus size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Zap size={18} className="text-amber-500" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Steps</h4>
                        </div>
                        <button 
                          type="button" 
                          onClick={addInstruction} 
                          className="px-4 py-1.5 rounded-full bg-amber-500/10 text-[9px] font-black uppercase text-amber-600 hover:bg-amber-500 hover:text-black transition-all"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-4">
                        {recipeData.instructions.map((ins, idx) => (
                          <motion.div layout key={idx} className="flex gap-4 group">
                            <div className="h-10 w-10 rounded-[1rem] bg-amber-500 flex items-center justify-center text-black text-xs font-black shrink-0 shadow-lg shadow-amber-500/20">
                              {ins.step}
                            </div>
                            <textarea
                              placeholder="Describe this step..."
                              value={ins.text}
                              onChange={(e) => updateInstruction(idx, e.target.value)}
                              rows="2"
                              className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold resize-none outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                            />
                            <button 
                              type="button" 
                              onClick={() => removeInstruction(idx)} 
                              className="h-10 w-10 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all h-fit opacity-0 group-hover:opacity-100"
                            >
                              <Minus size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Notes</label>
                    <textarea
                      value={recipeData.notes}
                      onChange={(e) => setRecipeData(prev => ({ ...prev, notes: e.target.value }))}
                      rows="2"
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold resize-none"
                      placeholder="Special instructions..."
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Global Actions */}
            <div className="pt-10 flex items-center justify-end gap-6 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => { setShowItemModal(false); setEditingItem(null); }}
                className="px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-rose-500 transition-all"
              >
                Cancel
              </button>
              <Button 
                type="submit" 
                variant="primary" 
                icon={Save} 
                className="!py-5 !px-12 !rounded-[2rem] shadow-2xl shadow-amber-600/30 text-xs font-black uppercase tracking-[0.2em]"
              >
                {editingItem ? 'Save Updates' : 'Add Item'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Category Modal */}
        <Modal
          isOpen={showCategoryModal}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
          title={editingCategory ? "Update Category" : "Add New Category"}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCategorySubmit} className="p-2 space-y-10">
            
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Layers size={16} />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Category Details</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-6 space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Item Name</label>
                  <input 
                    name="name" 
                    defaultValue={editingCategory?.name} 
                    required 
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all" 
                    placeholder="e.g. South Indian" 
                  />
                </div>
                <div className="md:col-span-6 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Visual Icon & Suggestions</label>
                  <div className="flex gap-3">
                    <div className="relative group shrink-0">
                      <input 
                        name="icon" 
                        value={categoryIcon}
                        onChange={(e) => setCategoryIcon(e.target.value)}
                        required 
                        className="w-20 px-2 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold text-center text-2xl transition-all" 
                      />
                    </div>
                    <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-2 overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 h-[56px] overflow-y-auto no-scrollbar justify-center items-center">
                        {SUGGESTED_ICONS.map(icon => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setCategoryIcon(icon)}
                            className={`h-8 w-8 flex items-center justify-center rounded-lg hover:bg-amber-500/10 transition-all text-lg ${categoryIcon === icon ? 'bg-amber-500/20 scale-110' : ''}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Categorical Scope (Description)</label>
                <textarea 
                  name="description" 
                  defaultValue={editingCategory?.description} 
                  rows="3" 
                  className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-bold transition-all resize-none" 
                  placeholder="Define the scope of culinary nodes within this sector..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Hierarchy Index (Sort Order)</label>
                  <input 
                    name="sortOrder" 
                    type="number" 
                    defaultValue={editingCategory?.sortOrder || 0} 
                    required 
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500/30 font-black transition-all" 
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center gap-5 cursor-pointer select-none group p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-amber-500/20 transition-all">
                    <div className="relative">
                      <input type="checkbox" name="isActive" defaultChecked={editingCategory ? editingCategory.isActive : true} className="peer hidden" />
                      <div className="w-14 h-7 bg-zinc-200 dark:bg-zinc-800 rounded-full peer-checked:bg-amber-500 transition-colors shadow-inner"></div>
                      <div className="absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-7 shadow-sm"></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-amber-500 transition-colors">Operational Status</span>
                      <span className="text-[8px] text-zinc-500 uppercase tracking-tighter">Sector availability in matrix</span>
                    </div>
                  </label>
                </div>
              </div>
            </section>

            <div className="pt-8 flex items-center justify-end gap-6 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                className="px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-rose-500 transition-all"
              >
                Abort Protocol
              </button>
              <Button 
                type="submit" 
                variant="primary" 
                icon={Save} 
                className="!py-5 !px-12 !rounded-[2rem] shadow-2xl shadow-amber-600/30 text-xs font-black uppercase tracking-[0.2em]"
              >
                {editingCategory ? 'Synchronize Sector' : 'Initialize Sector'}
              </Button>
            </div>
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
