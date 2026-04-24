'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  ChefHat, Utensils, Receipt, ShoppingBag,
  ChevronDown,
  MapPin
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { StatWidget } from '../../components/ui/StatWidget';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ExportActions from '../../components/ui/ExportActions';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, selectedLocation: authLocation } = useAuth();
  const [locations, setLocations] = useState([]);
  const [filterLocation, setFilterLocation] = useState('all');
  const [analytics, setAnalytics] = useState({
    summary: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, netProfit: 0, totalExpenses: 0 },
    timeSeries: [],
    categorySales: [],
    staffPerformance: [],
    recentExpenses: [],
    recentRevenues: []
  });
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all'); // '7d', '30d', 'all', 'custom'
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [isLocSelectorOpen, setIsLocSelectorOpen] = useState(false);

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations");
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterLocation !== 'all') params.append('locationId', filterLocation);
      
      const now = new Date();
      let start = '';
      let end = '';

      if (timeFilter === 'custom') {
        start = customDates.start;
        end = customDates.end;
      } else if (timeFilter !== 'all') {
        const d = new Date();
        if (timeFilter === 'today') d.setHours(0, 0, 0, 0);
        else if (timeFilter === '7d') d.setDate(now.getDate() - 7);
        else if (timeFilter === '30d' || timeFilter === '1m') d.setMonth(now.getMonth() - 1);
        else if (timeFilter === '3m') d.setMonth(now.getMonth() - 3);
        else if (timeFilter === '6m') d.setMonth(now.getMonth() - 6);
        else if (timeFilter === '1y') d.setFullYear(now.getFullYear() - 1);
        
        start = d.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      }

      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);

      const res = await api.get(`/analytics/advanced?${params.toString()}`);
      setAnalytics(res.data.data);
    } catch (error) {
      console.error("Failed to fetch analytics");
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    // Only auto-filter if user is not a super_admin or admin (who usually want global view)
    // Or if they explicitly have a selectedLocation that isn't 'all'
    if (authLocation && user?.role !== 'super_admin' && user?.role !== 'admin') {
      setFilterLocation(authLocation._id || authLocation);
    }
  }, [authLocation, user]);

  useEffect(() => {
    fetchAnalytics();
  }, [filterLocation, timeFilter, customDates]);
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
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Business Overview</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white flex flex-wrap items-baseline gap-2 sm:gap-3">
            {filterLocation === 'all' ? 'Network' : (locations.find(l => l._id === filterLocation)?.city || 'Branch')}
            <span className="text-amber-500">Analytics</span>
          </h1>
          <p className="text-sm text-zinc-400 font-medium max-w-lg leading-relaxed">
            Live sales tracking and performance overview for {filterLocation === 'all' ? 'all branches' : (locations.find(l => l._id === filterLocation)?.name || 'selected branch')}.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4">
          <ExportActions 
            data={analytics?.timeSeries || []} 
            columns={[
              { header: 'Date', key: 'date' },
              { header: 'Revenue', key: 'revenue' },
              { header: 'Profit', key: 'profit' },
              { header: 'Expenses', key: 'expenses' },
              { header: 'Orders', key: 'orders' }
            ]} 
            filename="analytics_report" 
            hasCharts={true}
          />
          {/* Location Filter */}
          <div className="relative">
            <button
              onClick={() => setIsLocSelectorOpen(!isLocSelectorOpen)}
              className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-amber-500/50 transition-all min-w-[140px] sm:min-w-[180px]"
            >
              <MapPin size={16} className="text-amber-500" />
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Branch Switcher</span>
                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                  {filterLocation === 'all' ? 'All Branches' : locations.find(l => l._id === filterLocation)?.name}
                </span>
              </div>
              <ChevronDown size={14} className={`ml-auto transition-transform ${isLocSelectorOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isLocSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-3 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl z-50 p-3 max-h-[300px] overflow-y-auto custom-scrollbar"
                >
                  <button
                    onClick={() => { setFilterLocation('all'); setIsLocSelectorOpen(false); }}
                    className={`w-full text-left p-3 rounded-xl mb-1 text-xs font-bold transition-colors ${filterLocation === 'all' ? 'bg-amber-500/10 text-amber-500' : 'hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-500'}`}
                  >
                    All Branches
                  </button>
                  {locations.map(loc => (
                    <button
                      key={loc._id}
                      onClick={() => { setFilterLocation(loc._id); setIsLocSelectorOpen(false); }}
                      className={`w-full text-left p-3 rounded-xl mb-1 text-xs font-bold transition-colors ${filterLocation === loc._id ? 'bg-amber-500/10 text-amber-500' : 'hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-500'}`}
                    >
                      {loc.name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 bg-white/40 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md overflow-x-auto no-scrollbar max-w-full">
            {['today', '7d', '30d', 'all', 'custom'].map(t => (
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
      </div>

      {timeFilter === 'custom' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4 p-6 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm"
        >
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 ml-1">Start Date</label>
            <input type="date" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2 ml-1">End Date</label>
            <input type="date" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatWidget label="Total Orders" value={analytics.summary.totalOrders || '0'} icon={<ShoppingBag size={20} />} color="blue" delay={0.3} />
        <StatWidget label="Total Sales" value={`₹${analytics?.summary?.totalRevenue?.toLocaleString() || '0'}`} icon={TrendingUp} color="amber" delay={0} />
        <StatWidget label="Net Profit" value={`₹${analytics?.summary?.netProfit?.toLocaleString() || '0'}`} icon={Zap} color="green" delay={0.1} />
        <StatWidget label="Expenses" value={`₹${analytics?.summary?.totalExpenses?.toLocaleString() || '0'}`} icon={Wallet} color="rose" delay={0.2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 !p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <CardTitle className="text-xl">Sales Trends</CardTitle>
            <TrendingUp size={20} className="text-amber-500" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.timeSeries}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `₹${v / 1000}k`} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Orders Timeline */}
        <Card className="!p-8 bg-zinc-950/20 border-zinc-800/50 export-chart" hover={false}>
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <CardTitle className="text-xl">Daily Orders</CardTitle>
              <CardDescription>Daily order count summary.</CardDescription>
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
                <Tooltip />
                <Bar dataKey="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Expenditures */}
        <Card className="!p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Recent Expenses</CardTitle>
              <CardDescription>Latest spending across branches.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="space-y-4">
            {analytics?.recentExpenses?.length > 0 ? (
              analytics.recentExpenses.map((exp, idx) => (
                <motion.div
                  key={exp._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-rose-500/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Receipt size={18} className="text-rose-500" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{exp.title}</h5>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{exp.locationId?.name || 'Global'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-rose-500">-₹{exp.totalAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">{new Date(exp.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-zinc-500 font-medium italic text-sm">No recent expenditures recorded.</div>
            )}
          </div>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard/admin/expenses')}
            className="w-full mt-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            View Full Records
          </Button>
        </Card>

        {/* Recent Revenues */}
        <Card className="!p-8 bg-white dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/50" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Recent Sales</CardTitle>
              <CardDescription>Latest completed orders.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="space-y-4">
            {analytics?.recentRevenues?.length > 0 ? (
              analytics.recentRevenues.map((rev, idx) => (
                <motion.div
                  key={rev._id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ShoppingBag size={18} className="text-emerald-500" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate w-32 sm:w-auto">
                        Order #{rev._id.substring(rev._id.length - 6).toUpperCase()}
                      </h5>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Marked by {rev.staffId?.name || 'Staff'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-500">+₹{rev.totalAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">{new Date(rev.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-zinc-500 font-medium italic text-sm">No recent revenue detected.</div>
            )}
          </div>
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard/admin/revenue')}
            className="w-full mt-6 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            View All Records
          </Button>
        </Card>
      </div>
    </div>
  );
}
