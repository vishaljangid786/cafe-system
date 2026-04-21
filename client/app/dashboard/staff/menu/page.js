'use client';
import {
  UtensilsCrossed, Search, Filter,
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package
} from 'lucide-react';
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
  const [availabilityFilter, setAvailabilityFilter] = useState('Available'); // Default to Online Only for staff

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

    return matchesSearch && matchesCat && matchesAvailability;
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
          <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm flex flex-col md:flex-row gap-6 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Query nodes by designation..."
                className="w-full pl-12 pr-4 py-4 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <select
                className="flex-1 md:w-48 px-6 py-4 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none appearance-none font-bold text-sm"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Sectors</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat.name}>{cat.name}</option>
                ))}
              </select>

              <select
                className="flex-1 md:w-48 px-6 py-4 bg-muted/50 border border-border rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none appearance-none font-bold text-sm"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Available">Online Only</option>
                <option value="Unavailable">Offline Only</option>
              </select>
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
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-background/80 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-border">
                          {item.category?.name || 'Unsorted'}
                        </span>
                      </div>

                      <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-full backdrop-blur-md border text-[8px] font-black uppercase tracking-[0.1em] ${item.isAvailable ? 'bg-green-500/20 border-green-500/30 text-green-500' : 'bg-red-500/20 border-red-500/30 text-red-500'}`}>
                        {item.isAvailable ? 'Online' : 'Offline'}
                      </div>

                      {item.discountedPrice && (
                        <div className="absolute bottom-4 left-4">
                          <span className="px-3 py-1 bg-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/30">
                            Offer Node
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Hub */}
                    <div className="p-6 flex-1 flex flex-col">
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
                      </div>
                    </div>
                  </div>
                </CardHover>
              </SlideIn>
            ))}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-32 bg-amber-600/[0.02] rounded-[4rem] border border-dashed border-amber-600/20">
            <UtensilsCrossed size={64} className="mx-auto text-amber-600/10 mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Matrix Empty</h3>
            <p className="text-muted-foreground font-medium mt-2 max-w-sm mx-auto">No culinary nodes match your current query parameters.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
