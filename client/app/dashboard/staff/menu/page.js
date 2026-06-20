'use client';
import {
  UtensilsCrossed, Search, Filter,
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package, CheckCircle2, XCircle,
  Plus, Minus, Save, Zap, Leaf, Drumstick, Sparkles,
  ShoppingBag, Activity, Info
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function StaffMenuPage() {
  const { selectedLocation } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 24;

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState('All');
  const [dietaryFilter, setDietaryFilter] = useState('All');

  // Stock Modal State
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [stockValue, setStockValue] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };
      if (selectedLocation) params.locationId = selectedLocation._id || selectedLocation;

      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu', { params }),
        api.get('/categories')
      ]);
      setMenuItems(itemsRes.data.data);
      setTotalPages(itemsRes.data.pagination.pages);
      setCategories(catsRes.data.data);
    } catch (error) {
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (id) => {
    const loadToast = toast.loading('Syncing status...');
    try {
      await api.put(`/menu/${id}/availability`);
      setMenuItems(items => items.map(item => 
        item._id === id ? { ...item, isAvailable: !item.isAvailable } : item
      ));
      toast.success('Status synchronized', { id: loadToast });
    } catch (error) {
      toast.error('Sync failed', { id: loadToast });
    }
  };

  const handleStockUpdate = async () => {
    const loadToast = toast.loading('Updating inventory...');
    try {
      await api.put(`/menu/${editingItem._id}/stock`, { stock: stockValue });
      setMenuItems(items => items.map(item => 
        item._id === editingItem._id ? { ...item, stock: stockValue } : item
      ));
      toast.success('Stock updated', { id: loadToast });
      setShowStockModal(false);
    } catch (error) {
      toast.error('Stock update failed', { id: loadToast });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedLocation, currentPage]);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category?.name === selectedCategory;
    const matchesAvailability =
      availabilityFilter === 'All' ||
      (availabilityFilter === 'Available' && item.isAvailable) ||
      (availabilityFilter === 'Unavailable' && !item.isAvailable);

    const matchesDietary = dietaryFilter === 'All' || item.dietaryType === dietaryFilter;

    return matchesSearch && matchesCat && matchesAvailability && matchesDietary;
  });

  return (
    <PageTransition>
      <div className="space-y-10 pb-24">
        {/* Cinematic Header Section */}
        <div className="relative group overflow-hidden bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-blue-500/5">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <UtensilsCrossed size={200} className="text-blue-500" strokeWidth={1} />
          </div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/10">
                  <Package size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white leading-none">
                    Menu <span className="text-blue-500">Vault</span>
                  </h1>
                  <p className="text-zinc-500 font-bold mt-2 flex items-center gap-2 text-sm">
                    <Sparkles size={14} className="text-amber-500" />
                    Manage your branch inventory and availability.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-950 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
                <div className="flex items-center gap-2 px-3 border-r border-zinc-200 dark:border-zinc-800 mr-1">
                  <Activity size={14} className="text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{filteredItems.length} Items</span>
                </div>
                <div className="flex items-center gap-2 px-3">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{filteredItems.filter(i => i.isAvailable).length} Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search food items..."
              className="w-full pl-14 pr-6 py-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === 'All' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
            >
              All
            </button>
            <PremiumSelect 
              value={selectedCategory === 'All' ? '' : selectedCategory}
              onChange={val => setSelectedCategory(val || 'All')}
              options={categories.map(cat => ({ label: cat.name, value: cat.name }))}
              placeholder="Category"
              className="!border-none !bg-transparent !shadow-none flex-[2]"
            />
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {[
              { id: 'All', icon: Layers },
              { id: 'veg', icon: Leaf },
              { id: 'non-veg', icon: Drumstick }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDietaryFilter(f.id)}
                className={`flex-1 py-3 flex items-center justify-center rounded-xl transition-all ${
                  dietaryFilter === f.id 
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-blue-500 border border-zinc-200 dark:border-zinc-700 shadow-inner' 
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                }`}
                title={f.id.toUpperCase()}
              >
                <f.icon size={18} />
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {loading ? (
            Array(8).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-[400px] rounded-[3rem]" />
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-32 text-center bg-zinc-50 dark:bg-zinc-950/40 rounded-[3.5rem] border border-dashed border-zinc-200 dark:border-zinc-800">
              <div className="h-20 w-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-300 mx-auto mb-6">
                <UtensilsCrossed size={40} strokeWidth={1} />
              </div>
              <p className="text-zinc-500 font-bold text-lg tracking-tight">No food items match your current selection.</p>
              <button onClick={() => {setSearchTerm(''); setSelectedCategory('All'); setDietaryFilter('All');}} className="mt-4 text-blue-500 text-xs font-black uppercase tracking-widest hover:underline">Reset Filters</button>
            </div>
          ) : (
            <AnimatePresence mode='popLayout'>
              {filteredItems.map((item, i) => (
                <SlideIn key={item._id} delay={i * 0.02}>
                  <CardHover>
                    <div className={`group bg-white dark:bg-zinc-900 rounded-[3rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col h-full transition-all duration-500 hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/5 ${!item.isAvailable && 'opacity-60 grayscale-[0.5]'}`}>
                      {/* Media Container */}
                      <div className="h-56 relative overflow-hidden bg-zinc-100 dark:bg-zinc-950 p-3">
                        <div className="w-full h-full rounded-[2.2rem] overflow-hidden relative">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                              <ImageIcon size={48} strokeWidth={1} />
                            </div>
                          )}
                          
                          {/* Floating Badges */}
                          <div className="absolute top-4 left-4 flex flex-col gap-2">
                            <span className="px-3 py-1 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 shadow-xl text-zinc-900 dark:text-white">
                              {item.category?.name || 'Item'}
                            </span>
                          </div>

                          <div className="absolute top-4 right-4">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 backdrop-blur-md shadow-xl ${
                              item.dietaryType === 'veg' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-rose-500 bg-rose-500/20 text-rose-500'
                            }`}>
                              <Leaf size={14} fill={item.dietaryType === 'veg' ? 'currentColor' : 'none'} />
                            </div>
                          </div>

                          <div className={`absolute bottom-4 right-4 px-4 py-1.5 rounded-full backdrop-blur-md border text-[8px] font-black uppercase tracking-widest shadow-2xl ${item.isAvailable ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'}`}>
                            {item.isAvailable ? 'Active' : 'Offline'}
                          </div>
                        </div>
                      </div>

                      {/* Content Container */}
                      <div className="p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none group-hover:text-blue-500 transition-colors">{item.name}</h3>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400 flex items-center tracking-tighter">
                              <IndianRupee size={16} strokeWidth={3} />{item.discountedPrice || item.price}
                            </span>
                            {item.discountedPrice && (
                              <span className="text-[10px] text-zinc-400 line-through font-bold">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 font-medium mb-8 leading-relaxed">
                          {item.description || 'Gourmet selection prepared with premium ingredients for the ultimate cafe experience.'}
                        </p>

                        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-blue-500 shadow-inner">
                              <Package size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-none">Stock</p>
                              <p className="text-sm font-black text-zinc-900 dark:text-white mt-1">{item.stock || 0} Units</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleAvailability(item._id)}
                              className={`p-3 rounded-2xl border transition-all active:scale-90 ${item.isAvailable ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-emerald-500 hover:border-emerald-500/50' : 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'}`}
                              title={item.isAvailable ? 'Go Offline' : 'Go Online'}
                            >
                              <Zap size={16} fill={item.isAvailable ? 'none' : 'currentColor'} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setStockValue(item.stock || 0);
                                setShowStockModal(true);
                              }}
                              className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-blue-500 hover:border-blue-500/50 transition-all active:scale-90"
                              title="Inventory Management"
                            >
                              <Layers size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHover>
                </SlideIn>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Premium Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-8">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:border-blue-500/30 active:scale-95 flex items-center gap-2"
            >
              <ChevronRight size={14} className="rotate-180" /> Previous
            </button>
            <div className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-black text-xs">
              <span className="text-blue-500">{currentPage}</span>
              <span className="text-zinc-400">/</span>
              <span className="text-zinc-500">{totalPages}</span>
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-6 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:border-blue-500/30 active:scale-95 flex items-center gap-2"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Enhanced Stock Management Modal */}
        <Modal
          isOpen={showStockModal}
          onClose={() => setShowStockModal(false)}
          title="Inventory Node Update"
          maxWidth="max-w-md"
        >
          <div className="p-8 space-y-10">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="h-24 w-24 rounded-[2.5rem] bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner group relative">
                <Package size={48} className="group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute -top-2 -right-2 h-8 w-8 rounded-xl bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg">
                  <Zap size={14} fill="currentColor" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white leading-none">{editingItem?.name}</h3>
                <div className="flex items-center justify-center gap-2">
                   <span className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-zinc-700">Current: {editingItem?.stock || 0} Units</span>
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] p-8 border border-zinc-100 dark:border-zinc-900 flex items-center justify-center gap-10 shadow-inner">
              <button 
                onClick={() => setStockValue(Math.max(0, stockValue - 1))}
                className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-500/30 transition-all shadow-sm active:scale-90"
              >
                <Minus size={20} strokeWidth={3} />
              </button>
              
              <div className="relative group">
                <input 
                  type="number"
                  value={stockValue}
                  onChange={(e) => setStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 text-5xl font-black text-center bg-transparent outline-none text-zinc-900 dark:text-white group-focus:text-blue-500 transition-colors"
                />
                <div className="h-1 w-full bg-blue-500/20 rounded-full mt-2 overflow-hidden">
                  <motion.div initial={{width: 0}} animate={{width: '100%'}} className="h-full bg-blue-500" />
                </div>
              </div>
 
              <button 
                onClick={() => setStockValue(stockValue + 1)}
                className="h-14 w-14 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/30 transition-all shadow-sm active:scale-90"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                variant="primary"
                onClick={handleStockUpdate}
                icon={Save}
                className="w-full !py-6 rounded-[2rem] shadow-2xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 font-black uppercase tracking-[0.3em] text-xs transition-all active:scale-95"
              >
                Save Changes
              </Button>
              <button
                onClick={() => setShowStockModal(false)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
