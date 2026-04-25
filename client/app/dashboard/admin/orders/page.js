'use client';
import { useState, useEffect } from 'react';
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
  const [locations, setLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const branchQuery = branchFilter !== 'all' ? `?branchId=${branchFilter}` : '';
      const [orderRes, analyticsRes, locRes] = await Promise.all([
        api.get(`/orders${branchQuery}`),
        api.get(`/orders/analytics${branchQuery}`),
        api.get('/locations')
      ]);
      setOrders(orderRes.data.data);
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
      setBranchFilter(user.assignedLocation._id || user.assignedLocation);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [branchFilter]);

  const handleForceComplete = async (id) => {
    try {
      await api.patch(`/orders/${id}/force-complete`);
      toast.success('Order force-completed');
      fetchData();
    } catch (error) {
      toast.error('Override protocol failed');
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.patch(`/orders/${id}/cancel`);
      toast.success('Order aborted');
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-foreground">
              <ShieldAlert className="text-accent" size={32} />
              Operational Oversight
            </h1>
            <p className="text-muted-foreground text-sm font-bold mt-1 tracking-tight">Cross-branch order surveillance and performance analytics.</p>
          </div>

          <div className="flex items-center gap-4">
            {user?.role === 'branch_admin' ? (
              <div className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-black text-amber-500 border border-amber-500/20">
                {locations.find(l => l._id === branchFilter)?.name || 'My Branch'}
              </div>
            ) : (
              <PremiumSelect 
                label="Operational Sector"
                value={branchFilter}
                onChange={val => setBranchFilter(val)}
                options={[
                  { label: 'Global Matrix', value: 'all' },
                  ...(locations.map(loc => ({ label: loc.name, value: loc._id })))
                ]}
              />
            )}
            <div className="flex bg-muted rounded-xl p-1 border border-border shadow-inner">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-accent' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-accent' : 'text-muted-foreground hover:text-foreground'}`}><List size={16} /></button>
            </div>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Avg Prep Time"
            value={`${analytics?.avgPrepTime || 0}m`}
            sub="ACCEPTED → READY"
            icon={Timer}
            color="amber"
          />
          <StatCard
            label="Live Throughput"
            value={orders.filter(o => ['ACCEPTED', 'PREPARING'].includes(o.status)).length}
            sub="Active Kitchens"
            icon={Activity}
            color="blue"
          />
          <StatCard
            label="Delayed Orders"
            value={analytics?.mostDelayed?.length || 0}
            sub="Critical Threshold (>20m)"
            icon={AlertCircle}
            color="rose"
          />
          <StatCard
            label="Completion Rate"
            value={`${((orders.filter(o => o.status === 'SERVED').length / (orders.length || 1)) * 100).toFixed(0)}%`}
            sub="Global Fulfillment"
            icon={CheckCircle2}
            color="emerald"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chef Performance Chart */}
          <div className="lg:col-span-2 glass-morphism rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <ChefHat size={16} className="text-amber-500" /> Kitchen Efficiency / Chef Performance
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.chefPerformance || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={10} fontWeight={900} />
                  <YAxis stroke="#71717a" fontSize={10} fontWeight={900} />
                  <Tooltip
                    itemStyle={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="avgTime" radius={[8, 8, 0, 0]} name="Avg Time (min)">
                    {(analytics?.chefPerformance || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#f59e0b' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Delay Watchlist */}
          <div className="glass-morphism rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 overflow-hidden">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-500" /> Delay Watchlist
            </h3>
            <div className="space-y-4">
              {analytics?.mostDelayed?.map((delay, idx) => (
                <div key={idx} className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-center justify-between group hover:bg-rose-500/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 font-black text-sm">
                      T{delay.table}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{delay.status}</p>
                      <p className="text-xs font-black text-zinc-800 dark:text-zinc-100 mt-0.5 tracking-tight">{delay.duration}m in-sector</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              ))}
              {(!analytics?.mostDelayed || analytics.mostDelayed.length === 0) && (
                <div className="h-40 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold text-zinc-500">
                  No critical delays detected.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Orders Monitor */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Live Monitor Matrix</h3>
            <div className="relative w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input
                type="text"
                placeholder="Filter matrix..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[10px] font-bold outline-none border border-transparent focus:border-amber-500/30"
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
        </div>
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }) {
  const colors = {
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
  };

  return (
    <CardHover>
      <div className="bg-card p-6 rounded-[2rem] border border-border flex flex-col group shadow-sm">
        <div className={`h-12 w-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border`}>
          <Icon size={24} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <h4 className="text-3xl font-black text-foreground tracking-tighter mb-2">{value}</h4>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">{sub}</p>
      </div>
    </CardHover>
  );
}

function AdminOrderCard({ order, onCancel, onForceComplete }) {
  const statusColors = {
    'PLACED': 'text-amber-500',
    'ACCEPTED': 'text-blue-500',
    'PREPARING': 'text-indigo-500',
    'READY': 'text-emerald-500',
    'SERVED': 'text-zinc-400',
    'CANCELLED': 'text-rose-500',
    'REJECTED': 'text-rose-500'
  };

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="bg-card border border-border p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all relative group overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${statusColors[order.status]}`}>
              {order.status}
            </span>
            <h4 className="text-lg font-black text-foreground tracking-tight mt-1">
              Table {order.table?.tableNumber || '??'} <span className="text-muted-foreground font-medium">/ {order.branch?.name}</span>
            </h4>
          </div>
          <button className="p-2 text-zinc-400 hover:text-amber-500 transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="space-y-2 mb-6">
          {order.items.map((item, i) => (
            <p key={i} className="text-xs font-bold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : item.menuItem?.dietaryType === 'non-veg' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-accent shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
                {item.quantity}x {item.menuItem?.name}
              </span>
              <span className="text-muted-foreground/60">₹{(item.menuItem?.price || 0) * item.quantity}</span>
            </p>
          ))}
        </div>

        {!['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
            <button
              onClick={() => onCancel(order._id)}
              className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onForceComplete(order._id)}
              className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
            >
              Force Served
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
