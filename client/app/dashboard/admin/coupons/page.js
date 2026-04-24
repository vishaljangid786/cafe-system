'use client';
import {
  Tag, Search, Plus, Filter,
  Edit2, Trash2, CheckCircle2, XCircle,
  Calendar, Ticket, Percent, DollarSign,
  Save, X, Layers, Package, BarChart3, Clock,
  ArrowRight, Users, Zap,
  Target
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

export default function CouponsManagementPage() {
  const { selectedLocation } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Form state for complex fields
  const [appliesToType, setAppliesToType] = useState('full_order'); // 'full_order', 'items'
  const [selectedItems, setSelectedItems] = useState([]);

  // Live preview state
  const [previewData, setPreviewData] = useState({
    code: '',
    discountValue: 0,
    discountType: 'percentage',
    maxDiscount: 0
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPreviewData(prev => ({ ...prev, [name]: value }));
  };

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/coupons');
      setCoupons(res.data.data);
    } catch (error) {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      setItemsLoading(true);
      const params = {};
      if (selectedLocation) params.locationId = selectedLocation._id || selectedLocation;
      
      const res = await api.get('/menu', { params });
      if (res.data.success) {
        setMenuItems(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      toast.error('Failed to sync menu inventory');
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    fetchMenuItems();
  }, [selectedLocation]);

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const couponData = {
      code: formData.get('code'),
      discountType: formData.get('discountType'),
      discountValue: Number(formData.get('discountValue')),
      minOrderAmount: Number(formData.get('minOrderAmount')),
      maxDiscount: Number(formData.get('maxDiscount')) || null,
      usageLimit: Number(formData.get('usageLimit')) || null,
      expiryDate: formData.get('expiryDate'),
      appliesTo: {
        items: appliesToType === 'items' ? selectedItems : [],
        categories: []
      },
      isActive: formData.get('isActive') === 'on'
    };

    const loadToast = toast.loading(editingCoupon ? 'Updating coupon...' : 'Creating coupon...');
    try {
      if (editingCoupon) {
        await api.patch(`/coupons/${editingCoupon._id}`, couponData);
        toast.success('Coupon updated', { id: loadToast });
      } else {
        await api.post('/coupons', couponData);
        toast.success('Coupon created', { id: loadToast });
      }
      setShowCouponModal(false);
      setEditingCoupon(null);
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed', { id: loadToast });
    }
  };

  const handleDelete = async (id) => {
    const loadToast = toast.loading('Deleting coupon...');
    try {
      await api.delete(`/coupons/${id}`);
      toast.success('Coupon deleted', { id: loadToast });
      fetchCoupons();
    } catch (error) {
      toast.error('Failed to delete coupon', { id: loadToast });
    }
    setShowDeleteConfirm(null);
  };

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = coupon.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' ||
      (statusFilter === 'Active' && coupon.isActive) ||
      (statusFilter === 'Inactive' && !coupon.isActive);
    return matchesSearch && matchesStatus;
  });

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setPreviewData({
      code: coupon.code,
      discountValue: coupon.discountValue,
      discountType: coupon.discountType,
      maxDiscount: coupon.maxDiscount
    });
    if (coupon.appliesTo?.items?.length > 0) {
      setAppliesToType('items');
      setSelectedItems(coupon.appliesTo.items.map(i => i._id || i));
    } else {
      setAppliesToType('full_order');
      setSelectedItems([]);
    }
    setShowCouponModal(true);
  };

  const totalUsage = coupons.reduce((acc, c) => acc + (c.usedCount || 0), 0);
  const expiringSoon = coupons.filter(c => {
    const expiry = new Date(c.expiryDate);
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    return expiry < soon && expiry > new Date();
  }).length;

  if (loading && coupons.length === 0) return (
    <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
              <Tag className="mr-4 text-amber-600" size={36} strokeWidth={2.5} /> Coupon <span className="ml-3 text-amber-600">Management</span>
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mt-3 font-medium flex items-center">
              <Target size={14} className="mr-2 text-amber-600" /> Create and manage discount coupons for customers.
            </p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { 
              setEditingCoupon(null); 
              setPreviewData({ code: '', discountValue: 0, discountType: 'percentage', maxDiscount: 0 });
              setSelectedItems([]);
              setAppliesToType('full_order');
              setShowCouponModal(true); 
            }}
            className="!py-4 px-8 shadow-2xl shadow-amber-600/20"
          >
            Create Coupon
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500"><Ticket size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Active Coupons</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{coupons.filter(c => c.isActive).length}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Coupons Live</p>
            </div>
          </Card>
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><BarChart3 size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Redemptions</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{totalUsage}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Total Redemptions</p>
            </div>
          </Card>
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Zap size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Trending</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter">
                {coupons.sort((a,b) => (b.usedCount || 0) - (a.usedCount || 0))[0]?.code || 'N/A'}
              </h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Top Performing Coupon</p>
            </div>
          </Card>
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500"><Clock size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Expiring</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{expiringSoon}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Expiring within 7 days</p>
            </div>
          </Card>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search by code..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-6 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold text-sm text-zinc-900 dark:text-zinc-100 appearance-none min-w-[200px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="bg-white dark:bg-zinc-900/30 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm transition-colors">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Coupon Code</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Discount</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Usage</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Validity</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredCoupons.map((coupon, i) => (
                <motion.tr
                  key={coupon._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-zinc-100 dark:hover:bg-zinc-800/20 transition-colors group"
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Tag size={16} />
                      </div>
                      <span className="text-sm font-black tracking-widest text-zinc-900 dark:text-zinc-100">{coupon.code}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {coupon.discountType === 'percentage' ? <Percent size={14} className="text-amber-500" /> : <DollarSign size={14} className="text-amber-500" />}
                      {coupon.discountValue}{coupon.discountType === 'percentage' ? '%' : ' OFF'}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 transition-all duration-1000" 
                          style={{ width: `${coupon.usageLimit ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">{coupon.usedCount} / {coupon.usageLimit || '∞'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                      <Calendar size={14} />
                      {new Date(coupon.expiryDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${coupon.isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                      {coupon.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-600 text-zinc-500 dark:text-zinc-400 hover:text-white transition-all shadow-sm"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(coupon._id)}
                        className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <Modal
          isOpen={showCouponModal}
          onClose={() => { setShowCouponModal(false); setEditingCoupon(null); }}
          title={editingCoupon ? "Update Coupon" : "Add New Coupon"}
          maxWidth="max-w-4xl"
        >
          <form onSubmit={handleCouponSubmit} className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Left Column: Configuration Matrix */}
              <div className="lg:col-span-7 space-y-10">
                
                {/* 1. Identity & Magnitude */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Ticket size={18} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Identity & Magnitude</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Coupon Code</label>
                      <div className="relative group">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                        <input 
                          required
                          name="code"
                          defaultValue={editingCoupon?.code}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20 font-black uppercase tracking-widest"
                          placeholder="e.g. SUMMER50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Discount Magnitude</label>
                      <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="relative flex-1">
                          <input 
                            required
                            name="discountValue"
                            type="number"
                            defaultValue={editingCoupon?.discountValue}
                            onChange={handleInputChange}
                            className="w-full pl-4 pr-12 py-3 bg-transparent text-zinc-900 dark:text-zinc-100 outline-none font-black text-lg"
                            placeholder="0"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <select 
                              name="discountType" 
                              defaultValue={editingCoupon?.discountType || 'percentage'}
                              onChange={handleInputChange}
                              className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-amber-500 hover:text-black transition-all"
                            >
                              <option value="percentage">%</option>
                              <option value="fixed">₹</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Fiscal Constraints */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <DollarSign size={18} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Fiscal Constraints</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Minimum Order Value</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                        <input 
                          name="minOrderAmount" 
                          type="number" 
                          defaultValue={editingCoupon?.minOrderAmount || 0} 
                          className="w-full pl-10 pr-5 py-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Maximum Discount Cap</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">₹</span>
                        <input 
                          name="maxDiscount" 
                          type="number" 
                          defaultValue={editingCoupon?.maxDiscount} 
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-5 py-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                          placeholder="No Cap"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Temporal & Volume Limits */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                      <Clock size={18} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Temporal & Volume Limits</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Expiry Horizon</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                          required
                          name="expiryDate" 
                          type="date" 
                          defaultValue={editingCoupon?.expiryDate ? new Date(editingCoupon.expiryDate).toISOString().split('T')[0] : ''} 
                          className="w-full pl-12 pr-5 py-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-rose-500/20 font-bold" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Total Redemption Limit</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                          name="usageLimit" 
                          type="number" 
                          defaultValue={editingCoupon?.usageLimit} 
                          className="w-full pl-12 pr-5 py-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-rose-500/20 font-bold"
                          placeholder="Infinite"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Visibility & Live Preview */}
              <div className="lg:col-span-5 space-y-10">
                
                {/* Live Identity Card */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Preview Identity</h4>
                  <div className="relative h-64 rounded-[3rem] bg-gradient-to-br from-zinc-900 to-black p-8 flex flex-col justify-between overflow-hidden shadow-2xl border border-white/10 group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.15),transparent_70%)]" />
                    <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700">
                      <Ticket size={120} strokeWidth={1} />
                    </div>

                    <div className="relative">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 border border-amber-500/30">
                          <Zap size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Active Node</span>
                      </div>
                      <h2 className="text-4xl font-black text-white tracking-tighter italic">
                        {previewData.code || (editingCoupon?.code || 'WELCOME50')}
                      </h2>
                    </div>

                    <div className="relative flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Max Benefit</p>
                        <p className="text-2xl font-black text-white">
                          {previewData.discountType === 'fixed' ? '₹' : ''}
                          {previewData.discountValue || (editingCoupon?.discountValue || '0')}
                          {previewData.discountType === 'percentage' ? '%' : ''}
                          <span className="text-xs text-zinc-500 font-bold ml-2">OFF</span>
                        </p>
                        {previewData.maxDiscount > 0 && (
                          <p className="text-[8px] font-black text-amber-500/50 uppercase tracking-widest mt-1">
                            Capped at ₹{previewData.maxDiscount}
                          </p>
                        )}
                      </div>
                      <div className="h-14 w-14 rounded-2xl border border-white/10 flex items-center justify-center text-zinc-600">
                        <ArrowRight size={24} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Applicability Protocol */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Applicability Protocol</h4>
                  <div className="flex p-1.5 bg-zinc-100 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    {[
                      { id: 'full_order', label: 'Entire Order', icon: Layers },
                      { id: 'items', label: 'Specific Items', icon: Package }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setAppliesToType(type.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${appliesToType === type.id ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xl' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}
                      >
                        <type.icon size={16} />
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {appliesToType === 'items' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 overflow-hidden"
                      >
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                          <select 
                            className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none text-xs font-bold appearance-none disabled:opacity-50"
                            disabled={itemsLoading}
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && !selectedItems.includes(val)) {
                                setSelectedItems([...selectedItems, val]);
                              }
                            }}
                          >
                            <option value="">{itemsLoading ? 'Syncing items...' : 'Search & Select Items...'}</option>
                            {menuItems.length > 0 ? (
                              menuItems.map(item => (
                                <option key={item._id} value={item._id}>{item.name}</option>
                              ))
                            ) : !itemsLoading && (
                              <option disabled>No items found for this branch</option>
                            )}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedItems.map(itemId => {
                            const item = menuItems.find(i => i._id === itemId);
                            return (
                              <span key={itemId} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black flex items-center gap-2 border border-amber-500/20">
                                {item?.name}
                                <button type="button" onClick={() => setSelectedItems(selectedItems.filter(id => id !== itemId))}>
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Status Toggle */}
                  <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 mt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status Protocol</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" name="isActive" defaultChecked={editingCoupon ? editingCoupon.isActive : true} className="peer hidden" />
                      <div className="w-16 h-8 bg-zinc-200 dark:bg-zinc-800 rounded-full peer-checked:bg-emerald-500 transition-all duration-300 shadow-inner"></div>
                      <div className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 peer-checked:translate-x-8 shadow-lg"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Matrix */}
            <div className="pt-8 flex items-center justify-end gap-6 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => { setShowCouponModal(false); setEditingCoupon(null); }}
                className="text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-rose-500 transition-colors"
              >
                Abort Protocol
              </button>
              <Button
                type="submit"
                variant="primary"
                className="!py-6 !px-16 !rounded-3xl shadow-2xl shadow-amber-600/30 text-xs font-black uppercase tracking-[0.3em] bg-amber-500 text-black hover:bg-amber-600 active:scale-95 transition-all"
              >
                {editingCoupon ? 'Synchronize Updates' : 'Authorize New Coupon'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
