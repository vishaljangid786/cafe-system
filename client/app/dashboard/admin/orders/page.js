'use client';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';
import {
  BarChart3, Clock, AlertCircle, CheckCircle2,
  XCircle, Filter, Search, Globe, ChefHat,
  TrendingUp, Timer, Activity, ShieldAlert,
  ArrowUpRight, ArrowDownRight, MoreVertical,
  Edit3, Trash2, Zap, LayoutGrid, List, ChevronRight
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import toast from 'react-hot-toast';
import ExportActions from '../../../components/ui/ExportActions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import Modal from '../../../components/ui/Modal';

export default function AdminOrdersDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 24; // Grids look better with 24 (4 columns)
  
  const columns = [
    { header: 'Order ID', key: '_id' },
    { header: 'Table', key: 'table.tableNumber' },
    { header: 'Branch', key: 'branch.name' },
    { header: 'Status', key: 'status' },
    { header: 'Total Amount', key: 'totalAmount' },
    { header: 'Items', key: (o) => o.items.map(i => `${i.quantity}x ${i.menuItem?.name}`).join(', ') }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', itemsPerPage);
      if (branchFilter !== 'all') params.append('branchId', branchFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
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
      toast.error('Strategic sync failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'branch_admin' && user?.assignedLocation) {
      const timer = setTimeout(() => {
        setBranchFilter(user.assignedLocation._id || user.assignedLocation);
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);

    return () => clearTimeout(timer);
  }, [branchFilter, statusFilter, startDate, endDate, currentPage]);

  useEffect(() => {
    if (!user) return;
    const socket = io(SOCKET_URL, { withCredentials: true });

    socket.on('connect', () => {
      socket.emit('join_session', { branchId: user.assignedLocation?._id || user.assignedLocation || 'global' });
    });

    socket.on('order:update', () => fetchData());
    socket.on('order:cancel', () => fetchData());
    socket.on('order:note', () => fetchData());
    socket.on('order:new', () => fetchData());

    return () => socket.close();
  }, [user, branchFilter]);

  const handleForceComplete = async (id) => {
    try {
      await api.patch(`/orders/${id}/force-complete`);
      toast.success('Order force-completed');
      fetchData();
    } catch (error) {
      toast.error('Override rule failed');
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.patch(`/orders/${id}/cancel`);
      toast.success('Order canceled');
      fetchData();
    } catch (error) {
      toast.error('Cancellation failed');
    }
  };

  const filteredOrders = orders.filter(o =>
    o.table?.tableNumber?.toString().includes(searchTerm) ||
    o.branch?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o._id.includes(searchTerm)
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky-filter !-mt-0">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-[var(--color-text-primary)]">
              <ShieldAlert className="text-[var(--color-primary)]" size={32} />
              Operational Oversight
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm font-bold mt-1 tracking-tight hidden md:block">Cross-branch order surveillance and performance analytics.</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide w-full md:w-auto">
            <ExportActions 
              data={orders} 
              columns={columns} 
              filename={`Orders_${new Date().toISOString().split('T')[0]}`} 
              hasCharts={true}
            />

            {user?.role === 'branch_admin' ? (
              <div className="px-4 py-2.5 bg-[var(--color-surface-soft)] rounded-xl text-xs font-black text-[var(--color-primary)] border border-[var(--color-primary)]/20 whitespace-nowrap">
                {locations.find(l => l._id === branchFilter)?.name || 'My Branch'}
              </div>
            ) : (
              <div className="w-full min-w-[140px] sm:min-w-[160px]">
                <PremiumSelect
                  value={branchFilter}
                  onChange={val => setBranchFilter(val)}
                  options={[
                    { label: 'Global', value: 'all' },
                    ...(locations.map(loc => ({ label: loc.name, value: loc._id })))
                  ]}
                />
              </div>
            )}
            
            <div className="w-full min-w-[140px] sm:min-w-[160px]">
              <PremiumSelect
                value={statusFilter}
                onChange={val => setStatusFilter(val)}
                options={[
                  { label: 'All Status', value: '' },
                  { label: 'Placed', value: 'PLACED' },
                  { label: 'Accepted', value: 'ACCEPTED' },
                  { label: 'Preparing', value: 'PREPARING' },
                  { label: 'Ready', value: 'READY' },
                  { label: 'Served', value: 'SERVED' },
                  { label: 'Cancelled', value: 'CANCELLED' }
                ]}
              />
            </div>

            <div className="hidden lg:flex items-center gap-2 bg-[var(--color-surface-soft)] p-2 rounded-xl border border-[var(--color-border)]">
              <input 
                type="date" 
                className="bg-transparent text-[10px] font-black uppercase outline-none text-[var(--color-text-primary)]"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-[var(--color-text-muted)] font-black text-[10px]">TO</span>
              <input 
                type="date" 
                className="bg-transparent text-[10px] font-black uppercase outline-none text-[var(--color-text-primary)]"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex bg-[var(--color-surface-soft)] rounded-lg p-2 border border-[var(--color-border)] shadow-inner  shrink-0">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}><List size={16} /></button>
            </div>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Avg Prep Time"
            value={`${analytics?.metrics?.avgPrepTime || 0}m`}
            sub="ACCEPTED → READY"
            icon={Timer}
            color="primary"
          />
          <StatCard
            label="Live Throughput"
            value={(analytics?.charts?.ordersByStatus || [])
              .filter(s => ['ACCEPTED', 'PREPARING'].includes(s.name))
              .reduce((acc, curr) => acc + curr.value, 0)}
            sub="Active Kitchens"
            icon={Activity}
            color="primary"
          />
          <StatCard
            label="Delayed Orders"
            value={analytics?.delayedOrders?.length || 0}
            sub="Critical Threshold (>20m)"
            icon={AlertCircle}
            color="danger"
          />
          <StatCard
            label="Completion Rate"
            value={`${(((analytics?.charts?.ordersByStatus?.find(s => s.name === 'SERVED')?.value || 0) / (analytics?.metrics?.totalOrders || 1)) * 100).toFixed(0)}%`}
            sub="Global Fulfillment"
            icon={CheckCircle2}
            color="success"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chef Performance Chart */}
          <div className="lg:col-span-2 glass-morphism rounded-[2.5rem] border border-[var(--color-border)] p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-2">
                <ChefHat size={16} className="text-[var(--color-primary)]" /> Kitchen Efficiency / Chef Performance
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.charts?.chefPerformance || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '1rem', color: 'var(--color-text-primary)', fontSize: '11px' }}
                    itemStyle={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="avgTime" radius={[8, 8, 0, 0]} name="Avg Time (min)">
                    {(analytics?.charts?.chefPerformance || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--color-primary)' : 'var(--color-secondary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Delay Watchlist */}
          <div className="glass-morphism rounded-[2.5rem] border border-[var(--color-border)] p-8 overflow-hidden">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-8 flex items-center gap-2">
              <AlertCircle size={16} className="text-[var(--color-danger)]" /> Delay Watchlist
            </h3>
            <div className="space-y-4">
              {analytics?.delayedOrders?.map((delay, idx) => (
                <div key={idx} className="p-4 bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/10 rounded-2xl flex items-center justify-between group hover:bg-[var(--color-danger)]/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-[var(--color-danger)]/10 flex items-center justify-center text-[var(--color-danger)] font-black text-sm">
                      T{delay.table}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{delay.status}</p>
                      <p className="text-xs font-black text-[var(--color-text-primary)] mt-0.5 tracking-tight">{delay.duration}m in-sector</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[var(--color-danger)] opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              ))}
              {(!analytics?.delayedOrders || analytics.delayedOrders.length === 0) && (
                <div className="h-40 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold text-[var(--color-text-muted)]">
                  No critical delays detected.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Orders Monitor */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 sm:px-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Live Monitor List</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={14} />
              <input
                type="text"
                placeholder="Filter list..."
                className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-soft)] rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-[var(--color-primary)]/30 text-[var(--color-text-primary)]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
                <AdminOrderCard
                  key={order._id}
                  order={order}
                  onCancel={handleCancel}
                  onForceComplete={handleForceComplete}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[2rem] mt-10 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                List Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-2 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-[var(--color-surface)] flex-1 sm:flex-none"
                >
                  Previous Sector
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-[var(--color-surface)] flex-1 sm:flex-none"
                >
                  Next Sector
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }) {
  const colors = {
    primary: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20',
    danger: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20',
    success: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20'
  };

  return (
    <CardHover>
      <div className="bg-[var(--color-surface)] p-6 rounded-[2rem] border border-[var(--color-border)] flex flex-col group shadow-sm">
        <div className={`h-12 w-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border`}>
          <Icon size={24} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{label}</p>
        <h4 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tighter mb-2">{value}</h4>
        <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight">{sub}</p>
      </div>
    </CardHover>
  );
}

function AdminOrderCard({ order, onCancel, onForceComplete }) {
  const statusColors = {
    'PLACED': 'text-[var(--color-primary)]',
    'ACCEPTED': 'text-[var(--color-primary)]',
    'PREPARING': 'text-[var(--color-secondary)]',
    'READY': 'text-[var(--color-success)]',
    'SERVED': 'text-[var(--color-text-muted)]',
    'CANCELLED': 'text-[var(--color-danger)]',
    'REJECTED': 'text-[var(--color-danger)]'
  };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all relative group overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${statusColors[order.status]}`}>
              {order.status}
            </span>
            <h4 className="text-lg font-black text-[var(--color-text-primary)] tracking-tight mt-1">
              Table {order.table?.tableNumber || '??'} <span className="text-[var(--color-text-muted)] font-medium">/ {order.branch?.name}</span>
            </h4>
          </div>
          <button className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {order.items.map((item, i) => (
            <p key={i} className="text-xs font-bold text-[var(--color-text-muted)] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-[var(--color-success)] shadow-[0_0_8px_rgba(var(--color-success-rgb),0.6)]' : item.menuItem?.dietaryType === 'non-veg' ? 'bg-[var(--color-danger)] shadow-[0_0_8px_rgba(var(--color-danger-rgb),0.6)]' : 'bg-[var(--color-primary)] shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.6)]'}`} />
                {item.quantity}x {item.menuItem?.name}
              </span>
              <span className="text-[var(--color-text-muted)] opacity-60">₹{(item.menuItem?.price || 0) * item.quantity}</span>
            </p>
          ))}
        </div>

        {!['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
          <div className="pt-6 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
            <button
              onClick={() => onCancel(order._id)}
              className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest text-[var(--color-danger)] bg-[var(--color-danger)]/5 hover:bg-[var(--color-danger)] hover:text-[var(--color-bg-base)] rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onForceComplete(order._id)}
              className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest text-[var(--color-success)] bg-[var(--color-success)]/5 hover:bg-[var(--color-success)] hover:text-[var(--color-bg-base)] rounded-xl transition-all"
            >
              Force Served
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
