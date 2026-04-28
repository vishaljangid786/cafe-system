'use client';
import { useState, useEffect } from 'react';
import {
  BarChart3, Clock, AlertCircle, CheckCircle2,
  XCircle, Filter, Search, Globe, ChefHat,
  TrendingUp, Timer, Activity, Zap,
  Calendar, ArrowRight, Download, RefreshCw,
  PieChart as PieIcon, LineChart as LineIcon,
  MapPin, Building, Mail, Phone, ChevronDown
} from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
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
  const [selectedBranchDetails, setSelectedBranchDetails] = useState(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

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
              Order Analysis
            </h1>
            <p className="text-zinc-500 text-sm font-bold mt-1 tracking-tight">Detailed report of orders and kitchen performance.</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl p-2.5 rounded-[2rem] border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl relative z-[60]">
            {/* Branch Selector - Premium Custom Dropdown */}
            <div className="relative border-r border-zinc-200 dark:border-zinc-800 pr-4 ml-2">
              {user?.role === 'branch_admin' ? (
                <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <Globe size={14} className="text-amber-500" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    {locations.find(l => l._id === branchFilter)?.name || 'My Branch'}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all group"
                  >
                    <Globe size={16} className={`${branchFilter === 'all' ? 'text-amber-500' : 'text-blue-500'} group-hover:rotate-12 transition-transform`} />
                    <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-[0.15em]">
                      {branchFilter === 'all' ? 'All Branches' : locations.find(l => l._id === branchFilter)?.name}
                    </span>
                    <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isBranchDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsBranchDropdownOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full left-0 mt-4 w-64 bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 p-2 overflow-hidden"
                        >
                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            <button
                              onClick={() => {
                                setBranchFilter('all');
                                setIsBranchDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${branchFilter === 'all'
                                ? 'bg-amber-500 text-black'
                                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                                }`}
                            >
                              <Globe size={14} /> All Branches
                            </button>
                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2 mx-2" />
                            {locations.map(loc => (
                              <button
                                key={loc._id}
                                onClick={() => {
                                  setBranchFilter(loc._id);
                                  setIsBranchDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${branchFilter === loc._id
                                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                                  }`}
                              >
                                <Building size={14} /> {loc.name}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 px-6">
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-zinc-400" />
                <input
                  type="date"
                  className="bg-transparent text-[10px] font-black outline-none text-zinc-900 dark:text-zinc-100 uppercase tracking-widest cursor-pointer"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className="bg-transparent text-[10px] font-black outline-none text-zinc-900 dark:text-zinc-100 uppercase tracking-widest cursor-pointer"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={fetchAnalytics}
              className="p-3.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl shadow-zinc-900/10 dark:shadow-none mr-1"
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

        {/* Strategic Infrastructure - Persistent Navigation Grid */}
        <div className="xl:col-span-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-500/80 flex items-center gap-3 mb-2">
                <div className="h-1 w-8 bg-amber-500 rounded-full" />
                Branch Performance
              </h3>
              <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">Branch <span className="text-zinc-400">List</span></h2>
              <p className="text-sm font-bold text-zinc-500 mt-2 max-w-xl leading-relaxed">View real-time orders and efficiency across all branches.</p>
            </div>
            <div className="flex items-center gap-3 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50">
              <div className="px-4 py-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mr-2">Status:</span>
                <span className="text-xs font-black text-emerald-500">Live</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {/* Global Hub Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setBranchFilter('all')}
              className={`group relative p-6 rounded-[2.5rem] border overflow-hidden cursor-pointer transition-all duration-500 ${branchFilter === 'all'
                ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white shadow-2xl'
                : 'bg-white dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 hover:border-amber-500/40'
                }`}
            >
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl transition-opacity duration-700 ${branchFilter === 'all' ? 'bg-amber-500/20 opacity-100' : 'bg-amber-500/5 opacity-0 group-hover:opacity-100'
                }`} />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${branchFilter === 'all'
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100'
                    }`}>
                    <Globe size={20} strokeWidth={2.5} />
                  </div>
                  {branchFilter === 'all' && (
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest border border-amber-500/30">
                      Active
                    </span>
                  )}
                </div>
                <h4 className={`text-xl font-black tracking-tighter mb-1 transition-colors ${branchFilter === 'all' ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'
                  }`}>All Branches</h4>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${branchFilter === 'all' ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500'
                  }`}>Combined Data</p>

                <div className="mt-auto pt-6 flex items-center justify-between">
                  <div>
                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${branchFilter === 'all' ? 'text-zinc-500' : 'text-zinc-400'
                      }`}>Total Orders</p>
                    <p className={`text-lg font-black tracking-tighter ${branchFilter === 'all' ? 'text-amber-500' : 'text-zinc-900 dark:text-zinc-100'
                      }`}>{data?.metrics?.totalOrders} <span className="text-[10px]">Units</span></p>
                  </div>
                  <ArrowRight size={16} className={branchFilter === 'all' ? 'text-amber-500' : 'text-zinc-300'} />
                </div>
              </div>
            </motion.div>

            {/* Branch Specific Cards */}
            {data?.charts?.branchPerformance.map((branch, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setBranchFilter(branch.id)}
                className={`group relative p-6 rounded-[2.5rem] border overflow-hidden cursor-pointer transition-all duration-500 ${branchFilter === branch.id
                  ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white shadow-2xl'
                  : 'bg-white dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 hover:border-blue-500/40'
                  }`}
              >
                <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl transition-opacity duration-700 ${branchFilter === branch.id ? 'bg-blue-500/20 opacity-100' : 'bg-blue-500/5 opacity-0 group-hover:opacity-100'
                  }`} />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${branchFilter === branch.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100'
                      }`}>
                      <Building size={20} strokeWidth={2.5} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBranchDetails(locations.find(l => l._id === branch.id));
                      }}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${branchFilter === branch.id
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-blue-500'
                        }`}
                    >
                      <Zap size={14} />
                    </button>
                  </div>

                  <h4 className={`text-xl font-black tracking-tighter mb-1 truncate transition-colors ${branchFilter === branch.id ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'
                    }`}>{branch.name}</h4>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${branchFilter === branch.id ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500'
                    }`}>{branch.city} Area</p>

                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${branchFilter === branch.id ? 'text-zinc-500' : 'text-zinc-400'
                        }`}>Orders</p>
                      <p className={`text-lg font-black tracking-tighter ${branchFilter === branch.id ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'
                        }`}>{branch.totalOrders}</p>
                    </div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${branchFilter === branch.id ? 'text-zinc-500' : 'text-zinc-400'
                        }`}>Avg Time</p>
                      <p className={`text-lg font-black tracking-tighter ${branchFilter === branch.id ? 'text-blue-400' : 'text-blue-500'
                        }`}>{branch.avgPrepTime}m</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Charts Matrix */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Distribution Chart */}
          <div className="xl:col-span-8 glass-morphism rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 p-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                  <LineIcon size={16} className="text-amber-500" /> Hourly Orders
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-tight">Orders received throughout the day</p>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts?.ordersPerHour}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
              <PieIcon size={16} className="text-blue-500" /> Order Status
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
                  <ChefHat size={16} className="text-amber-500" /> Top Performing Chefs
                </h3>
                <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-tight">Average cooking time and total orders by chef</p>
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
                  Not enough data to show rankings.
                </div>
              )}
            </div>
          </div>
        </div>
        <Modal
          isOpen={!!selectedBranchDetails}
          onClose={() => setSelectedBranchDetails(null)}
          title="Branch Details"
        >
          {selectedBranchDetails && (
            <div className="space-y-10 p-2">
              <div className="flex items-center gap-8 p-8 bg-zinc-50 dark:bg-zinc-950/50 rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="h-24 w-24 rounded-3xl bg-white dark:bg-zinc-900 text-blue-500 flex items-center justify-center shadow-xl border border-zinc-200/50 dark:border-zinc-800 relative z-10">
                  <Building size={48} strokeWidth={1.5} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter leading-none mb-3">{selectedBranchDetails.name}</h3>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-3 py-1 rounded-lg bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white text-[9px] font-black uppercase tracking-widest">
                      Branch ID: {selectedBranchDetails._id.substring(0, 8)}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-widest border border-blue-500/20">
                      {selectedBranchDetails.city} Area
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col gap-4 group hover:border-amber-500/30 transition-all">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-amber-500 transition-colors">
                    <Mail size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Email</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedBranchDetails.contactEmail || 'N/A'}</p>
                  </div>
                </div>
                <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col gap-4 group hover:border-amber-500/30 transition-all">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-amber-500 transition-colors">
                    <Phone size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Phone</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedBranchDetails.contactPhone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="relative p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 text-amber-500/10 group-hover:rotate-12 transition-transform duration-700">
                  <MapPin size={80} />
                </div>
                <div className="relative z-10">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-3 mb-6">
                    <div className="h-1 w-6 bg-amber-500 rounded-full" />
                    Branch Address
                  </h4>
                  <div className="space-y-4">
                    <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 leading-tight max-w-xs">
                      {selectedBranchDetails.address}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      <span>ZIP: {selectedBranchDetails.pincode}</span>
                      <span className="h-1 w-1 bg-zinc-300 rounded-full" />
                      <span>COUNTRY: {selectedBranchDetails.country}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setBranchFilter(selectedBranchDetails._id);
                    setSelectedBranchDetails(null);
                  }}
                  className="w-full py-5 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-3xl text-xs font-black uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-zinc-900/20 dark:shadow-white/10"
                >
                  View Details
                </button>
                <p className="text-center text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                  Authorized access only
                </p>
              </div>
            </div>
          )}
        </Modal>
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
