'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
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
import api from '../../../services/api';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import Modal from '../../../components/ui/Modal';
import UniversalDateFilter from '../../../components/ui/UniversalDateFilter';

// Modular Components
import MetricCard from './components/MetricCard';
import AdminOrderCard from './components/AdminOrderCard';
import OrderDetailsModal from './components/OrderDetailsModal';
import WatchlistModal from './components/WatchlistModal';
import DashboardFilters from './components/DashboardFilters';

export default function AdminOrdersDashboard() {
  // Reuse the socket from AuthContext — do NOT create a new connection here.
  const { user, socket } = useAuth();
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [viewMode, setViewMode] = useState('list'); // Default to list view
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const itemsPerPage = 24;
  const fetchData = useCallback(async ({ silent = false } = {}) => {
    const isInitial = !didInitRef.current;
    if (!silent) {
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
    }
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);
      if (branchFilter !== 'all') params.append('branchId', branchFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (searchTerm) params.append('search', searchTerm);

      const [orderRes, analyticsRes, locRes] = await Promise.all([
        api.get(`/orders?${params.toString()}`),
        api.get(`/orders/analytics?${params.toString().replace(/&?page=\d+|&?limit=\d+/g, '')}`),
        api.get('/locations')
      ]);
      setOrders(orderRes.data.data);
      setTotalPages(orderRes.data.pagination.pages);
      setAnalytics(analyticsRes.data.data);
      setLocations(locRes.data.data);
    } catch (error) {
      toast.error('Could not load orders. Please try again.');
    } finally {
      didInitRef.current = true;
      if (!silent) {
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    }
  }, [branchFilter, statusFilter, dateRange, currentPage, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    if (!confirm('Force-complete this order? This skips the normal kitchen flow.')) return;
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
    if (!confirm('Cancel this order? This cannot be undone.')) return;
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
    if (!confirm('Delete this order permanently? This cannot be undone.')) return;
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

  const resetFilters = () => {
    setBranchFilter('all');
    setStatusFilter('');
    setDateRange({ start: '', end: '' });
    setSearchTerm('');
    toast.success('Filters cleared');
  };

  const handleOrderSignalProbe = async (id) => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${id}`);
      setSelectedOrder(res.data.data);
      setIsWatchlistModalOpen(false);
    } catch (error) {
      toast.error('Could not load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportOrdersCSV = async () => {
    try {
      const params = new URLSearchParams({ type: 'orders', format: 'csv' });
      if (branchFilter !== 'all') params.append('branchId', branchFilter);
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
      <div className="relative space-y-12 pb-24">
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]"
          style={{ backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />

        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-xl bg-primary flex items-center justify-center text-(--color-on-primary) shadow-sm  relative overflow-hidden group">
              <ShieldAlert size={36} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-(--color-text-primary) leading-none mb-2">
                All <span className="text-primary">Orders</span>
              </h1>
              <div className="text-xs font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                All Branch Orders
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={exportOrdersCSV}
              className="h-14 px-8 bg-(--color-surface) hover:bg-(--color-surface-soft) text-(--color-text-primary) rounded-xl border border-(--color-border) text-xs font-bold uppercase tracking-normal transition-all shadow-sm flex items-center gap-3"
            >
              <Download size={18} /> Export CSV
            </button>
            <button
              onClick={fetchData}
              className="h-14 w-14 flex items-center justify-center bg-primary text-(--color-on-primary) rounded-xl transition-all shadow-sm  active:scale-90"
            >
              <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
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
          dateRange={dateRange}
          setDateRange={setDateRange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          resetFilters={resetFilters}
          loading={loading}
        />


        {refetching ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Tactical Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <MetricCard label="Avg Prep Time" value={`${analytics?.metrics?.avgPrepTime || 0}m`} icon={Timer} color="primary" sub="Accepted to ready" />
              <MetricCard label="In Progress" value={(analytics?.charts?.ordersByStatus || []).filter(s => ['ACCEPTED', 'PREPARING'].includes(s.name)).reduce((acc, curr) => acc + curr.value, 0)} icon={Activity} color="primary" sub="Being prepared" />
              <MetricCard label="Delayed Orders" value={analytics?.delayedOrders?.length || 0} icon={AlertCircle} color="rose" sub="Taking too long" />
              <MetricCard label="Completion Rate" value={`${(((analytics?.charts?.ordersByStatus?.find(s => s.name === 'SERVED')?.value || 0) / (analytics?.metrics?.totalOrders || 1)) * 100).toFixed(0)}%`} icon={CheckCircle2} color="emerald" sub="Orders served" />
            </div>

            {/* Efficiency Chart & Watchlist */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* ... remains the same as before ... */}
              <div className="lg:col-span-8 bg-(--color-surface) rounded-xl border border-(--color-border) p-10 shadow-sm relative overflow-hidden group">
                {/* Chart content */}
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                  <ChefHat size={180} />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-3 mb-10">
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

              <div className="lg:col-span-4 bg-(--color-surface) rounded-xl border border-(--color-border) p-10 shadow-sm flex flex-col relative overflow-hidden group">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-xs font-bold uppercase tracking-normal text-danger flex items-center gap-3">
                    <AlertCircle size={18} /> Delayed Orders
                  </h3>
                  {analytics?.delayedOrders?.length > 5 && (
                    <button onClick={() => setIsWatchlistModalOpen(true)} className="text-[9px] font-bold uppercase tracking-normal text-danger/60 hover:text-danger transition-colors">
                      View All ({analytics.delayedOrders.length})
                    </button>
                  )}
                </div>
                <div className="space-y-4 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {analytics?.delayedOrders?.slice(0, 5).map((delay, idx) => (
                    <div key={idx} className="p-5 bg-danger/5 border border-danger/10 rounded-xl flex items-center justify-between group hover:bg-danger/10 transition-all cursor-pointer" onClick={() => handleOrderSignalProbe(delay.id)}>
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-danger/10 flex items-center justify-center text-danger font-bold text-lg border border-danger/20 shadow-inner">
                          {delay.table}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-danger uppercase tracking-normal">{delay.status}</p>
                          <p className="text-xs font-bold text-(--color-text-primary) mt-1 tracking-tight">{delay.duration}m Delay</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-danger group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                  {(!analytics?.delayedOrders || analytics.delayedOrders.length === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 italic text-xs font-bold text-(--color-text-muted) py-10">
                      All clear. No delays.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Data Grid / List Section */}
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-normal text-primary/80 flex items-center gap-3 mb-2">
                    <div className="h-1 w-8 bg-primary rounded-full" />
                    Live Orders
                  </h3>
                  <h2 className="text-4xl font-bold text-(--color-text-primary) tracking-tight">Order <span className="text-(--color-text-muted)">List</span></h2>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                  <input
                    type="text"
                    placeholder="Search orders..."
                    className="w-full h-14 pl-14 pr-6 bg-(--color-surface) rounded-xl border border-(--color-border) text-xs font-bold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
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
                          <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Order ID</th>
                          <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Order Status</th>
                          <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Branch / Table</th>
                          <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Items</th>
                          <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) text-right">Amount</th>
                          <th className="py-6 px-8 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--color-border)/50">
                        <AnimatePresence mode="popLayout">
                          {filteredOrders.map((order) => (
                            <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={order._id} className="group hover:bg-(--color-surface-soft)/30 transition-all cursor-pointer" onClick={() => setSelectedOrder(order)}>
                              <td className="py-6 px-8">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-normal">#{order._id.substring(order._id.length - 8)}</span>
                                  <span className="text-[9px] font-bold text-(--color-text-muted) mt-1">{new Date(order.createdAt).toLocaleTimeString()}</span>
                                </div>
                              </td>
                              <td className="py-6 px-8">
                                <div className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-normal inline-flex items-center gap-2 border ${order.status === 'READY' ? 'bg-success/10 text-success border-success/20' : order.status === 'CANCELLED' || order.status === 'REJECTED' ? 'bg-danger/10 text-danger border-danger/20' : order.status === 'PLACED' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                  <div className={`w-1 h-1 rounded-full animate-pulse ${order.status === 'READY' ? 'bg-success' : order.status === 'CANCELLED' || order.status === 'REJECTED' ? 'bg-danger' : 'bg-primary'}`} />
                                  {order.status}
                                </div>
                              </td>
                              <td className="py-6 px-8">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-(--color-text-primary)">{order.branch?.name}</span>
                                  <span className="text-[10px] font-bold text-(--color-text-muted) mt-1 uppercase tracking-normal">Table {order.table?.tableNumber}</span>
                                </div>
                              </td>
                              <td className="py-6 px-8 max-w-75">
                                <p className="text-[10px] font-bold text-(--color-text-muted) truncate italic">
                                  {order.items.map(i => `${i.quantity}x ${i.menuItem?.name}`).join(', ')}
                                </p>
                              </td>
                              <td className="py-6 px-8 text-right">
                                <span className="text-sm font-bold text-(--color-text-primary)">₹{order.totalAmount}</span>
                              </td>
                              <td className="py-6 px-8 text-right">
                                <div className="flex items-center justify-end gap-2 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }} className="p-2.5 bg-(--color-surface) text-primary rounded-xl border border-(--color-border) hover:bg-primary hover:text-white transition-all shadow-sm">
                                    <Eye size={14} />
                                  </button>
                                  {['admin', 'super_admin'].includes(user?.role) && order.status !== 'COMPLETED' && (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
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
                <div className="flex items-center justify-between px-10 py-8 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Page {currentPage} / {totalPages}</p>
                  <div className="flex gap-4">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="px-8 py-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-primary hover:text-(--color-on-primary) hover:shadow-sm hover:shadow-primary/20 active:scale-95">Previous</button>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="px-8 py-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-primary hover:text-(--color-on-primary) hover:shadow-sm hover:shadow-primary/20 active:scale-95">Next</button>
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
          userRole={user?.role}
        />

        {/* Delayed Orders Modal */}
        <WatchlistModal 
          isOpen={isWatchlistModalOpen}
          onClose={() => setIsWatchlistModalOpen(false)}
          delayedOrders={analytics?.delayedOrders}
          handleOrderSignalProbe={handleOrderSignalProbe}
        />
      </div>
    </PageTransition>
  );
}


function DashboardSkeleton() {
  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-xl animate-skeleton border border-(--color-border)" />
        ))}
      </div>
      <div className="h-24 rounded-xl animate-skeleton border border-(--color-border)" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="h-80 rounded-xl animate-skeleton border border-(--color-border)" />
        ))}
      </div>
    </div>
  );
}
