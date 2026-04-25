
'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { MapPin, Plus, Trash2, ShieldAlert, Globe, Hash, Navigation, Edit2, Users, User, ArrowUp, ArrowDown, Settings2, Info, Activity, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function BranchesPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', city: '', state: '', country: 'India',
    pincode: '', lat: '', lng: '', status: 'active', dietaryType: 'both'
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [fetchingPersonnel, setFetchingPersonnel] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState(null);
  const [branchStats, setBranchStats] = useState(null);
  const [fetchingStats, setFetchingStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [personnelFormData, setPersonnelFormData] = useState({
    name: '', email: '', phone: '', monthlySalary: '', role: '', address1: ''
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

  const fetchPersonnel = async (locationId) => {
    try {
      setFetchingPersonnel(true);
      const res = await api.get(`/users?locationId=${locationId}`);
      setPersonnel(res.data.data);
    } catch (error) {
      toast.error("Failed to retrieve personnel ");
    } finally {
      setFetchingPersonnel(false);
    }
  };

  const handleLocationClick = (loc) => {
    setSelectedLocation(loc);
    fetchPersonnel(loc._id);
    fetchBranchIntelligence(loc._id);
  };

  const fetchBranchIntelligence = async (locationId) => {
    try {
      setFetchingStats(true);
      const res = await api.get(`/analytics/location-intelligence/${locationId}`);
      setBranchStats(res.data.data);
    } catch (error) {
      console.error("Failed to fetch branch metrics");
    } finally {
      setFetchingStats(false);
    }
  };

  const handleUserAction = async (userId, action) => {
    const loadToast = toast.loading(`${action === 'promote' ? 'Promoting' : action === 'demote' ? 'Demoting' : 'Removing'} personnel...`);
    try {
      if (action === 'promote') await api.patch(`/users/${userId}/promote`);
      else if (action === 'demote') await api.patch(`/users/${userId}/demote`);
      else if (action === 'delete') await api.delete(`/users/${userId}`);
      
      toast.success(`Personnel ${action}d successfully`, { id: loadToast });
      if (selectedLocation) fetchPersonnel(selectedLocation._id);
    } catch (error) {
      toast.error("Action restricted or protocol failed", { id: loadToast });
    }
  };

  const handlePersonnelEdit = (p) => {
    setSelectedPersonnel(p);
    setPersonnelFormData({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      monthlySalary: p.monthlySalary || '',
      role: p.role || '',
      address1: p.address1 || ''
    });
  };

  const handlePersonnelUpdate = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading("Updating personnel details...");
    try {
      await api.put(`/users/${selectedPersonnel._id}`, personnelFormData);
      toast.success("Personnel detials updated", { id: loadToast });
      setSelectedPersonnel(null);
      if (selectedLocation) fetchPersonnel(selectedLocation._id);
    } catch (error) {
      toast.error("Update failed", { id: loadToast });
    }
  };

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
      status: loc.status,
      dietaryType: loc.dietaryType || 'both'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const action = editingId ? 'Updating' : 'Initializing';
    const loadToast = toast.loading(`${action} location branch...`);

    try {
      const payload = {
        name: formData.name,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        pincode: formData.pincode,
        status: formData.status,
        dietaryType: formData.dietaryType,
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
      setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '', status: 'active', dietaryType: 'both' });
      fetchLocations();
      toast.success(`Branch ${editingId ? 'updated' : 'synchronized'} successfully!`, { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/locations/${id}`, { status });
      toast.success(`Branch state updated to ${status}`);
      fetchLocations();
    } catch (error) {
      toast.error('Failed to update branch state');
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
              <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <MapPin className="mr-4 text-amber-600" size={36} strokeWidth={2.5} /> Branch <span className="ml-3 text-amber-600">Management</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-3 font-medium flex items-center">
                <Target size={14} className="mr-2 text-amber-600" /> Manage and track all cafe branch locations.
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-1 max-w-3xl">
              <div className="relative flex-1">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Globe size={18} />
                </div>
                <input 
                  type="text"
                  placeholder="Search by city or branch name..."
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '', status: 'active', dietaryType: 'both' });
                  setShowModal(true);
                }}
                className="flex items-center justify-center px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all whitespace-nowrap"
              >
                <Plus className="mr-2" size={16} /> New Branch
              </motion.button>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {locations
            .filter(loc => 
              loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              loc.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
              loc.state.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((loc, i) => (
            <SlideIn key={loc._id} delay={i * 0.1}>
              <CardHover>
                <div 
                  onClick={() => handleLocationClick(loc)}
                  className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-3xl shadow-sm p-8 border border-zinc-200 dark:border-zinc-800 relative group overflow-hidden h-full flex flex-col transition-all hover:ring-2 hover:ring-amber-500/50 cursor-pointer"
                >
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
                    <div className="flex items-center gap-2 mt-2">
                       <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                         loc.dietaryType === 'veg' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:border-green-500/20' :
                         loc.dietaryType === 'non-veg' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' :
                         'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
                       }`}>
                         {loc.dietaryType === 'both' ? 'Veg & Non-Veg' : loc.dietaryType === 'veg' ? 'Veg Only' : 'Non-Veg Only'}
                       </span>
                    </div>
                    <div className="flex items-center gap-4 mt-6">
                       <div className="h-10 px-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                          <span className="text-xs font-black text-amber-600">View Branch</span>
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Personnel</span>
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-0.5">Assigned Force</span>
                       </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center relative z-10">
                    <div className="flex space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleEdit(loc); }}
                        className="p-3 rounded-xl transition-all shadow-sm bg-zinc-50 text-zinc-600 dark:hover:bg-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700"
                        title="Edit Branch"
                      >
                        <Edit2 size={18} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleStatusChange(loc._id, loc.status === 'active' ? 'inactive' : 'active'); }}
                        className={`p-3 rounded-xl transition-all shadow-sm ${loc.status === 'active'
                          ? 'bg-rose-50 text-rose-600 dark:hover:bg-rose-900 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20'
                          }`}
                        title={loc.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        <ShieldAlert size={18} />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </CardHover>
            </SlideIn>
          ))}
        </div>

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
                className="bg-white dark:bg-zinc-950 rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl relative z-10 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
                      {editingId ? 'Edit' : 'Create'} <span className="text-amber-600">Branch</span>
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Update branch details below.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                    <Plus className="rotate-45 text-zinc-400" size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Branch Name</label>
                        <input
                          required
                          className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Bandra Cafe"
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
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Postal Code</label>
                        <input
                          required
                          className="w-full px-5 py-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all font-bold"
                          value={formData.pincode}
                          onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        />
                      </div>
                      <PremiumSelect 
                        label="Status"
                        value={formData.status}
                        onChange={(val) => setFormData({ ...formData, status: val })}
                        options={[
                          { label: 'Active', value: 'active' },
                          { label: 'Inactive', value: 'inactive' }
                        ]}
                      />
                      <PremiumSelect 
                        label="Dietary Focus"
                        value={formData.dietaryType}
                        onChange={(val) => setFormData({ ...formData, dietaryType: val })}
                        options={[
                          { label: 'Veg & Non-Veg', value: 'both' },
                          { label: 'Pure Veg', value: 'veg' },
                          { label: 'Non-Veg Specialty', value: 'non-veg' }
                        ]}
                      />
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
                      {editingId ? 'Update Branch' : 'Confirm Branch'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedLocation && (
            <div className="fixed inset-0 z-[110] flex justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedLocation(null)}
                className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 h-full shadow-2xl border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto custom-scrollbar"
              >
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/20">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{selectedLocation.name}</h2>
                        <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mt-2">Branch Overview</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => setSelectedLocation(null)}
                    className="p-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 transition-colors"
                   >
                     <Plus className="rotate-45" size={24} />
                   </button>
                </div>

                <div className="p-8 space-y-12">
                   <section>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                          <ShieldAlert size={14} className="text-amber-600" /> Management
                        </h3>
                      </div>
                      
                      {fetchingPersonnel ? (
                        <div className="h-24 bg-zinc-50 dark:bg-zinc-900 rounded-3xl animate-pulse" />
                      ) : personnel.filter(p => p.role === 'location_admin' || p.role === 'branch_admin').length === 0 ? (
                        <div className="p-6 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 text-xs italic">
                          No manager assigned.
                        </div>
                      ) : (
                        personnel.filter(p => p.role === 'location_admin' || p.role === 'branch_admin').map(admin => (
                          <div key={admin._id} className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-black">
                                {admin.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{admin.name}</p>
                                  <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded-md border border-amber-500/20">
                                    Branch Admin
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 font-medium">{admin.email}</p>
                              </div>
                            </div>
                               <div className="flex gap-2">
                               <motion.button 
                                whileHover={{ scale: 1.1 }}
                                onClick={() => handleUserAction(admin._id, 'demote')}
                                className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 text-rose-500 shadow-sm border border-zinc-100 dark:border-zinc-700" title="Demote"
                               >
                                 <ArrowDown size={14} />
                               </motion.button>
                            </div>
                          </div>
                        ))
                      )}
                   </section>

                   <section>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                          <Users size={14} className="text-blue-500" /> Operational Staff
                        </h3>
                        <span className="text-[10px] font-black text-zinc-400">{personnel.filter(p => p.role === 'staff').length} Total</span>
                      </div>

                      <div className="space-y-4">
                        {fetchingPersonnel ? (
                          [1,2,3].map(i => <div key={i} className="h-20 bg-zinc-50 dark:bg-zinc-900 rounded-2xl animate-pulse" />)
                        ) : personnel.filter(p => p.role === 'staff').length === 0 ? (
                          <div className="p-10 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                             <p className="text-zinc-500 text-xs font-medium">No records found.</p>
                          </div>
                        ) : (
                          personnel.filter(p => p.role === 'staff').map(staff => (
                            <div key={staff._id} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                               <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                                    {staff.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{staff.name}</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    onClick={() => handleUserAction(staff._id, 'promote')}
                                    className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" title="Promote"
                                  >
                                    <ArrowUp size={14} />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    onClick={() => handleUserAction(staff._id, 'delete')}
                                    className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10" title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </motion.button>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                   </section>

                   <section className="dark:bg-zinc-950 bg-zinc-50 rounded-[2.5rem] p-10 border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
                      <div className="relative z-10 space-y-10">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Branch Intelligence</h3>
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-10 gap-x-8">
                           <SlideIn delay={0.1}>
                              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Total Staff</p>
                              <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                                {personnel.length}
                              </p>
                           </SlideIn>
                           <SlideIn delay={0.2}>
                              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Attendance %</p>
                              <p className="text-4xl font-black text-amber-500 tracking-tighter">
                                {fetchingStats ? '...' : `${branchStats?.attendanceRate?.toFixed(1) || '0.0'}%`}
                              </p>
                           </SlideIn>
                           <SlideIn delay={0.3}>
                              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Revenue (Monthly)</p>
                              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500 tracking-tighter italic">
                                ₹{fetchingStats ? '...' : (branchStats?.revenue || 0).toLocaleString()}
                              </p>
                           </SlideIn>
                           <SlideIn delay={0.4}>
                              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Net Profit</p>
                              <p className="text-2xl font-black text-blue-600 dark:text-blue-500 tracking-tighter italic">
                                ₹{fetchingStats ? '...' : (branchStats?.profit || 0).toLocaleString()}
                              </p>
                           </SlideIn>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 p-12 opacity-5 dark:opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <Activity size={120} className="text-amber-600" />
                      </div>
                   </section>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedPersonnel && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
               <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPersonnel(null)}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xl"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[2.5rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-10">
                   <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-2xl font-black text-amber-600 uppercase">
                     {selectedPersonnel.name.charAt(0)}
                   </div>
                   <div>
                     <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{selectedPersonnel.name}</h2>
                     <p className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest mt-2">Staff Details</p>
                   </div>
                </div>

                <form onSubmit={handlePersonnelUpdate} className="space-y-6">
                   <div className="grid grid-cols-1 gap-6">
                      <PremiumSelect 
                        label="Assigned Role"
                        value={personnelFormData.role}
                        onChange={(val) => setPersonnelFormData({ ...personnelFormData, role: val })}
                        options={[
                          { label: 'Operational Staff', value: 'staff' },
                          { label: 'Branch Admin', value: 'branch_admin' }
                        ]}
                      />
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Monthly Yield (Salary)</label>
                        <div className="relative">
                          <input 
                            type="number"
                            className="w-full pl-10 pr-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 text-sm font-black outline-none focus:ring-2 focus:ring-amber-500/20 text-zinc-900 dark:text-zinc-100"
                            value={personnelFormData.monthlySalary}
                            onChange={(e) => setPersonnelFormData({...personnelFormData, monthlySalary: e.target.value})}
                          />
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Contact Protocol</label>
                          <input 
                            className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 text-zinc-900 dark:text-zinc-100"
                            value={personnelFormData.phone}
                            onChange={(e) => setPersonnelFormData({...personnelFormData, phone: e.target.value})}
                            placeholder="Phone Number"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Identity Stamp (Email)</label>
                          <input 
                            disabled
                            className="w-full px-5 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold outline-none opacity-50 cursor-not-allowed text-zinc-500 dark:text-zinc-400"
                            value={personnelFormData.email}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">Residential Sector</label>
                        <input 
                          className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 text-zinc-900 dark:text-zinc-100"
                          value={personnelFormData.address1}
                          onChange={(e) => setPersonnelFormData({...personnelFormData, address1: e.target.value})}
                          placeholder="Primary Address"
                        />
                      </div>
                   </div>

                   <div className="flex gap-4 pt-6">
                      <button 
                        type="button"
                        onClick={() => setSelectedPersonnel(null)}
                        className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all border border-zinc-200 dark:border-zinc-800"
                      >
                        Abort
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-4 rounded-2xl bg-amber-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all"
                      >
                        Commit Changes
                      </button>
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
