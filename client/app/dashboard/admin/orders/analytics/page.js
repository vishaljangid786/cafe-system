'use client';
import { useState, useEffect } from 'react';
import { 
  BarChart3, Clock, AlertCircle, CheckCircle2, 
  XCircle, Filter, Search, Globe, ChefHat,
  TrendingUp, Timer, Activity, Zap, 
  Calendar, ArrowRight, Download, RefreshCw,
  PieChart as PieIcon, LineChart as LineIcon
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../../context/AuthContext';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, AreaChart, Area,
  PieChart, Pie, Sector
} from 'recharts';

export default function OrderAnalyticsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [locations, setLocations] = useState([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const branchQuery = branchFilter !== 'all' ? `&branchId=${branchFilter}` : '';
      const dateQuery = `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const [analyticsRes, locRes] = await Promise.all([
        api.get(`/orders/analytics?${branchQuery}${dateQuery}`),
        api.get('/locations')
      ]);
      setData(analyticsRes.data.data);
      setLocations(locRes.data.data);
    } catch (error) {
      toast.error('Failed to aggregate analytical data');
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
    fetchAnalytics();
  }, [branchFilter, dateRange]);

  if (loading && !data) return (
    <div className="flex items-center justify-center h-[70vh]">
      <RefreshCw className="animate-spin text-amber-500" size={48} />
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header & Global Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
              <TrendingUp className="text-amber-500" size={36} />
              Culinary Intelligence
            </h1>
            <p className="text-zinc-500 text-sm font-bold mt-1 tracking-tight">Deep-dive behavioral mapping and kitchen performance auditing.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-2 px-4 border-r border-zinc-100 dark:border-zinc-800">
              <Globe size={16} className="text-zinc-400" />
              {user?.role === 'branch_admin' ? (
                <span className="text-xs font-black text-amber-500 py-2">
                  {locations.find(l => l._id === branchFilter)?.name || 'My Branch'}
                </span>
              ) : (
                <select 
                  className="bg-transparent text-xs font-black outline-none py-2"
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                >
                  <option value="all">Global Network</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              )}
            </div>
            
            <div className="flex items-center gap-3 px-4">
              <Calendar size={16} className="text-zinc-400" />
              <input 
                type="date" 
                className="bg-transparent text-[10px] font-black outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <ArrowRight size={12} className="text-zinc-300" />
              <input 
                type="date" 
                className="bg-transparent text-[10px] font-black outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>

            <button 
              onClick={fetchAnalytics}
              className="p-3 bg-amber-500 text-black rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Vital Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <MetricCard label="Total Orders" value={data?.metrics?.totalOrders} icon={Activity} color="amber" />
          <MetricCard label="Avg Prep Time" value={`${data?.metrics?.avgPrepTime}m`} icon={Timer} color="blue" />
          <MetricCard label="Cancellations" value={data?.metrics?.cancelledOrders} icon={XCircle} color="rose" />
          <MetricCard label="Rejections" value={data?.metrics?.rejectedOrders} icon={AlertCircle} color="rose" />
          <MetricCard label="Peak Hour" value={data?.metrics?.peakHour} icon={Zap} color="emerald" />
        </div>

        {/* Charts Matrix */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Distribution Chart */}
          <div className="xl:col-span-8 glass-morphism rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                  <LineIcon size={16} className="text-amber-500" /> Hourly Volume Distribution
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-tight">Order density across 24-hour cycle</p>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts?.ordersPerHour}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="hour" stroke="#71717a" fontSize={10} fontWeight={900} />
                  <YAxis stroke="#71717a" fontSize={10} fontWeight={900} />
                  <Tooltip 
                    itemStyle={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown Pie */}
          <div className="xl:col-span-4 glass-morphism rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2">
              <PieIcon size={16} className="text-blue-500" /> Status Segmentation
            </h3>
            <div className="flex-1 min-h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.charts?.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {data?.charts?.ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#a1a1aa'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {data?.charts?.ordersByStatus.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#a1a1aa'][i % 5] }} />
                  <span className="text-[10px] font-black uppercase tracking-tighter truncate">{s.name}</span>
                  <span className="text-[10px] font-black text-zinc-400 ml-auto">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chef Performance Leaderboard */}
          <div className="xl:col-span-12 glass-morphism rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                  <ChefHat size={16} className="text-amber-500" /> Culinary Throughput Ranking
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-tight">Average preparation time and total volume by chef</p>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white dark:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all">
                <Download size={14} /> Export Dataset
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {data?.charts?.chefPerformance.sort((a, b) => a.avgTime - b.avgTime).map((chef, i) => (
                <div key={i} className="relative p-6 bg-zinc-50 dark:bg-zinc-950/30 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ChefHat size={60} />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Rank #{i + 1}</span>
                    <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg text-zinc-500">{chef.total} Orders</span>
                  </div>
                  <h4 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">{chef.name}</h4>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Avg Efficiency</p>
                      <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">{chef.avgTime}m</p>
                    </div>
                    <div className="h-10 w-24 rounded-lg overflow-hidden relative">
                       {/* Mini visual indicator */}
                       <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800" />
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(10, 100 - (chef.avgTime * 2))}%` }}
                        className="absolute inset-0 bg-emerald-500/30 border-r-2 border-emerald-500" 
                       />
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.charts?.chefPerformance || data.charts.chefPerformance.length === 0) && (
                <div className="lg:col-span-4 h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-800/50 rounded-[2.5rem] opacity-30 italic text-xs font-bold text-zinc-500">
                  Insufficient throughput data to generate rankings.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function MetricCard({ label, value, icon: Icon, color }) {
  const colors = {
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-amber-500/5',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5'
  };

  return (
    <CardHover>
      <div className="glass-morphism p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 flex flex-col items-center text-center group hover:scale-105 transition-all duration-500">
        <div className={`h-12 w-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-4 border shadow-inner group-hover:rotate-12 transition-transform duration-500`}>
          <Icon size={22} strokeWidth={2.5} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">{label}</p>
        <h4 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">{value || '0'}</h4>
      </div>
    </CardHover>
  );
}
