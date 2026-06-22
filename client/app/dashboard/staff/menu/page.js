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
import { Skeleton } from '@/app/components/ui/Skeleton';

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
      toast.error('Could not load menu items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (id) => {
    const loadToast = toast.loading('Updating status...');
    try {
      await api.put(`/menu/${id}/availability`);
      setMenuItems(items => items.map(item =>
        item._id === id ? { ...item, isAvailable: !item.isAvailable } : item
      ));
      toast.success('Status updated', { id: loadToast });
    } catch (error) {
      toast.error('Could not update status. Please try again.', { id: loadToast });
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
      toast.error('Could not update stock. Please try again.', { id: loadToast });
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
        {/* Header */}
        <div className="relative group overflow-hidden bg-(--color-surface) dark:bg-(--color-surface) rounded-xl p-10 border border-(--color-border) dark:border-(--color-border) shadow-sm ">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <UtensilsCrossed size={200} className="text-primary" strokeWidth={1} />
          </div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg ">
                  <Package size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-(--color-text-primary) dark:text-white leading-none">
                    Menu <span className="text-primary">Items</span>
                  </h1>
                  <p className="text-(--color-text-muted) font-bold mt-2 flex items-center gap-2 text-sm">
                    <Sparkles size={14} className="text-warning" />
                    Manage your branch inventory and availability.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-(--color-surface-soft) dark:bg-(--color-bg) p-2 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-inner">
                <div className="flex items-center gap-2 px-3 border-r border-(--color-border) dark:border-(--color-border) mr-1">
                  <Activity size={14} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">{filteredItems.length} Items</span>
                </div>
                <div className="flex items-center gap-2 px-3">
                  <CheckCircle2 size={14} className="text-success" />
                  <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">{filteredItems.filter(i => i.isAvailable).length} Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search food items..."
              className="w-full pl-14 pr-6 py-5 bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) rounded-xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-sm text-(--color-text-primary) dark:text-(--color-text-primary) shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 bg-(--color-surface) dark:bg-(--color-surface) p-2 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all ${selectedCategory === 'All' ? 'bg-primary text-white shadow-lg ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'}`}
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

          <div className="flex items-center gap-2 bg-(--color-surface) dark:bg-(--color-surface) p-2 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm">
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
                    ? 'bg-(--color-surface-soft) dark:bg-(--color-surface) text-primary border border-(--color-border) dark:border-(--color-border) shadow-inner' 
                    : 'text-(--color-text-muted) hover:text-(--color-text-secondary) dark:hover:text-(--color-text-muted)'
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
              <Skeleton key={i} className="h-[400px] rounded-xl" />
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-32 text-center bg-(--color-surface-soft) dark:bg-(--color-bg)/40 rounded-xl border border-dashed border-(--color-border) dark:border-(--color-border)">
              <div className="h-20 w-20 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) flex items-center justify-center text-(--color-text-muted) mx-auto mb-6">
                <UtensilsCrossed size={40} strokeWidth={1} />
              </div>
              <p className="text-(--color-text-muted) font-bold text-lg tracking-tight">No food items match your current selection.</p>
              <button onClick={() => {setSearchTerm(''); setSelectedCategory('All'); setDietaryFilter('All');}} className="mt-4 text-primary text-xs font-bold uppercase tracking-normal hover:underline">Clear Filters</button>
            </div>
          ) : (
            <AnimatePresence mode='popLayout'>
              {filteredItems.map((item, i) => (
                <SlideIn key={item._id} delay={i * 0.02}>
                  <CardHover>
                    <div className={`group bg-(--color-surface) dark:bg-(--color-surface) rounded-xl overflow-hidden border border-(--color-border) dark:border-(--color-border) flex flex-col h-full transition-all duration-500 hover:border-primary/40 hover:shadow-sm ${!item.isAvailable && 'opacity-60 grayscale-[0.5]'}`}>
                      {/* Media Container */}
                      <div className="h-56 relative overflow-hidden bg-(--color-surface-soft) dark:bg-(--color-bg) p-3">
                        <div className="w-full h-full rounded-[2.2rem] overflow-hidden relative">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-1000" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-(--color-text-muted) dark:text-(--color-text-primary) bg-(--color-surface-soft) dark:bg-(--color-surface)">
                              <ImageIcon size={48} strokeWidth={1} />
                            </div>
                          )}
                          
                          {/* Floating Badges */}
                          <div className="absolute top-4 left-4 flex flex-col gap-2">
                            <span className="px-3 py-1 bg-white/80 dark:bg-black/80  rounded-full text-[9px] font-bold uppercase tracking-normal border border-(--color-border) shadow-sm text-(--color-text-primary) dark:text-white">
                              {item.category?.name || 'Item'}
                            </span>
                          </div>

                          <div className="absolute top-4 right-4">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2  shadow-sm ${
                              item.dietaryType === 'veg' ? 'border-success bg-success/20 text-success' : 'border-danger bg-danger/20 text-danger'
                            }`}>
                              <Leaf size={14} fill={item.dietaryType === 'veg' ? 'currentColor' : 'none'} />
                            </div>
                          </div>

                          <div className={`absolute bottom-4 right-4 px-4 py-1.5 rounded-full  border text-[8px] font-bold uppercase tracking-normal shadow-sm ${item.isAvailable ? 'bg-success text-white border-success' : 'bg-danger text-white border-danger'}`}>
                            {item.isAvailable ? 'Available' : 'Not Available'}
                          </div>
                        </div>
                      </div>

                      {/* Content Container */}
                      <div className="p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <h3 className="text-xl font-bold text-(--color-text-primary) dark:text-white tracking-tight leading-none group-hover:text-primary transition-colors">{item.name}</h3>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-lg font-bold text-primary dark:text-primary flex items-center tracking-tight">
                              <IndianRupee size={16} strokeWidth={3} />{item.discountedPrice || item.price}
                            </span>
                            {item.discountedPrice && (
                              <span className="text-[10px] text-(--color-text-muted) line-through font-bold">
                                ₹{item.price}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-(--color-text-muted) dark:text-(--color-text-muted) line-clamp-2 font-medium mb-8 leading-relaxed">
                          {item.description || 'Tasty dish made with fresh ingredients.'}
                        </p>

                        <div className="mt-auto flex items-center justify-between border-t border-(--color-border) dark:border-(--color-border) pt-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) flex items-center justify-center text-primary shadow-inner">
                              <Package size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) leading-none">Stock</p>
                              <p className="text-sm font-bold text-(--color-text-primary) dark:text-white mt-1">{item.stock || 0} Units</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleAvailability(item._id)}
                              className={`p-3 rounded-xl border transition-all active:scale-90 ${item.isAvailable ? 'bg-(--color-surface-soft) dark:bg-(--color-surface) border-(--color-border) dark:border-(--color-border) text-(--color-text-muted) hover:text-success hover:border-success/50' : 'bg-success border-success text-white shadow-lg '}`}
                              title={item.isAvailable ? 'Mark as not available' : 'Mark as available'}
                            >
                              <Zap size={16} fill={item.isAvailable ? 'none' : 'currentColor'} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setStockValue(item.stock || 0);
                                setShowStockModal(true);
                              }}
                              className="p-3 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) text-(--color-text-muted) hover:text-primary hover:border-primary/50 transition-all active:scale-90"
                              title="Update stock"
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
              className="px-6 py-3 rounded-xl bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:border-primary/30 active:scale-95 flex items-center gap-2"
            >
              <ChevronRight size={14} className="rotate-180" /> Previous
            </button>
            <div className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) font-bold text-xs">
              <span className="text-primary">{currentPage}</span>
              <span className="text-(--color-text-muted)">/</span>
              <span className="text-(--color-text-muted)">{totalPages}</span>
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-6 py-3 rounded-xl bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:border-primary/30 active:scale-95 flex items-center gap-2"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Enhanced Stock Management Modal */}
        <Modal
          isOpen={showStockModal}
          onClose={() => setShowStockModal(false)}
          title="Update Stock"
          maxWidth="max-w-md"
        >
          <div className="p-8 space-y-10">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="h-24 w-24 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner group relative">
                <Package size={48} className="transition-transform duration-500" />
                <div className="absolute -top-2 -right-2 h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center text-[10px] font-bold shadow-lg">
                  <Zap size={14} fill="currentColor" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold tracking-tight text-(--color-text-primary) dark:text-white leading-none">{editingItem?.name}</h3>
                <div className="flex items-center justify-center gap-2">
                   <span className="px-3 py-1 rounded-lg bg-(--color-surface-soft) dark:bg-(--color-surface) text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) border border-(--color-border) dark:border-(--color-border)">Current: {editingItem?.stock || 0} Units</span>
                </div>
              </div>
            </div>

            <div className="bg-(--color-surface-soft) dark:bg-(--color-bg) rounded-xl p-8 border border-(--color-border) dark:border-(--color-border) flex items-center justify-center gap-10 shadow-inner">
              <button 
                onClick={() => setStockValue(Math.max(0, stockValue - 1))}
                className="h-14 w-14 rounded-xl bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) flex items-center justify-center text-(--color-text-muted) hover:text-danger hover:border-danger/30 transition-all shadow-sm active:scale-90"
              >
                <Minus size={20} strokeWidth={3} />
              </button>
              
              <div className="relative group">
                <input 
                  type="number"
                  value={stockValue}
                  onChange={(e) => setStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 text-5xl font-bold text-center bg-transparent outline-none text-(--color-text-primary) dark:text-white group-focus:text-primary transition-colors"
                />
                <div className="h-1 w-full bg-primary/20 rounded-full mt-2 overflow-hidden">
                  <motion.div initial={{width: 0}} animate={{width: '100%'}} className="h-full bg-primary" />
                </div>
              </div>
 
              <button 
                onClick={() => setStockValue(stockValue + 1)}
                className="h-14 w-14 rounded-xl bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) flex items-center justify-center text-(--color-text-muted) hover:text-success hover:border-success/30 transition-all shadow-sm active:scale-90"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                variant="primary"
                onClick={handleStockUpdate}
                icon={Save}
                className="w-full !py-6 rounded-xl shadow-sm  bg-primary hover:bg-primary font-bold uppercase tracking-normal text-xs transition-all active:scale-95"
              >
                Save Changes
              </Button>
              <button
                onClick={() => setShowStockModal(false)}
                className="w-full py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-white transition-colors"
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
