'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { MapPin, Plus, Trash2, ShieldAlert, Globe, Hash, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', city: '', state: '', country: 'India', 
    pincode: '', lat: '', lng: '' 
  });

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations matrix");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Initializing location hub...');
    try {
      await api.post('/locations', {
        name: formData.name,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        pincode: formData.pincode,
        geoCoordinates: formData.lat && formData.lng ? {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        } : undefined
      });
      setShowModal(false);
      setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '' });
      fetchLocations();
      toast.success('Location synchronized successfully!', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/locations/${id}`, { status });
      toast.success(`Location state updated to ${status}`);
      fetchLocations();
    } catch (error) {
      toast.error('Failed to update hub state');
    }
  };

  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight flex items-center">
                <MapPin className="mr-3 text-amber-600" size={32} /> 
                Global <span className="ml-2 text-amber-600">Matrices</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm font-medium mt-1">Manage and monitor operational hubs across the network.</p>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center px-6 py-3.5 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all"
            >
              <Plus className="mr-2" size={18} /> Establish New Hub
            </motion.button>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {locations.map((loc, i) => (
            <SlideIn key={loc._id} delay={i * 0.1}>
              <CardHover>
                <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm p-8 border border-gray-100 dark:border-zinc-800 relative group overflow-hidden h-full flex flex-col">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-amber-600">
                    <MapPin size={120} />
                  </div>
                  
                  <div className="flex justify-between items-start relative z-10">
                    <div className="h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 shadow-inner">
                      <MapPin size={28} />
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                      loc.status === 'active' 
                        ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:border-green-500/20' 
                        : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
                    }`}>
                      {loc.status}
                    </div>
                  </div>

                  <div className="mt-8 relative z-10 flex-1">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight leading-tight">{loc.name}</h3>
                    <div className="flex items-center text-gray-500 dark:text-zinc-500 mt-3 text-sm font-bold uppercase tracking-wider">
                      <Navigation size={14} className="mr-2 text-amber-600" />
                      {loc.city}, {loc.state}
                    </div>
                    {loc.pincode && (
                      <div className="flex items-center text-[10px] font-black text-gray-400 dark:text-zinc-600 mt-2 uppercase tracking-[0.2em]">
                        <Hash size={12} className="mr-1.5" /> PIN: {loc.pincode}
                      </div>
                    )}
                  </div>

                  <div className="mt-10 pt-6 border-t border-gray-50 dark:border-zinc-800 flex justify-between items-center relative z-10">
                    <div className="flex space-x-2">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleStatusChange(loc._id, loc.status === 'active' ? 'inactive' : 'active')}
                        className={`p-3 rounded-xl transition-all shadow-sm ${
                          loc.status === 'active' 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20' 
                            : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20'
                        }`}
                        title={loc.status === 'active' ? 'Deactivate Hub' : 'Activate Hub'}
                      >
                        <ShieldAlert size={20} />
                      </motion.button>
                    </div>
                    <button className="text-xs font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors">
                      Sync Diagnostics
                    </button>
                  </div>
                </div>
              </CardHover>
            </SlideIn>
          ))}
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(false)}
                className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative z-10 border border-white/20 dark:border-zinc-800"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight leading-none">Initialize <span className="text-amber-600">Hub</span></h2>
                    <p className="text-sm text-gray-500 dark:text-zinc-500 mt-2 font-medium">Add a new operational sector to the grid.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3 ml-1">Hub Designation</label>
                        <input
                          required
                          className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. Skyline Terminal"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3 ml-1">City</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                            value={formData.city}
                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3 ml-1">State</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                            value={formData.state}
                            onChange={(e) => setFormData({...formData, state: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3 ml-1">Geo-Coordinates (Lat/Lng)</label>
                        <div className="grid grid-cols-2 gap-2">
                           <input
                            type="number" step="any"
                            placeholder="Lat"
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                            value={formData.lat}
                            onChange={(e) => setFormData({...formData, lat: e.target.value})}
                          />
                           <input
                            type="number" step="any"
                            placeholder="Lng"
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                            value={formData.lng}
                            onChange={(e) => setFormData({...formData, lng: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3 ml-1">Postal Code</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                            value={formData.pincode}
                            onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3 ml-1">Country</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 text-gray-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-bold shadow-inner"
                            value={formData.country}
                            onChange={(e) => setFormData({...formData, country: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-10">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all"
                    >
                      Abort
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-600/30 transition-all"
                    >
                      Initialize Hub
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
