'use client';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Users,
  Coffee, Calendar, Zap, Activity, Clock,
  ArrowUpRight, Target, Flame, Layers, Filter,
  ChefHat, Utensils, Receipt, ShoppingBag
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { StatWidget } from '../../components/ui/StatWidget';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { selectedLocation } = useAuth();
  const [analytics, setAnalytics] = useState({
    summary: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
    timeSeries: [],
    categorySales: [],
    staffPerformance: []
  });
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('7d'); // '7d', '30d', 'all'
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let query = `?locationId=${selectedLocation?._id || selectedLocation || ''}`;

      const now = new Date();
      let start = '';
      if (timeFilter === '7d') {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        start = d.toISOString().split('T')[0];
      } else if (timeFilter === '30d') {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        start = d.toISOString().split('T')[0];
      } else if (timeFilter === 'custom' && customDates.start) {
        start = customDates.start;
        if (customDates.end) query += `&endDate=${customDates.end}`;
      }

      if (start) query += `&startDate=${start}`;

      const res = await api.get(`/analytics/advanced${query}`);
      if (res.data.success) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error("Analytics sync error:", error);
      toast.error("Failed to sync operational matrix");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedLocation, timeFilter, customDates]);

  if (loading) return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardSkeleton className="h-[400px]" /><CardSkeleton className="h-[400px]" />
      </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Global Operational Matrix</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white flex items-baseline gap-3">
            {selectedLocation ? selectedLocation.city : 'Network'}
            <span className="text-amber-500">Analytics</span>
          </h1>
          <p className="text-sm text-zinc-400 font-medium max-w-lg leading-relaxed">
            Predictive yield tracking and performance synchronization for {selectedLocation ? selectedLocation.name : 'all global nodes'}.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/40 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md">
          {['7d', '30d', 'all', 'custom'].map(t => (
            <button
              key={t}
              onClick={() => setTimeFilter(t)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${timeFilter === t ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {timeFilter === 'custom' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4 p-6 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm"
        >
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 ml-1">Start Horizon</label>
            <input type="date" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 ml-1">End Horizon</label>
            <input type="date" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatWidget
          label="Cumulative Yield"
          value={`₹${analytics?.summary?.totalRevenue?.toLocaleString() || '0'}`}
          icon={TrendingUp} trend="+14.2%" isUp={true} color="amber" delay={0}
        />
        <StatWidget
          label="Total Protocols"
          value={analytics?.summary?.totalOrders || '0'}
          icon={ShoppingBag} trend="+8.1%" isUp={true} color="blue" delay={0.1}
        />
        <StatWidget
          label="Avg Unit Yield"
          value={`₹${Math.round(analytics?.summary?.avgOrderValue || 0).toLocaleString()}`}
          icon={Target} trend="+4.5%" isUp={true} color="green" delay={0.2}
        />
        <StatWidget
          label="Node Efficiency"
          value="94.2%" icon={Flame} trend="Optimal" isUp={true} color="rose" delay={0.3}
        />
      </div>

      {/* Primary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Timeline */}
        <Card className="!p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <CardTitle className="text-xl">Revenue Horizon</CardTitle>
              <CardDescription>Fiscal throughput timeline across selected temporal window.</CardDescription>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
              <Activity size={20} />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.timeSeries}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid #27272a', padding: '16px' }}
                  itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Orders Timeline */}
        <Card className="!p-8 bg-zinc-950/20 border-zinc-800/50" hover={false}>
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <CardTitle className="text-xl">Order Volumetrics</CardTitle>
              <CardDescription>Protocol density and implementation frequency.</CardDescription>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
              <Layers size={20} />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid #27272a', padding: '16px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Category Distribution */}
        <Card className="!p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
          <CardTitle className="text-lg mb-8">Cuisine Sector Yield</CardTitle>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.categorySales}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={10}
                  dataKey="value"
                >
                  {analytics?.categorySales?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid #27272a' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-zinc-900 dark:text-white">{analytics?.categorySales?.length || 0}</span>
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Sectors</span>
            </div>
          </div>
          <div className="space-y-3 mt-6">
            {analytics?.categorySales?.slice(0, 4).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-300">{cat.name}</span>
                </div>
                <span className="text-xs font-black text-zinc-900 dark:text-white">₹{cat.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Staff Performance */}
        <Card className="lg:col-span-2 !p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <CardTitle className="text-lg">Personnel Efficiency Matrix</CardTitle>
            <Users size={16} className="text-zinc-500" />
          </div>
          <div className="space-y-6">
            {analytics?.staffPerformance?.slice(0, 5).map((staff, idx) => (
              <div key={idx} className="flex items-center gap-6 group">
                <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-amber-500 font-black text-xs">
                  {staff.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{staff.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">{staff.totalOrders} Units</span>
                      <span className="text-sm font-black text-zinc-900 dark:text-white">₹{staff.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(staff.revenue / (analytics?.staffPerformance[0]?.revenue || 1)) * 100}%` }}
                      transition={{ duration: 1, delay: idx * 0.1 }}
                      className="h-full bg-amber-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
