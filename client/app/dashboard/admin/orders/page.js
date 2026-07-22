'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton, CardSkeleton } from '@/app/components/ui/Skeleton';
import {
  BarChart3, Clock, AlertCircle, CheckCircle2,
  XCircle, Filter, Search, Globe, ChefHat,
  TrendingUp, Timer, Activity, ShieldAlert,
  ArrowUpRight, ArrowDownRight, MoreVertical,
  Edit3, Trash2, Zap, LayoutGrid, List, ChevronRight,
  FilterX, Download, RefreshCw, Layers, Wallet,
  IndianRupee, Eye, Printer, Trash
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../config/actions';
import api from '../../../services/api';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import Modal from '../../../components/ui/Modal';
import useConfirm from '../../../components/ui/useConfirm';
import UniversalDateFilter from '../../../components/ui/UniversalDateFilter';
import PaymentBadge from '../../../components/ui/PaymentBadge';

// Modular Components
import MetricCard from './components/MetricCard';
import AdminOrderCard from './components/AdminOrderCard';
import OrderDetailsModal from './components/OrderDetailsModal';
import WatchlistModal from './components/WatchlistModal';
import DashboardFilters from './components/DashboardFilters';

export default function AdminOrdersDashboard() {
  const { confirm, confirmDialog } = useConfirm();
  // Reuse the socket from AuthContext — do NOT create a new connection here.
  // selectedCafe / selectedLocation come from the global top-navbar selector so this
  // page follows it (previously it only used its own local filters and ignored it).
  const { user, socket, selectedCafe, selectedLocation } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [viewMode, setViewMode] = useState('list'); // Default to list view
  const [branchFilter, setBranchFilter] = useState('all');
  const [cafeFilter, setCafeFilter] = useState('all');
  const [cafes, setCafes] = useState([]);
  const [staffFilter, setStaffFilter] = useState(''); // '' = all staff; else a user _id (createdBy)
  const [staffMembers, setStaffMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '' | dine-in | takeaway | delivery
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const itemsPerPage = 24;
  // Monotonic request id: only the latest request is allowed to commit state,
  // so out-of-order (stale) responses from fast typing/filtering are ignored.
  const reqIdRef = useRef(0);
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const isInitial = !didInitRef.current;
    if (!silent) {
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
    }
    const reqId = ++reqIdRef.current;
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);
      if (branchFilter !== 'all') params.append('branchId', branchFilter);
      if (cafeFilter !== 'all') params.append('cafeId', cafeFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('orderType', typeFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (searchTerm) params.append('search', searchTerm);
      if (staffFilter) params.append('createdBy', staffFilter);

      // allSettled so a 403/500 on analytics (a delegated branch_admin may hold
      // viewOrders but not viewAnalytics) or locations doesn't reject the whole
      // batch and blank the orders list that otherwise loaded fine.
      const [orderRes, analyticsRes, locRes, cafeRes] = await Promise.allSettled([
        api.get(`/orders?${params.toString()}`),
        api.get(`/orders/analytics?${params.toString().replace(/&?page=\d+|&?limit=\d+/g, '')}`),
        api.get('/locations'),
        api.get('/cafes')
      ]);
      // Drop the result if a newer request has since started.
      if (reqId !== reqIdRef.current) return;
      if (orderRes.status === 'fulfilled') {
        // Guard against null payloads (the api 404-interceptor resolves to
        // { data: null }); without `|| []` the later orders.map(...) crashed the page.
        setOrders(orderRes.value.data.data || []);
        setTotalPages(orderRes.value.data.pagination?.pages || 1);
      }
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data.data);
      if (locRes.status === 'fulfilled') setLocations(locRes.value.data.data || []);
      if (cafeRes.status === 'fulfilled') setCafes(cafeRes.value.data.data || []);
    } catch (error) {
      if (reqId === reqIdRef.current) console.error('Could not load orders. Please try again.');
    } finally {
      didInitRef.current = true;
      if (!silent && reqId === reqIdRef.current) {
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    }
  }, [branchFilter, cafeFilter, statusFilter, typeFilter, dateRange, currentPage, searchTerm, staffFilter]);

  // Debounce data fetches so each keystroke/filter change doesn't fire its own
  // request burst; the stale-response guard above handles any overlap.
  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Any filter or search change must return to page 1, otherwise the user can be
  // stranded on a page number that no longer exists for the new result set.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    setCurrentPage(1);
  }, [branchFilter, cafeFilter, statusFilter, typeFilter, dateRange, searchTerm, staffFilter]);

  // Follow the global top-navbar cafe/branch selector. Changing the cafe or branch in
  // the navbar drives this page's filters too; the local dropdowns can still narrow
  // further until the next navbar change.
  useEffect(() => {
    setCafeFilter(selectedCafe && selectedCafe !== 'all' ? selectedCafe : 'all');
  }, [selectedCafe]);

  useEffect(() => {
    if (selectedLocation && selectedLocation !== 'all') {
      setBranchFilter(selectedLocation._id || selectedLocation);
    } else {
      setBranchFilter('all');
    }
  }, [selectedLocation]);

  // Attach real-time listeners to the shared socket from AuthContext.
  // No new connection is created — this eliminates the duplicate socket bug.
  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => fetchData({ silent: true });
    socket.on('order:update', handleRefresh);
    socket.on('order:cancel', handleRefresh);
    socket.on('order:note', handleRefresh);
    socket.on('order:new', handleRefresh);

    return () => {
      socket.off('order:update', handleRefresh);
      socket.off('order:cancel', handleRefresh);
      socket.off('order:note', handleRefresh);
      socket.off('order:new', handleRefresh);
    };
  }, [socket, fetchData]);

  const handleForceComplete = async (id) => {
    if (!(await confirm({ title: 'Force-complete order?', message: 'This skips the normal kitchen flow.', confirmText: 'Force Complete' }))) return;
    try {
      await api.patch(`/orders/${id}/force-complete`);
      toast.success('Order marked as completed');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Finalization Failure:', error);
      const msg = error.response?.data?.message || 'Could not complete the order. Please try again.';
      toast.error(msg);
    }
  };

  const handleCancel = async (id) => {
    if (!(await confirm({ title: 'Cancel order?', message: 'This cannot be undone.', confirmText: 'Cancel Order' }))) return;
    try {
      await api.patch(`/orders/${id}/cancel`);
      toast.success('Order canceled');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      console.error('Cancellation Failure:', error);
      const msg = error.response?.data?.message || 'Cancellation failed';
      toast.error(msg);
    }
  };

  const handleDeleteOrder = async (id) => {
    if (orders.find(o => o._id === id)?.status === 'COMPLETED') {
      return toast.error('Cannot delete a completed order');
    }
    if (!['admin', 'super_admin'].includes(user?.role)) {
      return toast.error('Unauthorized action');
    }
    if (!(await confirm({ title: 'Delete order?', message: 'This permanently deletes the order and cannot be undone.', confirmText: 'Delete' }))) return;
    try {
      setLoading(true);
      await api.delete(`/orders/${id}`);
      toast.success('Order deleted');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (id) => {
    if (!(await confirm({ title: 'Refund this order?', message: 'The recorded revenue for this order will be reversed. This cannot be undone.', confirmText: 'Refund' }))) return;
    try {
      await api.patch(`/orders/${id}/refund`, {});
      toast.success('Order refunded');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Refund failed');
    }
  };

  const handleReorder = async (id) => {
    if (!(await confirm({ title: 'Re-order?', message: 'Place a fresh order with the same items.', confirmText: 'Re-order', type: 'primary' }))) return;
    try {
      await api.post(`/orders/${id}/reorder`, {});
      toast.success('New order placed');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not re-order');
    }
  };

  // Tables for the "move order to table" picker (loaded once).
  useEffect(() => {
    let ignore = false;
    api.get('/tables').then((res) => { if (!ignore) setTables(res.data?.data || []); }).catch(() => {});
    return () => { ignore = true; };
  }, []);

  // Staff members (order creators) for the "filter by staff" dropdown — loaded once.
  // The /users endpoint is already scoped to who the current admin/branch-admin manages.
  useEffect(() => {
    let ignore = false;
    api.get('/users', { params: { limit: 500 } })
      .then((res) => {
        if (ignore) return;
        const orderRoles = ['staff', 'chef', 'branch_admin', 'location_admin'];
        setStaffMembers((res.data?.data || []).filter((u) => orderRoles.includes(u.role)));
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const handleMoveTable = async (id, tableId) => {
    try {
      await api.patch(`/orders/${id}/move-table`, { tableId });
      toast.success('Order moved to the new table');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not move the order');
    }
  };

  const handleSplit = async (id, items) => {
    if (!items || items.length === 0) return;
    try {
      await api.post(`/orders/${id}/split`, { items });
      toast.success('Order split into a new bill');
      setSelectedOrder(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not split the order');
    }
  };

  const resetFilters = () => {
    // Branch & cafe scope is owned by the Navbar global filter, not this page.
    setStatusFilter('');
    setTypeFilter('');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
    setStaffFilter('');
    toast.success('Filters cleared');
  };

  const handleOrderSignalProbe = async (id) => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${id}`);
      setSelectedOrder(res.data.data);
      setIsWatchlistModalOpen(false);
    } catch (error) {
      console.error('Could not load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportOrdersCSV = async () => {
    try {
      const params = new URLSearchParams({ type: 'orders', format: 'csv' });
      if (branchFilter !== 'all') params.append('branchId', branchFilter);
      if (cafeFilter !== 'all') params.append('cafeId', cafeFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      const res = await api.get(`/export?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Orders_Export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Orders exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const filteredOrders = orders;

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="relative space-y-6 pb-10">
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />

        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-(--color-on-primary) shadow-sm relative overflow-hidden">
              <ShieldAlert size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-(--color-text-primary) leading-tight mb-1">
                All <span className="text-primary">Orders</span>
              </h1>
              <div className="text-[11px] font-medium text-(--color-text-muted) flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                All Branch Orders
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportOrdersCSV}
              className="h-11 px-5 bg-(--color-surface) hover:bg-(--color-surface-soft) text-(--color-text-primary) rounded-xl border border-(--color-border) text-[11px] font-medium transition-all shadow-sm flex items-center gap-2"
            >
              <Download size={18} /> Export CSV
            </button>
            <button
              onClick={fetchData}
              title="Refresh"
              className="h-11 w-11 flex items-center justify-center bg-primary text-(--color-on-primary) rounded-xl transition-all shadow-sm active:scale-90"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Command Console (Filters) */}
        <DashboardFilters 
          user={user}
          locations={locations}
          branchFilter={branchFilter}
          setBranchFilter={setBranchFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          dateRange={dateRange}
          setDateRange={setDateRange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          resetFilters={resetFilters}
          loading={loading}
          cafes={cafes}
          cafeFilter={cafeFilter}
          setCafeFilter={setCafeFilter}
          staffMembers={staffMembers}
          staffFilter={staffFilter}
          setStaffFilter={setStaffFilter}
        />


        {refetching ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Tactical Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              <MetricCard label="Avg Prep Time" value={`${analytics?.metrics?.avgPrepTime || 0}m`} icon={Timer} color="primary" sub="Accepted to ready" />
              <MetricCard label="In Progress" value={(analytics?.charts?.ordersByStatus || []).filter(s => ['ACCEPTED', 'PREPARING'].includes(s.name)).reduce((acc, curr) => acc + curr.value, 0)} icon={Activity} color="primary" sub="Being prepared" />
              <MetricCard label="Delayed Orders" value={analytics?.delayedOrders?.length || 0} icon={AlertCircle} color="rose" sub="Taking too long" />
              <MetricCard label="Completion Rate" value={`${(((analytics?.charts?.ordersByStatus?.find(s => s.name === 'SERVED')?.value || 0) / (analytics?.metrics?.totalOrders || 1)) * 100).toFixed(0)}%`} icon={CheckCircle2} color="emerald" sub="Orders served" />
            </div>

            {/* Efficiency Chart & Watchlist */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* ... remains the same as before ... */}
              <div className="lg:col-span-8 bg-(--color-surface) rounded-xl border border-(--color-border) p-6 shadow-sm relative overflow-hidden group">
                {/* Chart content */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                  <ChefHat size={180} />
                </div>
                <h3 className="text-[11px] font-medium text-(--color-text-muted) flex items-center gap-2 mb-6">
                  <BarChart3 size={18} className="text-primary" /> Kitchen Performance
                </h3>
                <div className="h-75 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.charts?.chefPerformance || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1.5rem', border: '1px solid #27272a' }} itemStyle={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'bold' }} />
                      <Bar dataKey="avgTime" radius={[10, 10, 0, 0]} name="Avg Time (min)">
                        {(analytics?.charts?.chefPerformance || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--color-primary)' : 'var(--color-secondary)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-4 bg-(--color-surface) rounded-xl border border-(--color-border) p-6 shadow-sm flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-medium text-danger flex items-center gap-2">
                    <AlertCircle size={18} /> Delayed Orders
                  </h3>
                  {analytics?.delayedOrders?.length > 5 && (
                    <button onClick={() => setIsWatchlistModalOpen(true)} className="text-[11px] font-medium text-danger/60 hover:text-danger transition-colors">
                      View All ({analytics.delayedOrders.length})
                    </button>
                  )}
                </div>
                <div className="space-y-4 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {analytics?.delayedOrders?.slice(0, 5).map((delay, idx) => (
                    <div key={idx} className="p-5 bg-danger/5 border border-danger/10 rounded-xl flex items-center justify-between group hover:bg-danger/10 transition-all cursor-pointer" onClick={() => handleOrderSignalProbe(delay.id)}>
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger font-semibold text-lg border border-danger/20 shadow-inner">
                          {delay.table}
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-danger">{delay.status}</p>
                          <p className="text-xs font-medium text-(--color-text-primary) mt-1 tracking-tight">{delay.duration}m Delay</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-danger group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                  {(!analytics?.delayedOrders || analytics.delayedOrders.length === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-xs font-medium text-(--color-text-muted) py-10">
                      All clear. No delays.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Data Grid / List Section */}
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                <div>
                  <h3 className="text-[11px] font-medium text-primary/80 flex items-center gap-2 mb-2">
                    <div className="h-1 w-8 bg-primary rounded-full" />
                    Live Orders
                  </h3>
                  <h2 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">Order <span className="text-(--color-text-muted)">List</span></h2>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    className="w-full h-11 pl-14 pr-6 bg-(--color-surface) rounded-xl border border-(--color-border) text-xs font-medium focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {viewMode === 'list' ? (
                <div className="bg-(--color-surface) rounded-xl border border-(--color-border) shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                          <th className="py-4 px-5 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Order ID</th>
                          <th className="py-4 px-5 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Order Status</th>
                          <th className="py-4 px-5 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Branch / Table</th>
                          <th className="py-4 px-5 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Items</th>
                          <th className="py-4 px-5 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Amount</th>
                          <th className="py-4 px-5 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--color-border)/50">
                        <AnimatePresence mode="popLayout">
                          {filteredOrders.map((order) => (
                            <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={order._id} className="group hover:bg-(--color-surface-soft)/30 transition-all cursor-pointer" onClick={() => setSelectedOrder(order)}>
                              <td className="py-4 px-5">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-medium text-primary">#{order._id.substring(order._id.length - 8)}</span>
                                  <span className="text-[11px] font-medium text-(--color-text-muted) mt-1">{new Date(order.createdAt).toLocaleTimeString()}</span>
                                  {order.createdBy?.name && (
                                    <span className="text-[11px] font-medium text-(--color-text-secondary) mt-0.5">by {order.createdBy.name}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-5">
                                <div className="flex flex-col items-start gap-1.5">
                                  <div className={`px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-2 border ${order.status === 'READY' ? 'bg-success/10 text-success border-success/20' : order.status === 'CANCELLED' || order.status === 'REJECTED' ? 'bg-danger/10 text-danger border-danger/20' : order.status === 'PLACED' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                    <div className={`w-1 h-1 rounded-full ${order.status === 'READY' ? 'bg-success' : order.status === 'CANCELLED' || order.status === 'REJECTED' ? 'bg-danger' : 'bg-primary'}`} />
                                    {order.status}
                                  </div>
                                  <PaymentBadge method={order.paymentType || 'CASH'} size="xs" />
                                </div>
                              </td>
                              <td className="py-4 px-5">
                                <div className="flex flex-col">
                                  {order.branch?.cafe?.name && (
                                    <span className="text-[11px] font-medium text-primary mb-0.5">{order.branch.cafe.name}</span>
                                  )}
                                  <span className="text-xs font-medium text-(--color-text-primary)">{order.branch?.name}</span>
                                  <span className="text-[11px] font-medium text-(--color-text-muted) mt-1">
                                    {order.orderType === 'takeaway' ? 'Takeaway'
                                      : order.orderType === 'delivery' ? 'Delivery'
                                      : `Dine-in · Table ${order.table?.tableNumber ?? '—'}`}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-5 max-w-75">
                                <p className="text-[11px] font-medium text-(--color-text-muted) truncate">
                                  {order.items.map(i => `${i.quantity}x ${i.menuItem?.name || i.itemName || 'Item'}`).join(', ')}
                                </p>
                              </td>
                              <td className="py-4 px-5 text-right">
                                <span className="text-sm font-semibold text-(--color-text-primary)"><Money value={order.totalAmount} /></span>
                              </td>
                              <td className="py-4 px-5 text-right">
                                <div className="flex items-center justify-end gap-2 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }} className="p-2.5 bg-(--color-surface) text-primary rounded-xl border border-(--color-border) hover:bg-primary hover:text-white transition-all shadow-sm">
                                    <Eye size={14} />
                                  </button>
                                  {can(user, 'orders.delete') && order.status !== 'COMPLETED' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order._id); }} className="p-2.5 bg-(--color-surface) text-danger rounded-xl border border-(--color-border) hover:bg-danger hover:text-white transition-all shadow-sm">
                                      <Trash size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  <AnimatePresence mode="popLayout">
                    {filteredOrders.map((order) => (
                      <AdminOrderCard 
                        key={order._id} 
                        order={order} 
                        onCancel={handleCancel} 
                        onForceComplete={handleForceComplete} 
                        userRole={user?.role}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-sm">
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Page {currentPage} / {totalPages}</p>
                  <div className="flex gap-4">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-5 py-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-primary hover:text-(--color-on-primary) hover:shadow-sm hover:shadow-primary/20 active:scale-95">Previous</button>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="px-5 py-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-primary hover:text-(--color-on-primary) hover:shadow-sm hover:shadow-primary/20 active:scale-95">Next</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Order Detail Dossier Modal */}
        <OrderDetailsModal 
          selectedOrder={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          handleCancel={handleCancel}
          handleForceComplete={handleForceComplete}
          handleDeleteOrder={handleDeleteOrder}
          handleRefund={handleRefund}
          handleReorder={handleReorder}
          handleMoveTable={handleMoveTable}
          handleSplit={handleSplit}
          tables={tables}
          userRole={user?.role}
          canDelete={can(user, 'orders.delete')}
          canRefund={can(user, 'revenue.modify')}
        />

        {/* Delayed Orders Modal */}
        <WatchlistModal 
          isOpen={isWatchlistModalOpen}
          onClose={() => setIsWatchlistModalOpen(false)}
          delayedOrders={analytics?.delayedOrders}
          handleOrderSignalProbe={handleOrderSignalProbe}
        />
      </div>
      {confirmDialog}
    </PageTransition>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-xl animate-skeleton border border-(--color-border)" />
        ))}
      </div>
      <div className="h-24 rounded-xl animate-skeleton border border-(--color-border)" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-80 rounded-xl animate-skeleton border border-(--color-border)" />
        ))}
      </div>
    </div>
  );
}
