'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { MapPin, Plus, Trash2, ShieldAlert, Globe, Hash, Navigation, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', city: '', state: '', country: 'India',
    pincode: '', lat: '', lng: '', status: 'active'
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

  const handleEdit = (loc) => {
    setEditingId(loc._id);
    setFormData({
      name: loc.name,
      city: loc.city,
      state: loc.state,
      country: loc.country || 'India',
      pincode: loc.pincode || '',
      lat: loc.geoCoordinates?.lat || '',
      lng: loc.geoCoordinates?.lng || '',
      status: loc.status
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const action = editingId ? 'Updating' : 'Initializing';
    const loadToast = toast.loading(`${action} location hub...`);

    try {
      const payload = {
        name: formData.name,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        pincode: formData.pincode,
        status: formData.status,
        geoCoordinates: formData.lat && formData.lng ? {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        } : undefined
      };

      if (editingId) {
        await api.patch(`/locations/${editingId}`, payload);
      } else {
        await api.post('/locations', payload);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '', status: 'active' });
      fetchLocations();
      toast.success(`Location ${editingId ? 'updated' : 'synchronized'} successfully!`, { id: loadToast });
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
              <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center">
                <MapPin className="mr-3 text-amber-600" size={32} />
                Global <span className="ml-2 text-amber-600">Matrices</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-1">Manage and monitor operational hubs across the network.</p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '', status: 'active' });
                setShowModal(true);
              }}
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
                <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-3xl shadow-sm p-8 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden h-full flex flex-col transition-colors">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-amber-600">
                    <MapPin size={120} />
                  </div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="h-14 w-14 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 shadow-inner">
                      <MapPin size={28} />
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${loc.status === 'active'
                      ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:border-green-500/20'
                      : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
                      }`}>
                      {loc.status}
                    </div>
                  </div>

                  <div className="mt-8 relative z-10 flex-1">
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">{loc.name}</h3>
                    <div className="flex items-center text-zinc-500 dark:text-zinc-500 mt-3 text-sm font-bold uppercase tracking-wider">
                      <Navigation size={14} className="mr-2 text-amber-600" />
                      {loc.city}, {loc.state}
                    </div>
                    {loc.pincode && (
                      <div className="flex items-center text-[10px] font-black text-zinc-400 dark:text-zinc-600 mt-2 uppercase tracking-[0.2em]">
                        <Hash size={12} className="mr-1.5" /> PIN: {loc.pincode}
                      </div>
                    )}
                  </div>

                  <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center relative z-10">
                    <div className="flex space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(loc)}
                        className="p-3 rounded-xl transition-all shadow-sm bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700"
                        title="Edit Hub"
                      >
                        <Edit2 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleStatusChange(loc._id, loc.status === 'active' ? 'inactive' : 'active')}
                        className={`p-3 rounded-xl transition-all shadow-sm ${loc.status === 'active'
                          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20'
                          }`}
                        title={loc.status === 'active' ? 'Deactivate Hub' : 'Activate Hub'}
                      >
                        <ShieldAlert size={18} />
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

        {/* Edit/Create Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(false)}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative z-10 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
                      {editingId ? 'Modify' : 'Initialize'} <span className="text-amber-600">Hub</span>
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2 font-medium">Update operational sector parameters within the grid.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <Plus className="rotate-45 text-zinc-400" size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Hub Designation</label>
                        <input
                          required
                          className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Skyline Terminal"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">City</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">State</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Current Status</label>
                        <select
                          className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold appearance-none"
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="hold">On Hold</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Geo-Coordinates (Lat/Lng)</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="number" step="any"
                            placeholder="Lat"
                            className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                            value={formData.lat}
                            onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                          />
                          <input
                            type="number" step="any"
                            placeholder="Lng"
                            className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                            value={formData.lng}
                            onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Postal Code</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                            value={formData.pincode}
                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Country</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                    >
                      Abort
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-600/30 transition-all"
                    >
                      {editingId ? 'Update Parameters' : 'Initialize Hub'}
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
