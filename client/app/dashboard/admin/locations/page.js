
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import { MapPin, Plus, Trash2, ShieldAlert, Globe, Hash, Navigation, Edit2, Users, User, ArrowUp, ArrowDown, Settings2, Info, Activity, Target, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function BranchesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (user && !['super_admin', 'admin'].includes(user.role) && !user.permissions?.manageBranches) {
      toast.error('Access denied. Admin permission required.');
      router.push('/dashboard');
    }
  }, [user, router]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cafes, setCafes] = useState([]);
  const [formData, setFormData] = useState({
    name: '', city: '', state: '', country: 'India',
    pincode: '', lat: '', lng: '', status: 'active', dietaryType: 'both', cafe: ''
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [staff, setStaff] = useState([]);
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [branchStats, setBranchStats] = useState(null);
  const [fetchingStats, setFetchingStats] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFormData, setStaffFormData] = useState({
    name: '', email: '', phone: '', monthlySalary: '', role: '', address1: ''
  });
  const [staffTab, setStaffTab] = useState('staff'); // 'staff' or 'chef'

  const fetchLocations = async () => {
    progress.start();
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations list");
    } finally {
      setLoading(false);
      progress.done();
    }
  };

  // Cafes (brands) this user can create branches under. super_admin: all cafes;
  // admin: only the cafe(s) they administer.
  const fetchCafes = async () => {
    try {
      const res = await api.get('/cafes');
      setCafes(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch cafes');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
      fetchCafes();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const fetchStaff = async (locationId) => {
    try {
      setFetchingStaff(true);
      const res = await api.get(`/users?locationId=${locationId}`);
      setStaff(res.data.data || []);
    } catch (error) {
      toast.error("Could not load staff");
    } finally {
      setFetchingStaff(false);
    }
  };

  const handleLocationClick = (loc) => {
    setSelectedLocation(loc);
    fetchStaff(loc._id);
    fetchBranchInformation(loc._id);
  };

  const fetchBranchInformation = async (locationId) => {
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
    const loadToast = toast.loading(`${action === 'promote' ? 'Promoting' : action === 'demote' ? 'Demoting' : 'Removing'} staff...`);
    try {
      if (action === 'promote') await api.patch(`/users/${userId}/promote`);
      else if (action === 'demote') await api.patch(`/users/${userId}/demote`);
      else if (action === 'delete') await api.delete(`/users/${userId}`);
      
      toast.success(`Staff ${action}d successfully`, { id: loadToast });
      if (selectedLocation) fetchStaff(selectedLocation._id);
    } catch (error) {
      toast.error("Something went wrong. Please try again.", { id: loadToast });
    }
  };

  const handleStaffEdit = (p) => {
    setSelectedStaff(p);
    setStaffFormData({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      monthlySalary: p.monthlySalary || '',
      role: p.role || '',
      address1: p.address1 || ''
    });
  };

  const handleStaffUpdate = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading("Saving staff details...");
    try {
      await api.put(`/users/${selectedStaff._id}`, staffFormData);
      toast.success("Staff details updated", { id: loadToast });
      setSelectedStaff(null);
      if (selectedLocation) fetchStaff(selectedLocation._id);
    } catch (error) {
      toast.error("Could not update. Please try again.", { id: loadToast });
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
      dietaryType: loc.dietaryType || 'both',
      cafe: loc.cafe?._id || loc.cafe || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const action = editingId ? 'Updating' : 'Creating';
    const loadToast = toast.loading(`${action} branch...`);

    // A cafe is required when creating a new branch (the branch's brand owner).
    if (!editingId && !formData.cafe) {
      toast.error('Please choose which cafe this branch belongs to', { id: loadToast });
      return;
    }

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
        // Include cafe so a super-admin / multi-cafe admin can reassign the branch.
        await api.patch(`/locations/${editingId}`, { ...payload, cafe: formData.cafe });
      } else {
        await api.post('/locations', { ...payload, cafe: formData.cafe });
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '', status: 'active', dietaryType: 'both', cafe: '' });
      fetchLocations();
      toast.success(`Branch ${editingId ? 'updated' : 'created'} successfully!`, { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/locations/${id}`, { status });
      toast.success(`Branch status updated to ${status}`);
      fetchLocations();
    } catch (error) {
      toast.error('Could not update branch status. Please try again.');
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
                  <h1 className="text-3xl font-bold text-(--color-text-primary) flex items-center tracking-tight leading-none">
                <MapPin className="mr-4 text-primary" size={36} strokeWidth={2.5} /> Branch <span className="ml-3 text-primary">Management</span>
              </h1>
              <p className="text-(--color-text-secondary) text-sm mt-3 font-medium flex items-center">
                <Target size={14} className="mr-2 text-primary" /> Manage and track all cafe branch locations.
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-1 max-w-3xl">
              <div className="relative flex-1">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted)">
                  <Globe size={18} />
                </div>
                <input 
                  type="text"
                  placeholder="Search by city or branch name..."
                  className="w-full pl-12 pr-6 py-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-(--color-text-primary)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', city: '', state: '', country: 'India', pincode: '', lat: '', lng: '', status: 'active', dietaryType: 'both', cafe: cafes.length === 1 ? cafes[0]._id : '' });
                  setShowModal(true);
                }}
                className="flex items-center justify-center px-8 py-4 bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) rounded-xl font-bold uppercase tracking-normal text-[10px] shadow-sm  hover:opacity-90 transition-all whitespace-nowrap"
              >
                <Plus className="mr-2" size={16} /> New Branch
              </motion.button>
            </div>
          </div>
        </SlideIn>

        <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface)/40  shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Branch Info</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Cafe</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Location</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Type</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Status</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations
                .filter(loc =>
                  (loc.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (loc.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (loc.state || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((loc, i) => (
                  <motion.tr 
                    key={loc._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleLocationClick(loc)}
                    className="group border-b border-(--color-border) hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner transition-transform">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-(--color-text-primary)">{loc.name}</p>
                          <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-0.5">ID: {loc._id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {loc.cafe ? (
                        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-normal px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          <Store size={12} /> {loc.cafe.name || 'Cafe'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-(--color-text-muted) italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <p className="text-sm font-bold text-(--color-text-primary)">{loc.city}</p>
                        <p className="text-[10px] font-medium text-(--color-text-muted)">{loc.state}, {loc.country}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[9px] font-bold uppercase tracking-normal px-3 py-1 rounded-full border shadow-sm ${
                        loc.dietaryType === 'veg' ? 'bg-success/10 text-success border-success/20' :
                        loc.dietaryType === 'non-veg' ? 'bg-danger/10 text-danger border-danger/20' :
                        'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        {loc.dietaryType === 'both' ? 'Mixed' : loc.dietaryType === 'veg' ? 'Veg' : 'Non-Veg'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-normal border shadow-sm ${loc.status === 'active'
                        ? 'bg-success/10 text-success border-success/20'
                        : 'bg-danger/10 text-danger border-danger/20'
                        }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${loc.status === 'active' ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                        {loc.status}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2  transition-opacity">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); handleEdit(loc); }}
                          className="p-2.5 rounded-xl bg-(--color-surface-soft) text-(--color-text-secondary) border border-(--color-border) hover:text-primary transition-all"
                        >
                          <Edit2 size={16} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(loc._id, loc.status === 'active' ? 'inactive' : 'active'); }}
                          className={`p-2.5 rounded-xl transition-all shadow-sm ${loc.status === 'active'
                            ? 'bg-danger/10 text-danger border border-danger/20'
                            : 'bg-success/10 text-success border border-success/20'
                            }`}
                        >
                          <ShieldAlert size={16} />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
          {locations.length === 0 && (
            <div className="p-20 text-center text-(--color-text-muted)">
              <Globe size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-normal">No branches found matching search</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
                <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(false)}
                className="absolute inset-0 bg-black/80 "
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 40 }}
                className="bg-(--color-surface) rounded-xl p-10 max-w-2xl w-full shadow-sm relative z-10 border border-(--color-border)"
              >
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-3xl font-bold text-(--color-text-primary) tracking-tight leading-none">
                      {editingId ? 'Edit' : 'Create'} <span className="text-primary">Branch</span>
                    </h2>
                    <p className="text-sm text-(--color-text-muted) mt-2 font-medium">Update branch details below.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-(--color-surface-soft) transition-colors">
                    <Plus className="rotate-45 text-(--color-text-muted)" size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Cafe picker: always on create; on edit only when more than one
                      cafe is available (i.e. a reassignment is actually possible). */}
                  {(!editingId || cafes.length > 1) && (
                    <PremiumSelect
                      label={editingId ? 'Cafe (Brand) — reassign' : 'Cafe (Brand)'}
                      placeholder={cafes.length === 0 ? 'No cafe available — ask a super-admin' : 'Select the cafe this branch belongs to'}
                      value={formData.cafe}
                      onChange={(val) => setFormData({ ...formData, cafe: val })}
                      options={cafes.map((c) => ({ label: c.name, value: c._id }))}
                    />
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Branch Name</label>
                        <input
                          required
                          className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-bg-soft) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Bandra Cafe"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">City</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-bg-soft) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">State</label>
                          <input
                            required
                            className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-bg-soft) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Postal Code</label>
                        <input
                          required
                          className="w-full px-5 py-4 rounded-xl border border-(--color-border) bg-(--color-bg-soft) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-bold"
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
                          { label: 'Non-Veg', value: 'non-veg' }
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
                      className="flex-1 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) hover:bg-(--color-bg-soft) transition-all"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-normal text-(--color-on-primary) dark:text-(--color-on-primary) bg-primary hover:opacity-90 shadow-sm  transition-all"
                    >
                      {editingId ? 'Update Branch' : 'Add Branch'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedLocation && (
            <div className="fixed inset-0 z-110 flex justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedLocation(null)}
                className="absolute inset-0 bg-black/60 "
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full max-w-2xl bg-(--color-surface) h-full shadow-sm border-l border-(--color-border) overflow-y-auto custom-scrollbar"
              >
                <div className="p-8 border-b border-(--color-border) sticky top-0 bg-(--color-surface)/80  z-10 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-(--color-on-primary) dark:text-(--color-on-primary) shadow-lg ">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-(--color-text-primary) tracking-tight leading-none">{selectedLocation.name}</h2>
                        <p className="text-[10px] font-bold uppercase text-primary tracking-normal mt-2">
                          {selectedLocation.cafe?.name ? `${selectedLocation.cafe.name} · Branch Overview` : 'Branch Overview'}
                        </p>
                      </div>
                   </div>
                   <button 
                    onClick={() => setSelectedLocation(null)}
                    className="p-3 rounded-xl hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-colors"
                   >
                     <Plus className="rotate-45" size={24} />
                   </button>
                </div>

                <div className="p-8 space-y-12">
                   <section>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                          <ShieldAlert size={14} className="text-primary" /> Management
                        </h3>
                      </div>
                      
                      {fetchingStaff ? (
                        <div className="h-24 bg-(--color-surface-soft) rounded-xl animate-pulse" />
                      ) : staff.filter(p => p.role === 'location_admin' || p.role === 'branch_admin').length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed border-(--color-border) text-center text-(--color-text-muted) text-xs italic">
                          No manager assigned.
                        </div>
                      ) : (
                        staff.filter(p => p.role === 'location_admin' || p.role === 'branch_admin').map(admin => (
                          <div key={admin._id} className="p-6 bg-(--color-surface-soft) rounded-xl border border-(--color-border) flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {admin.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-(--color-text-primary)">{admin.name}</p>
                                  <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/20">
                                    Branch Admin
                                  </span>
                                </div>
                                <p className="text-[10px] text-(--color-text-muted) font-medium">{admin.email}</p>
                              </div>
                            </div>
                               <div className="flex gap-2">
                               <motion.button 
                                whileHover={{ scale: 1.1 }}
                                onClick={() => handleUserAction(admin._id, 'demote')}
                                className="p-2.5 rounded-xl bg-(--color-surface) text-danger shadow-sm border border-(--color-border)" title="Demote"
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
                        <div className="flex flex-col">
                          <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                            <Users size={14} className={staffTab === 'staff' ? "text-primary-dark" : "text-primary"} /> Staff Members
                          </h3>
                        </div>
                        <div className="flex bg-(--color-surface-soft) p-1 rounded-xl border border-(--color-border)">
                          <button 
                            onClick={() => setStaffTab('staff')}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-normal transition-all ${staffTab === 'staff' ? 'bg-(--color-surface) text-primary-dark shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                          >
                            Staff ({staff.filter(p => p.role === 'staff').length})
                          </button>
                          <button 
                            onClick={() => setStaffTab('chef')}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-normal transition-all ${staffTab === 'chef' ? 'bg-(--color-surface) text-primary shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                          >
                            Chefs ({staff.filter(p => p.role === 'chef').length})
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {fetchingStaff ? (
                          [1,2,3].map(i => <div key={i} className="h-20 bg-(--color-surface-soft) rounded-xl animate-pulse" />)
                        ) : staff.filter(p => p.role === staffTab).length === 0 ? (
                          <div className="p-10 rounded-xl border border-dashed border-(--color-border) text-center">
                             <p className="text-(--color-text-muted) text-xs font-medium">No {staffTab} records found.</p>
                          </div>
                        ) : (
                          staff.filter(p => p.role === staffTab).map(member => (
                            <div key={member._id} className={`p-5 bg-(--color-surface) border border-(--color-border) rounded-xl flex items-center justify-between group hover:border-primary/30 transition-all`}>
                               <div className="flex items-center gap-4">
                                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs ${staffTab === 'staff' ? 'bg-primary-dark/10 text-primary-dark' : 'bg-primary/10 text-primary'}`}>
                                    {member.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-(--color-text-primary)">{member.name}</p>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2 transition-opacity">
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    onClick={() => handleUserAction(member._id, 'promote')}
                                    className="p-2 rounded-lg bg-success/10 text-success" title="Promote"
                                  >
                                    <ArrowUp size={14} />
                                  </motion.button>
                                  <motion.button 
                                    whileHover={{ scale: 1.1 }}
                                    onClick={() => handleUserAction(member._id, 'delete')}
                                    className="p-2 rounded-lg bg-danger/10 text-danger" title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </motion.button>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                   </section>

                   <section className="bg-(--color-surface-soft) rounded-xl p-10 border border-(--color-border) relative overflow-hidden group">
                      <div className="relative z-10 space-y-10">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Branch Information</h3>
                          <div className="h-2 w-2 rounded-full bg-success animate-pulse shadow-lg " />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-10 gap-x-8">
                           <SlideIn delay={0.1}>
                              <p className="text-[10px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-2">Total Staff</p>
                              <p className="text-4xl font-bold text-(--color-text-primary) tracking-tight">
                                {staff.length}
                              </p>
                           </SlideIn>
                           <SlideIn delay={0.2}>
                              <p className="text-[10px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-2">Attendance %</p>
                              <p className="text-4xl font-bold text-primary tracking-tight">
                                {fetchingStats ? '...' : `${branchStats?.attendanceRate?.toFixed(1) || '0.0'}%`}
                              </p>
                           </SlideIn>
                           <SlideIn delay={0.3}>
                              <p className="text-[10px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-2">Revenue (Monthly)</p>
                              <p className="text-2xl font-bold text-success tracking-tight italic">
                                ₹{fetchingStats ? '...' : (branchStats?.revenue || 0).toLocaleString()}
                              </p>
                           </SlideIn>
                           <SlideIn delay={0.4}>
                              <p className="text-[10px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-2">Net Profit</p>
                              <p className="text-2xl font-bold text-primary-dark tracking-tight italic">
                                ₹{fetchingStats ? '...' : (branchStats?.profit || 0).toLocaleString()}
                              </p>
                           </SlideIn>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 p-12 opacity-5 dark:opacity-10 transition-transform duration-700">
                        <Activity size={120} className="text-primary" />
                      </div>
                   </section>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedStaff && (
            <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
               <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedStaff(null)}
                className="absolute inset-0 bg-black/80 "
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-10 w-full max-w-lg bg-(--color-surface) rounded-xl p-10 border border-(--color-border) shadow-sm"
              >
                <div className="flex items-center gap-4 mb-10">
                   <div className="h-16 w-16 rounded-xl bg-(--color-surface-soft) flex items-center justify-center text-2xl font-bold text-primary uppercase">
                     {selectedStaff.name.charAt(0)}
                   </div>
                   <div>
                     <h2 className="text-xl font-bold text-(--color-text-primary) tracking-tight leading-none">{selectedStaff.name}</h2>
                     <p className="text-[10px] font-bold uppercase text-(--color-text-muted) tracking-normal mt-2">Staff Details</p>
                   </div>
                </div>

                <form onSubmit={handleStaffUpdate} className="space-y-6">
                   <div className="grid grid-cols-1 gap-6">
                      <PremiumSelect 
                        label="Assigned Role"
                        value={staffFormData.role}
                        onChange={(val) => setStaffFormData({ ...staffFormData, role: val })}
                        options={[
                          { label: 'Staff', value: 'staff' },
                          { label: 'Branch Admin', value: 'branch_admin' }
                        ]}
                      />
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Monthly Salary</label>
                        <div className="relative">
                          <input 
                            type="number"
                            className="w-full pl-10 pr-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 text-(--color-text-primary)"
                            value={staffFormData.monthlySalary}
                            onChange={(e) => setStaffFormData({...staffFormData, monthlySalary: e.target.value})}
                          />
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) font-bold">₹</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Phone Number</label>
                          <input 
                            className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 text-(--color-text-primary)"
                            value={staffFormData.phone}
                            onChange={(e) => setStaffFormData({...staffFormData, phone: e.target.value})}
                            placeholder="Phone Number"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Email Address</label>
                          <input 
                            disabled
                            className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-bold outline-none opacity-50 cursor-not-allowed text-(--color-text-muted)"
                            value={staffFormData.email}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Full Address</label>
                        <input 
                          className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 text-(--color-text-primary)"
                          value={staffFormData.address1}
                          onChange={(e) => setStaffFormData({...staffFormData, address1: e.target.value})}
                          placeholder="Primary Address"
                        />
                      </div>
                   </div>

                   <div className="flex gap-4 pt-6">
                      <button 
                        type="button"
                        onClick={() => setSelectedStaff(null)}
                        className="flex-1 py-4 rounded-xl bg-(--color-surface-soft) text-xs font-bold uppercase tracking-normal text-(--color-text-muted) hover:bg-(--color-bg-soft) transition-all border border-(--color-border)"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 py-4 rounded-xl bg-primary text-(--color-on-primary) dark:text-(--color-on-primary) text-xs font-bold uppercase tracking-normal shadow-lg  hover:opacity-90 transition-all"
                      >
                        Save Changes
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
