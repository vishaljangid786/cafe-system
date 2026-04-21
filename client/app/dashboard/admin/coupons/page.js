'use client';
import {
  Tag, Search, Plus, Filter,
  Edit2, Trash2, CheckCircle2, XCircle,
  Calendar, Ticket, Percent, DollarSign,
  Save, X, Layers, Package, BarChart3, Clock,
  ArrowRight, Users, Zap
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function CouponsManagementPage() {
  const [coupons, setCoupons] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Form state for complex fields
  const [appliesToType, setAppliesToType] = useState('full_order'); // 'full_order', 'items', 'categories'
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [couponRes, itemsRes, catsRes] = await Promise.all([
        api.get('/coupons'),
        api.get('/menu'),
        api.get('/categories')
      ]);
      setCoupons(couponRes.data.data);
      setMenuItems(itemsRes.data.data);
      setCategories(catsRes.data.data);
    } catch (error) {
      toast.error('Failed to sync offer matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Add complex fields
    data.appliesTo = {
      items: appliesToType === 'items' ? selectedItems : [],
      categories: appliesToType === 'categories' ? selectedCategories : []
    };

    const loadToast = toast.loading(editingCoupon ? 'Synchronizing offer...' : 'Initializing offer...');
    try {
      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon._id}`, data);
        toast.success('Offer synchronized', { id: loadToast });
      } else {
        await api.post('/coupons', data);
        toast.success('New offer active', { id: loadToast });
      }
      setShowCouponModal(false);
      setEditingCoupon(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    }
  };

  const deleteCoupon = async (id) => {
    if (!confirm('Erase this offer protocol?')) return;
    const loadToast = toast.loading('Erasing offer...');
    try {
      await api.delete(`/coupons/${id}`);
      toast.success('Offer erased', { id: loadToast });
      fetchData();
    } catch (error) {
      toast.error('Erasure failed', { id: loadToast });
    }
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
    if (coupon.appliesTo?.items?.length > 0) {
      setAppliesToType('items');
      setSelectedItems(coupon.appliesTo.items.map(i => i._id || i));
    } else if (coupon.appliesTo?.categories?.length > 0) {
      setAppliesToType('categories');
      setSelectedCategories(coupon.appliesTo.categories.map(c => c._id || c));
    } else {
      setAppliesToType('full_order');
    }
    setShowCouponModal(true);
  };

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
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
              <Tag className="text-amber-600" size={36} strokeWidth={2.5} />
              Offer <span className="text-amber-600">Matrix</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Manage promotional protocols and discount logic.</p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { setEditingCoupon(null); setShowCouponModal(true); }}
            className="!py-4 px-8 shadow-2xl shadow-amber-600/20"
          >
            Create Offer
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500"><Ticket size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Protocol Active</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{coupons.filter(c => c.isActive).length}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Operational Coupons</p>
            </div>
          </Card>
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><BarChart3 size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Total Yield</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{coupons.reduce((acc, c) => acc + c.usedCount, 0)}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Total Implementations</p>
            </div>
          </Card>
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Zap size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Top Protocol</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{coupons.sort((a, b) => b.usedCount - a.usedCount)[0]?.code || 'N/A'}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Most Utilized Code</p>
            </div>
          </Card>
          <Card className="!p-6 bg-white/40 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500"><Clock size={24} /></div>
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Impending Expiry</span>
            </div>
            <div className="mt-4">
              <h4 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{coupons.filter(c => new Date(c.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length}</h4>
              <p className="text-xs text-zinc-500 mt-1 font-medium">Expiring within 7 cycles</p>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Query protocol by designation..."
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
            <option value="All">All Status</option>
            <option value="Active">Operational</option>
            <option value="Inactive">Deactivated</option>
          </select>
        </div>

        {/* Coupons Table */}
        <div className="bg-white dark:bg-zinc-900/30 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm transition-colors">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Protocol Code</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Yield Configuration</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Usage Matrix</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Validity Horizon</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Operational Status</th>
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
                      <div className="h-10 w-10 rounded-xl bg-amber-600/10 flex items-center justify-center text-amber-500">
                        <Ticket size={20} />
                      </div>
                      <span className="text-sm font-black tracking-widest text-zinc-900 dark:text-zinc-100">{coupon.code}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {coupon.discountType === 'percentage' ? <Percent size={14} className="text-amber-500" /> : <DollarSign size={14} className="text-amber-500" />}
                        {coupon.discountValue}{coupon.discountType === 'percentage' ? '%' : ' OFF'}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-medium tracking-tight">
                        {coupon.minOrderAmount > 0 ? `Min: ₹${coupon.minOrderAmount}` : 'No Min'}
                        {coupon.maxDiscount ? ` • Max: ₹${coupon.maxDiscount}` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 max-w-[100px] h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-600"
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
                        onClick={() => deleteCoupon(coupon._id)}
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

          {filteredCoupons.length === 0 && (
            <div className="py-20 text-center">
              <Ticket size={48} className="mx-auto text-zinc-800 mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No offer protocols detected</p>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={showCouponModal}
          onClose={() => { setShowCouponModal(false); setEditingCoupon(null); }}
          title={editingCoupon ? "Synchronize Offer Protocol" : "Initialize Offer Protocol"}
          className="max-w-3xl"
        >
          <form onSubmit={handleCouponSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Protocol Designation (CODE)</label>
                  <input name="code" defaultValue={editingCoupon?.code} required className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest" placeholder="e.g. WELCOME50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Yield Type</label>
                    <select name="discountType" defaultValue={editingCoupon?.discountType || 'percentage'} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100 appearance-none">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Yield Value</label>
                    <input name="discountValue" type="number" defaultValue={editingCoupon?.discountValue} required className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100" placeholder="0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Max Ceiling (₹)</label>
                    <input name="maxDiscount" type="number" defaultValue={editingCoupon?.maxDiscount} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Min Threshold (₹)</label>
                    <input name="minOrderAmount" type="number" defaultValue={editingCoupon?.minOrderAmount || 0} required className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Usage Capacity</label>
                    <input name="usageLimit" type="number" defaultValue={editingCoupon?.usageLimit} className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100" placeholder="Unlimited if empty" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Expiry Horizon</label>
                    <input name="expiryDate" type="date" defaultValue={editingCoupon?.expiryDate ? new Date(editingCoupon.expiryDate).toISOString().split('T')[0] : ''} required className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-zinc-900 dark:text-zinc-100" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block ml-1">Applicable Parameter</label>
                  <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setAppliesToType('full_order')}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appliesToType === 'full_order' ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:text-amber-600'}`}
                    >
                      Global Order
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppliesToType('items')}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appliesToType === 'items' ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:text-amber-600'}`}
                    >
                      Specific Nodes
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppliesToType('categories')}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${appliesToType === 'categories' ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:text-amber-600'}`}
                    >
                      Logical Sectors
                    </button>
                  </div>
                </div>

                {appliesToType === 'items' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Select Culinary Nodes</label>
                    <div className="max-h-[300px] overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-100/30 dark:bg-zinc-950/50 p-4 space-y-2 custom-scrollbar">
                      {menuItems.map(item => (
                        <label key={item._id} className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 rounded-xl cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item._id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedItems([...selectedItems, item._id]);
                              else setSelectedItems(selectedItems.filter(id => id !== item._id));
                            }}
                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">₹{item.price} • {item.category?.name}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {appliesToType === 'categories' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block ml-1">Select Logical Sectors</label>
                    <div className="max-h-[300px] overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-100/30 dark:bg-zinc-950/50 p-4 space-y-2 custom-scrollbar">
                      {categories.map(cat => (
                        <label key={cat._id} className="flex items-center gap-3 p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 rounded-xl cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat._id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCategories([...selectedCategories, cat._id]);
                              else setSelectedCategories(selectedCategories.filter(id => id !== cat._id));
                            }}
                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{cat.name}</p>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">{cat.icon} Sector</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {appliesToType === 'full_order' && (
                  <div className="h-[300px] flex flex-col items-center justify-center text-center p-8 bg-zinc-100/50 dark:bg-zinc-950/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem]">
                    <Layers size={48} className="text-zinc-300 dark:text-zinc-800 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 leading-relaxed">
                      Global Parameter Active.<br />Offer will apply to the cumulative order total.
                    </p>
                  </div>
                )}

                <div className="flex flex-col justify-center pt-4">
                  <label className="flex items-center gap-4 cursor-pointer select-none group">
                    <div className="relative">
                      <input type="checkbox" name="isActive" defaultChecked={editingCoupon ? editingCoupon.isActive : true} className="peer hidden" />
                      <div className="w-12 h-6 bg-zinc-800 rounded-full peer-checked:bg-amber-600 transition-colors shadow-inner"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6 shadow-md"></div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-amber-500 transition-colors">Operational Status</span>
                  </label>
                </div>
              </div>
            </div>

            <Button type="submit" variant="primary" icon={Save} className="w-full py-5 !rounded-3xl shadow-2xl shadow-amber-600/20">
              Synchronize Protocol Matrix
            </Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
