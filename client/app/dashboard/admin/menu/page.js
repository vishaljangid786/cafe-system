'use client';
import { 
  UtensilsCrossed, Search, Plus, Filter, 
  Edit2, Trash2, CheckCircle2, XCircle, 
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package, Save, X
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef } from 'react';
import api from '../../../services/api';

export default function MenuManagementPage() {
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'categories'
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  
  // Form refs
  const itemFileRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu'),
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
  }, []);

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
    
    // Validation: discountedPrice < price
    const price = parseFloat(formData.get('price'));
    const discPrice = formData.get('discountedPrice') ? parseFloat(formData.get('discountedPrice')) : null;
    
    if (discPrice && discPrice >= price) {
      return toast.error('Fiscal logic error: Discounted price must be below base price');
    }

    const loadToast = toast.loading(editingItem ? 'Updating node...' : 'Deploying node...');
    try {
      if (editingItem) {
        await api.put(`/menu/${editingItem._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Node synchronized', { id: loadToast });
      } else {
        await api.post('/menu', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('New node operational', { id: loadToast });
      }
      setShowItemModal(false);
      setEditingItem(null);
      setImagePreview(null);
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

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category?.name === selectedCategory;
    return matchesSearch && matchesCat;
  });

  if (loading && menuItems.length === 0) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4">
              <UtensilsCrossed className="text-accent" size={36} strokeWidth={2.5} />
              Menu <span className="text-accent">OS</span>
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Manage culinary nodes and logical sectors.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant={activeTab === 'items' ? 'primary' : 'secondary'} 
              onClick={() => setActiveTab('items')}
              icon={Package}
            >
              Inventory
            </Button>
            <Button 
              variant={activeTab === 'categories' ? 'primary' : 'secondary'} 
              onClick={() => setActiveTab('categories')}
              icon={Layers}
            >
              Sectors
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <SlideIn direction="down">
          <div className="bg-card p-6 rounded-3xl border border-border flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input 
                type="text" 
                placeholder="Query nodes by designation..." 
                className="w-full pl-12 pr-4 py-3 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-accent outline-none transition-all font-bold text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <select 
                  className="w-full pl-12 pr-10 py-3 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-accent outline-none appearance-none font-bold text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="All">All Sectors</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <Button 
                variant="primary" 
                icon={Plus} 
                onClick={() => activeTab === 'items' ? setShowItemModal(true) : setShowCategoryModal(true)}
                className="!py-3"
              >
                Establish {activeTab === 'items' ? 'Node' : 'Sector'}
              </Button>
            </div>
          </div>
        </SlideIn>

        {activeTab === 'items' ? (
          /* Menu Items Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredItems.map((item, i) => (
                <SlideIn key={item._id} delay={i * 0.05}>
                  <CardHover>
                    <div className={`group bg-card rounded-[2.5rem] overflow-hidden border border-border relative flex flex-col h-full transition-all duration-300 ${!item.isAvailable && 'opacity-60 grayscale'}`}>
                      {/* Image Hub */}
                      <div className="h-48 relative overflow-hidden bg-muted">
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
                      </div>

                      {/* Content Hub */}
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-black tracking-tight line-clamp-1">{item.name}</h3>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-accent flex items-center">
                              <IndianRupee size={16} />{item.discountedPrice || item.price}
                            </span>
                            {item.discountedPrice && (
                              <span className="text-[10px] text-muted-foreground line-through font-bold">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground line-clamp-2 font-medium mb-6">{item.description || 'No descriptive data available for this node.'}</p>
                        
                        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                          <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                            <Clock size={14} className="text-accent" />
                            {item.preparationTime} Min Sync
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setEditingItem(item); setShowItemModal(true); setImagePreview(item.image); }}
                              className="p-2.5 rounded-xl bg-muted hover:bg-zinc-800 text-muted-foreground hover:text-accent transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => deleteItem(item._id)}
                              className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all"
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
            {categories.map((cat, i) => (
              <SlideIn key={cat._id} delay={i * 0.05}>
                <Card className="!p-8 group relative overflow-hidden border border-border hover:border-accent/30 transition-all">
                  <div className="absolute top-0 right-0 p-8 text-accent opacity-5 group-hover:opacity-10 transition-opacity">
                    <Layers size={80} />
                  </div>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl">
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
                        className="p-2.5 rounded-xl bg-muted hover:bg-zinc-800 text-muted-foreground hover:text-accent transition-all"
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
          onClose={() => { setShowItemModal(false); setEditingItem(null); setImagePreview(null); }}
          title={editingItem ? "Reconfigure Node" : "Deploy Menu Node"}
        >
          <form onSubmit={handleItemSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Designation</label>
                  <input name="name" defaultValue={editingItem?.name} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Sector</label>
                  <select name="category" defaultValue={editingItem?.category?._id} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold">
                    {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Base Price</label>
                    <input name="price" type="number" defaultValue={editingItem?.price} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Offer Price</label>
                    <input name="discountedPrice" type="number" defaultValue={editingItem?.discountedPrice} className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Imagery Core</label>
                <div 
                  onClick={() => itemFileRef.current.click()}
                  className="aspect-square rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent/5 hover:border-accent/30 transition-all overflow-hidden relative group"
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                        Replace Imagery
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={32} className="text-muted-foreground mb-2" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Upload Frame</span>
                    </>
                  )}
                </div>
                <input type="file" name="image" ref={itemFileRef} onChange={handleImageChange} className="hidden" accept="image/*" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Contextual Description</label>
              <textarea name="description" defaultValue={editingItem?.description} rows="3" className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold resize-none"></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Sync Time (Min)</label>
                  <input name="preparationTime" type="number" defaultValue={editingItem?.preparationTime || 10} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
               </div>
               <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input type="checkbox" name="isAvailable" defaultChecked={editingItem ? editingItem.isAvailable : true} className="w-5 h-5 rounded-lg accent-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Active State</span>
                  </label>
               </div>
            </div>

            <Button type="submit" variant="primary" icon={Save} className="w-full py-4 !rounded-2xl">
              Synchronize Node
            </Button>
          </form>
        </Modal>

        {/* Category Modal */}
        <Modal 
          isOpen={showCategoryModal} 
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
          title={editingCategory ? "Update Sector" : "Establish Sector"}
        >
          <form onSubmit={handleCategorySubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Sector Title</label>
                <input name="name" defaultValue={editingCategory?.name} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Icon</label>
                <input name="icon" defaultValue={editingCategory?.icon || '🍽️'} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold text-center text-xl" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Categorical Purpose</label>
              <textarea name="description" defaultValue={editingCategory?.description} rows="3" className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold resize-none"></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 block">Hierarchy Rank</label>
                <input name="sortOrder" type="number" defaultValue={editingCategory?.sortOrder || 0} required className="w-full px-4 py-3 bg-muted rounded-xl border border-border outline-none focus:ring-2 focus:ring-accent font-bold" />
              </div>
              <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input type="checkbox" name="isActive" defaultChecked={editingCategory ? editingCategory.isActive : true} className="w-5 h-5 rounded-lg accent-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Operational State</span>
                  </label>
               </div>
            </div>

            <Button type="submit" variant="primary" icon={Save} className="w-full py-4 !rounded-2xl">
              Initialize Sector
            </Button>
          </form>
        </Modal>

        {filteredItems.length === 0 && activeTab === 'items' && !loading && (
          <div className="text-center py-24 bg-accent/5 rounded-[3rem] border border-dashed border-accent/20">
            <UtensilsCrossed size={48} className="mx-auto text-accent/20 mb-4" strokeWidth={1.5} />
            <h3 className="text-xl font-black text-foreground">No Culinary Nodes Found</h3>
            <p className="text-muted-foreground font-medium mt-1">The menu matrix is currently empty for this sector.</p>
            <Button variant="outline" className="mt-6" icon={Plus} onClick={() => setShowItemModal(true)}>Add First Node</Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
