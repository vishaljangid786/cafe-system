'use client';
import { blockNegative, blockNonInteger } from '@/app/utils/inputValidation';
import {
  Tag, Search, Plus, Filter,
  Edit2, Trash2, CheckCircle2, XCircle,
  Calendar, Ticket, Percent, DollarSign,
  Save, X, Layers, Package, BarChart3, Clock,
  ArrowRight, Users, Zap,
  Target
} from 'lucide-react';
import { LoaderBlock } from '@/app/components/ui/Spinner';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef } from 'react';
import useConfirm from '@/app/components/ui/useConfirm';
import { Money } from '@/app/components/ui/Money';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { can } from '@/app/config/actions';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function CouponsManagementPage() {
  const { selectedLocation, user } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [coupons, setCoupons] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

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
  const [categories, setCategories] = useState([]);

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
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = new URLSearchParams({ page: currentPage, limit: itemsPerPage });
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter === 'Active') params.append('active', 'true');
      else if (statusFilter === 'Inactive') params.append('active', 'false');
      const res = await api.get(`/coupons?${params.toString()}`);
      setCoupons(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Failed to load coupons');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  const fetchMenuItems = async () => {
    try {
      setItemsLoading(true);
      const params = {};
      if (selectedLocation) params.locationId = selectedLocation._id || selectedLocation;

      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu', { params }),
        api.get('/categories')
      ]);
      if (itemsRes.data.success) setMenuItems(itemsRes.data.data);
      if (catsRes.data.success) setCategories(catsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      console.error('Could not load menu items. Please try again.');
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCoupons();
    }, 0);

    return () => clearTimeout(timer);
  }, [currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMenuItems();
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedLocation]);

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const couponData = {
      code: (formData.get('code') || '').toUpperCase(),
      discountType: formData.get('discountType'),
      discountValue: Number(formData.get('discountValue')),
      minOrderAmount: Number(formData.get('minOrderAmount')),
      maxDiscount: Number(formData.get('maxDiscount')) || null,
      usageLimit: Number(formData.get('usageLimit')) || null,
      expiryDate: formData.get('expiryDate'),
      appliesTo: {
        items: appliesToType === 'items' ? selectedItems : [],
        categories: appliesToType === 'categories' ? selectedCategories : []
      },
      isActive: formData.get('isActive') === 'on'
    };

    const loadToast = toast.loading(editingCoupon ? 'Updating coupon...' : 'Creating coupon...');
    try {
      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon._id}`, couponData);
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
    if (!(await confirm({ title: 'Delete coupon?', message: 'This cannot be undone.', confirmText: 'Delete' }))) return;
    const loadToast = toast.loading('Deleting coupon...');
    try {
      await api.delete(`/coupons/${id}`);
      toast.success('Coupon deleted', { id: loadToast });
      fetchCoupons();
    } catch (error) {
      toast.error('Failed to delete coupon', { id: loadToast });
    }
  };

  const filteredCoupons = coupons;

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
      setSelectedCategories([]);
    } else if (coupon.appliesTo?.categories?.length > 0) {
      setAppliesToType('categories');
      setSelectedCategories(coupon.appliesTo.categories.map(c => c._id || c));
      setSelectedItems([]);
    } else {
      setAppliesToType('full_order');
      setSelectedItems([]);
      setSelectedCategories([]);
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

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) flex items-center tracking-tight leading-none">
              <Tag className="mr-3 text-primary" size={24} strokeWidth={2} /> Coupon <span className="ml-2 text-primary">Management</span>
            </h1>
            <p className="text-(--color-text-secondary) text-sm mt-3 font-medium flex items-center">
              <Target size={14} className="mr-2 text-primary" /> Create and manage discount coupons for customers.
            </p>
          </div>
          {can(user, 'coupons.add') && (
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
            className="!py-2.5 !px-6 !rounded-xl shadow-sm  text-xs font-semibold uppercase tracking-normal bg-primary text-(--color-bg-base) hover-scale active:scale-95"
          >
            Create Coupon
          </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Card className="!p-5 bg-(--color-surface)/40 border-(--color-border) shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-primary/10 rounded-xl text-primary"><Ticket size={24} /></div>
              <span className="text-[11px] font-medium uppercase text-(--color-text-muted) tracking-normal">Active Coupons</span>
            </div>
            <div className="mt-4">
              <h4 className="text-2xl font-semibold text-(--color-text-primary)">{coupons.filter(c => c.isActive).length}</h4>
              <p className="text-xs text-(--color-text-secondary) mt-1 font-medium">Coupons Live</p>
            </div>
          </Card>
          <Card className="!p-5 bg-(--color-surface)/40 border-(--color-border) shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-secondary/10 rounded-xl text-secondary"><BarChart3 size={24} /></div>
              <span className="text-[11px] font-medium uppercase text-(--color-text-muted) tracking-normal">Redemptions</span>
            </div>
            <div className="mt-4">
              <h4 className="text-2xl font-semibold text-(--color-text-primary)">{totalUsage}</h4>
              <p className="text-xs text-(--color-text-secondary) mt-1 font-medium">Total Redemptions</p>
            </div>
          </Card>
          <Card className="!p-5 bg-(--color-surface)/40 border-(--color-border) shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-success/10 rounded-xl text-success"><Zap size={24} /></div>
              <span className="text-[11px] font-medium uppercase text-(--color-text-muted) tracking-normal">Trending</span>
            </div>
            <div className="mt-4">
              <h4 className="text-2xl font-semibold text-(--color-text-primary) uppercase tracking-tight">
                {coupons.sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0))[0]?.code || 'N/A'}
              </h4>
              <p className="text-xs text-(--color-text-secondary) mt-1 font-medium">Top Performing Coupon</p>
            </div>
          </Card>
          <Card className="!p-5 bg-(--color-surface)/40 border-(--color-border) shadow-sm transition-colors">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-danger/10 rounded-xl text-danger"><Clock size={24} /></div>
              <span className="text-[11px] font-medium uppercase text-(--color-text-muted) tracking-normal">Expiring</span>
            </div>
            <div className="mt-4">
              <h4 className="text-2xl font-semibold text-(--color-text-primary)">{expiringSoon}</h4>
              <p className="text-xs text-(--color-text-secondary) mt-1 font-medium">Expiring within 7 days</p>
            </div>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="bg-(--color-surface)/60  p-4 rounded-xl border border-(--color-border) flex flex-col md:flex-row gap-4 shadow-sm">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
            <input
              type="text"
              placeholder="Search by coupon code..."
              className="w-full pl-12 pr-4 py-2.5 bg-(--color-bg-soft) border border-(--color-border) rounded-[1.25rem] focus:ring-2 focus:ring-primary/10 outline-none transition-all font-medium text-sm text-(--color-text-primary)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="md:w-64">
            <PremiumSelect
              icon={Filter}
              placeholder="Filter by status"
              value={statusFilter}
              onChange={val => setStatusFilter(val)}
              options={[
                { label: 'All Statuses', value: 'All' },
                { label: 'Active', value: 'Active' },
                { label: 'Inactive', value: 'Inactive' }
              ]}
              className="!rounded-[1.25rem]"
            />
          </div>
        </div>

        <div className="bg-(--color-surface)/30 rounded-xl border border-(--color-border) overflow-hidden shadow-sm transition-colors">
          {refetching ? (
            <div className="p-5">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : (
          <>
          <div className="responsive-table-container">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--color-surface-soft) border-b border-(--color-border)">
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Coupon Code</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Discount</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Usage</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Validity</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Status</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-(--color-border)">
              {filteredCoupons.map((coupon, i) => (
                <motion.tr
                  key={coupon._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-primary/[0.02] transition-colors group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Tag size={16} />
                      </div>
                      <span className="text-sm font-medium tracking-normal text-(--color-text-primary)">{coupon.code}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-(--color-text-primary)">
                      {coupon.discountType === 'percentage' ? <Percent size={14} className="text-primary" /> : <DollarSign size={14} className="text-primary" />}
                      {coupon.discountValue}{coupon.discountType === 'percentage' ? '%' : ' OFF'}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-1.5 w-full bg-(--color-bg-soft) rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-1000"
                          style={{ width: `${coupon.usageLimit ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-(--color-text-primary)">{coupon.usedCount} / {coupon.usageLimit || '∞'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-(--color-text-muted)">
                      <Calendar size={14} />
                      {new Date(coupon.expiryDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-normal flex items-center gap-1.5 w-fit ${coupon.isActive ? 'bg-success/10 text-success border border-success/20' : 'bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
                      {coupon.isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {can(user, 'coupons.modify') && (
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="p-2.5 rounded-xl bg-(--color-surface-soft) hover:bg-primary text-(--color-text-muted) hover:text-(--color-bg-base) transition-all shadow-sm"
                      >
                        <Edit2 size={16} />
                      </button>
                      )}
                      {can(user, 'coupons.delete') && (
                      <button
                        onClick={() => handleDelete(coupon._id)}
                        className="p-2.5 rounded-xl bg-danger/10 hover:bg-[rgba(var(--color-danger-rgb),0.12)] text-danger hover:text-(--color-bg-base) transition-all shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 bg-(--color-surface-soft) border-t border-(--color-border)">
              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-2 rounded-xl bg-(--color-surface) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft) text-(--color-text-primary)"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-(--color-surface) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft) text-(--color-text-primary)"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        <Modal
          isOpen={showCouponModal}
          onClose={() => { setShowCouponModal(false); setEditingCoupon(null); }}
          title={editingCoupon ? "Update Coupon" : "Add New Coupon"}
          maxWidth="max-w-4xl"
        >
          <form onSubmit={handleCouponSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Left Column: Configuration List */}
              <div className="lg:col-span-7 space-y-6">

                {/* 1. Details & Amount */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Ticket size={18} />
                    </div>
                    <h4 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Details & Amount</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) ml-1">Coupon Code</label>
                      <div className="relative group">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={18} />
                        <input
                          required
                          name="code"
                          defaultValue={editingCoupon?.code}
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-4 rounded-xl border border-(--color-border) bg-(--color-bg-base) text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 font-medium uppercase tracking-normal"
                          placeholder="e.g. SUMMER50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) ml-1">Discount Amount</label>
                      <div className="flex bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border) gap-4">
                        <div className="relative flex-1">
                          <input
                            required
                            name="discountValue"
                            type="number"
                            min="0"
                            onKeyDown={blockNegative}
                            defaultValue={editingCoupon?.discountValue}
                            onChange={handleInputChange}
                            className="w-full pl-4 pr-4 py-3 bg-transparent text-(--color-text-primary) outline-none font-medium text-lg"
                            placeholder="0"
                          />
                        </div>
                        <div className="w-32">
                          <PremiumSelect
                            name="discountType"
                            value={previewData.discountType}
                            onChange={val => setPreviewData(prev => ({ ...prev, discountType: val }))}
                            options={[
                              { label: '% Percentage', value: 'percentage' },
                              { label: '₹ Fixed', value: 'fixed' }
                            ]}
                          />
                          <input type="hidden" name="discountType" value={previewData.discountType} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Fiscal Constraints */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                      <DollarSign size={18} />
                    </div>
                    <h4 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Order Limits</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) ml-1">Minimum Order Value</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) font-medium">₹</span>
                        <input
                          name="minOrderAmount"
                          type="number"
                          min="0"
                          onKeyDown={blockNegative}
                          defaultValue={editingCoupon?.minOrderAmount || 0}
                          className="w-full pl-10 pr-5 py-4 bg-(--color-bg-base) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-secondary/20 font-medium"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) ml-1">Maximum Discount Cap</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) font-medium">₹</span>
                        <input
                          name="maxDiscount"
                          type="number"
                          min="0"
                          onKeyDown={blockNegative}
                          defaultValue={editingCoupon?.maxDiscount}
                          onChange={handleInputChange}
                          className="w-full pl-10 pr-5 py-4 bg-(--color-bg-base) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-secondary/20 font-medium"
                          placeholder="No Cap"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Temporal & Volume Limits */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
                      <Clock size={18} />
                    </div>
                    <h4 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Expiry & Usage Limits</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) ml-1">Expiry Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                        <input
                           required
                          name="expiryDate"
                          type="date"
                          defaultValue={editingCoupon?.expiryDate ? new Date(editingCoupon.expiryDate).toISOString().split('T')[0] : ''}
                          className="w-full pl-12 pr-5 py-4 bg-(--color-bg-base) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-danger/20 font-medium"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) ml-1">Total Redemption Limit</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                        <input
                          name="usageLimit"
                          type="number"
                          min="0"
                          onKeyDown={blockNonInteger}
                          defaultValue={editingCoupon?.usageLimit}
                          className="w-full pl-12 pr-5 py-4 bg-(--color-bg-base) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-danger/20 font-medium"
                          placeholder="Infinite"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Visibility & Live Preview */}
              <div className="lg:col-span-5 space-y-6">

                {/* Live Identity Card */}
                 <div className="space-y-4">
                  <h4 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Live Preview</h4>
                  <div className="relative h-64 rounded-xl bg-gradient-to-br from-(--color-bg-deep) to-(--color-bg-base) p-6 flex flex-col justify-between overflow-hidden shadow-sm border border-(--color-bg-base)/10 group">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.15),transparent_70%)]" />
                    <div className="absolute top-0 right-0 p-8 opacity-20 transition-transform duration-700">
                      <Ticket size={120} strokeWidth={1} />
                    </div>

                    <div className="relative">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30">
                          <Zap size={20} />
                        </div>
                        <span className="text-[11px] font-medium uppercase tracking-normal text-primary">Active Coupon</span>
                      </div>
                      <h2 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">
                        {previewData.code || (editingCoupon?.code || 'WELCOME50')}
                      </h2>
                    </div>

                    <div className="relative flex justify-between items-end">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Discount</p>
                        <p className="text-2xl font-semibold text-(--color-text-primary)">
                          {previewData.discountType === 'fixed' ? '₹' : ''}
                          {previewData.discountValue || (editingCoupon?.discountValue || '0')}
                          {previewData.discountType === 'percentage' ? '%' : ''}
                          <span className="text-xs text-(--color-text-muted) font-medium ml-2">OFF</span>
                        </p>
                        {previewData.maxDiscount > 0 && (
                          <p className="text-[11px] font-medium text-primary/50 uppercase tracking-normal mt-1">
                            Capped at <Money value={previewData.maxDiscount} />
                          </p>
                        )}
                      </div>
                      <div className="h-14 w-14 rounded-xl border border-(--color-bg-base)/10 flex items-center justify-center text-(--color-text-muted)">
                        <ArrowRight size={24} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Applicability */}
                 <div className="space-y-6">
                  <h4 className="text-[11px] font-medium uppercase tracking-normal text-success">Applies To</h4>
                  <div className="flex p-1.5 bg-(--color-surface-soft) rounded-xl border border-(--color-border)">
                    {[
                      { id: 'full_order', label: 'Entire Order', icon: Layers },
                      { id: 'items', label: 'Specific Items', icon: Package },
                      { id: 'categories', label: 'Categories', icon: Tag }
                    ].map(type => (
                      <button
                         key={type.id}
                        type="button"
                        onClick={() => setAppliesToType(type.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[11px] font-medium uppercase tracking-normal transition-all ${appliesToType === type.id ? 'bg-(--color-text-primary) text-(--color-bg-base) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
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
                        <PremiumSelect
                          label="Select Items"
                          disabled={itemsLoading}
                          value=""
                          onChange={val => {
                            if (val && !selectedItems.includes(val)) {
                              setSelectedItems([...selectedItems, val]);
                            }
                          }}
                          options={[
                            { label: itemsLoading ? 'Loading items...' : 'Search & select items...', value: '' },
                            ...(menuItems.map(item => ({ label: item.name, value: item._id })))
                          ]}
                        />
                        <div className="flex flex-wrap gap-2">
                          {selectedItems.map(itemId => {
                            const item = menuItems.find(i => i._id === itemId);
                            return (
                              <span key={itemId} className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[11px] font-medium flex items-center gap-2 border border-primary/20">
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
                    {appliesToType === 'categories' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 overflow-hidden"
                      >
                        <PremiumSelect
                          label="Category Selection"
                          value=""
                          onChange={val => {
                            if (val && !selectedCategories.includes(val)) {
                              setSelectedCategories([...selectedCategories, val]);
                            }
                          }}
                          options={[
                            { label: 'Search & Select Categories...', value: '' },
                            ...categories.map(c => ({ label: c.name, value: c._id }))
                          ]}
                        />
                        <div className="flex flex-wrap gap-2">
                          {selectedCategories.map(catId => {
                            const cat = categories.find(c => c._id === catId);
                            return (
                              <span key={catId} className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[11px] font-medium flex items-center gap-2 border border-primary/20">
                                {cat?.name || catId}
                                <button type="button" onClick={() => setSelectedCategories(selectedCategories.filter(id => id !== catId))}>
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
                  <div className="flex items-center justify-between p-5 bg-(--color-surface-soft) rounded-xl border border-(--color-border) mt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Status</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" name="isActive" defaultChecked={editingCoupon ? editingCoupon.isActive : true} className="peer hidden" />
                      <div className="w-16 h-8 bg-(--color-bg-deep) rounded-full peer-checked:bg-success transition-all duration-300 shadow-inner"></div>
                      <div className="absolute left-1 top-1 w-6 h-6 bg-(--color-bg-base) rounded-full transition-all duration-300 peer-checked:translate-x-8 shadow-sm"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

             {/* Footer List */}
            <div className="pt-6 flex items-center justify-end gap-5 border-t border-(--color-border)">
               <button
                type="button"
                onClick={() => { setShowCouponModal(false); setEditingCoupon(null); }}
                className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted) hover:text-danger transition-colors"
              >
                Cancel
              </button>
               <Button
                type="submit"
                variant="primary"
                className="!py-3 !px-16 !rounded-xl shadow-sm  text-xs font-semibold uppercase tracking-normal bg-primary text-(--color-bg-base) hover:bg-primary-dark active:scale-95 transition-all"
              >
                {editingCoupon ? 'Save Changes' : 'Add Coupon'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
      {confirmDialog}
    </PageTransition>
  );
}
