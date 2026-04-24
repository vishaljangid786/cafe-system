'use client';
import {
  UtensilsCrossed, Search, Filter,
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package, CheckCircle2, XCircle,
  Plus, Minus, Save, Zap, Leaf, Drumstick
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

export default function StaffMenuPage() {
  const { selectedLocation } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async (id) => {
    try {
      await api.put(`/menu/${id}/availability`);
      setMenuItems(items => items.map(item => 
        item._id === id ? { ...item, isAvailable: !item.isAvailable } : item
      ));
      toast.success('Status synchronized');
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  const handleStockUpdate = async () => {
    try {
      await api.put(`/menu/${editingItem._id}/stock`, { stock: stockValue });
      setMenuItems(items => items.map(item => 
        item._id === editingItem._id ? { ...item, stock: stockValue } : item
      ));
      toast.success('Stock updated');
      setShowStockModal(false);
    } catch (error) {
      toast.error('Stock update failed');
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedLocation]);

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
              Menu <span className="text-amber-600">Inventory</span>
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Reference culinary nodes and real-time availability.</p>
          </div>
        </div>

        {/* Filters Section */}
        <SlideIn direction="down">
          <div className="bg-card p-10 rounded-[3rem] border border-border shadow-sm space-y-8">
            <div className="flex flex-col lg:flex-row gap-6 items-center">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Search for culinary nodes..."
                  className="w-full pl-14 pr-6 py-4 bg-muted/30 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none transition-all font-bold text-sm shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
                  <div className="flex bg-muted/50 p-1 rounded-xl border border-border mt-4 w-fit shadow-inner">
                    {[
                      { id: 'All', label: 'All Matrix' },
                      { id: 'veg', label: 'Veg Only', color: 'text-green-500' },
                      { id: 'non-veg', label: 'Non-Veg', color: 'text-red-500' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setDietaryFilter(f.id)}
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          dietaryFilter === f.id 
                            ? 'bg-accent text-black shadow-sm' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-card'
                        } ${f.color || ''}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
                <div className="space-y-1.5">
                  <select
                    className="w-full lg:w-48 px-6 py-4 bg-muted/30 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-sm shadow-inner"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="All">All Sectors</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <select
                    className="w-full lg:w-48 px-6 py-4 bg-muted/30 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-sm shadow-inner"
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                  >
                    <option value="All">All Status</option>
                    <option value="Available">Active Only</option>
                    <option value="Unavailable">Inactive Only</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <select
                    className="w-full lg:w-48 px-6 py-4 bg-muted/30 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-sm shadow-inner"
                    value={dietaryFilter}
                    onChange={(e) => setDietaryFilter(e.target.value)}
                  >
                    <option value="All">All Dietary</option>
                    <option value="veg">Veg Only</option>
                    <option value="non-veg">Non-Veg Only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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

                      <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full backdrop-blur-md border text-[8px] font-black uppercase tracking-[0.1em] ${item.isAvailable ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}>
                        {item.isAvailable ? 'Active' : 'Inactive'}
                      </div>

                      {item.discountedPrice && (
                        <div className="absolute bottom-4 left-4">
                          <span className="px-3 py-1 bg-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/30">
                            Offer Node
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-3">
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

                      <p className="text-xs text-muted-foreground line-clamp-2 font-medium mb-6 leading-relaxed">
                        {item.description || 'No descriptive data available for this node.'}
                      </p>

                      <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                          <Package size={14} className="text-amber-600" />
                          Stock: {item.stock || 0}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleAvailability(item._id)}
                            className={`p-2 rounded-xl border transition-all ${item.isAvailable ? 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white' : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'}`}
                            title={item.isAvailable ? 'Mark Inactive' : 'Mark Active'}
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setStockValue(item.stock || 0);
                              setShowStockModal(true);
                            }}
                            className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent hover:text-black transition-all"
                            title="Manage Stock"
                          >
                            <Layers size={14} />
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

        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-32 bg-accent/5 rounded-[4rem] border border-dashed border-accent/20">
            <UtensilsCrossed size={64} className="mx-auto text-accent/10 mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-black text-foreground tracking-tight">Matrix Empty</h3>
            <p className="text-muted-foreground font-medium mt-2 max-w-sm mx-auto">No culinary nodes match your current query parameters.</p>
          </div>
        )}

        {/* Stock Management Modal */}
        <Modal
          isOpen={showStockModal}
          onClose={() => setShowStockModal(false)}
          title="Manage Inventory Stock"
          maxWidth="max-w-md"
        >
          <div className="p-6 space-y-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-[2rem] bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                <Package size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-foreground">{editingItem?.name}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Current Stock: {editingItem?.stock || 0}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8">
              <button 
                onClick={() => setStockValue(Math.max(0, stockValue - 1))}
                className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-rose-500 hover:text-white transition-all shadow-sm"
              >
                <Minus size={24} strokeWidth={3} />
              </button>
              
              <input 
                type="number"
                value={stockValue}
                onChange={(e) => setStockValue(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-32 text-4xl font-black text-center bg-transparent outline-none text-foreground"
              />
 
              <button 
                onClick={() => setStockValue(stockValue + 1)}
                className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </div>

            <div className="pt-6 flex gap-4">
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <Button
                variant="primary"
                onClick={handleStockUpdate}
                icon={Save}
                className="flex-1 !py-4 rounded-2xl shadow-xl shadow-amber-500/20"
              >
                Update Stock
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
