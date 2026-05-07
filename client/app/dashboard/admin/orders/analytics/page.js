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
      const timer = setTimeout(() => {
        setBranchFilter(user.assignedLocation._id || user.assignedLocation);
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
    }, 0);

    return () => clearTimeout(timer);
  }, [branchFilter, dateRange]);

  if (loading && !data) return (
    <div className="flex items-center justify-center h-[70vh]">
      <RefreshCw className="animate-spin text-[var(--color-primary)]" size={48} />
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header & Global Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-[var(--color-text-primary)]">
              <TrendingUp className="text-[var(--color-primary)]" size={36} />
              Order Analysis
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm font-bold mt-1 tracking-tight">Detailed report of orders and kitchen performance.</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 bg-[var(--color-surface)]/70 backdrop-blur-xl p-2.5 rounded-[2rem] border border-[var(--color-border)] shadow-2xl relative z-[60]">
            {/* Branch Selector - Premium Custom Dropdown */}
            <div className="relative border-r border-[var(--color-border)] pr-4 ml-2">
              {user?.role === 'branch_admin' ? (
                <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-primary)]/10 rounded-xl border border-[var(--color-primary)]/20">
                  <Globe size={14} className="text-[var(--color-primary)]" />
                  <span className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest">
                    {locations.find(l => l._id === branchFilter)?.name || 'My Branch'}
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--color-surface-soft)] rounded-xl transition-all group"
                  >
                    <Globe size={16} className={`${branchFilter === 'all' ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'} group-hover:rotate-12 transition-transform`} />
                    <span className="text-[10px] font-black text-[var(--color-text-primary)] uppercase tracking-[0.15em]">
                      {branchFilter === 'all' ? 'All Branches' : locations.find(l => l._id === branchFilter)?.name}
                    </span>
                    <ChevronDown size={14} className={`text-[var(--color-text-muted)] transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
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
                          className="absolute top-full left-0 mt-4 w-64 bg-[var(--color-surface)] rounded-[1.5rem] border border-[var(--color-border)] shadow-2xl z-50 p-2 overflow-hidden"
                        >
                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            <button
                              onClick={() => {
                                setBranchFilter('all');
                                setIsBranchDropdownOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${branchFilter === 'all'
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'
                                }`}
                            >
                              <Globe size={14} /> All Branches
                            </button>
                            <div className="h-px bg-[var(--color-border)] my-2 mx-2" />
                            {locations.map(loc => (
                              <button
                                key={loc._id}
                                onClick={() => {
                                  setBranchFilter(loc._id);
                                  setIsBranchDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${branchFilter === loc._id
                                  ? 'bg-[var(--color-primary)] text-[var(--color-bg-base)] shadow-lg shadow-[var(--color-primary)]/20'
                                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'
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
                <Calendar size={14} className="text-[var(--color-text-muted)]" />
                <input
                  type="date"
                  className="bg-transparent text-[10px] font-black outline-none text-[var(--color-text-primary)] uppercase tracking-widest cursor-pointer"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="h-4 w-px bg-[var(--color-border)]" />
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className="bg-transparent text-[10px] font-black outline-none text-[var(--color-text-primary)] uppercase tracking-widest cursor-pointer"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={fetchAnalytics}
              className="p-3.5 bg-[var(--color-text-primary)] text-[var(--color-bg-base)] rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl shadow-[var(--color-primary)]/10 mr-1"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Vital Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <MetricCard label="Total Orders" value={data?.metrics?.totalOrders} icon={Activity} color="amber" />
          <MetricCard label="Avg Prep Time" value={`${data?.metrics?.avgPrepTime}m`} icon={Timer} color="amber" />
          <MetricCard label="Cancellations" value={data?.metrics?.cancelledOrders} icon={XCircle} color="rose" />
          <MetricCard label="Rejections" value={data?.metrics?.rejectedOrders} icon={AlertCircle} color="rose" />
          <MetricCard label="Peak Hour" value={data?.metrics?.peakHour} icon={Zap} color="emerald" />
        </div>

        {/* Strategic Infrastructure - Persistent Navigation Grid */}
        <div className="xl:col-span-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--color-primary)]/80 flex items-center gap-3 mb-2">
                <div className="h-1 w-8 bg-[var(--color-primary)] rounded-full" />
                Branch Performance
              </h3>
              <h2 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter">Branch <span className="text-[var(--color-text-muted)]">List</span></h2>
              <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2 max-w-xl leading-relaxed">View real-time orders and efficiency across all branches.</p>
            </div>
            <div className="flex items-center gap-3 p-1.5 bg-[var(--color-surface-soft)] rounded-2xl border border-[var(--color-border)]">
              <div className="px-4 py-2 bg-[var(--color-surface)] rounded-xl shadow-sm">
                <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mr-2">Status:</span>
                <span className="text-xs font-black text-emerald-500">Live</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {/* Global Center Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setBranchFilter('all')}
              className={`group relative p-6 rounded-[2.5rem] border overflow-hidden cursor-pointer transition-all duration-500 ${branchFilter === 'all'
                ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)] border-[var(--color-text-primary)] shadow-2xl'
                : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
                }`}
            >
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl transition-opacity duration-700 ${branchFilter === 'all' ? 'bg-[var(--color-primary)]/20 opacity-100' : 'bg-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100'
                }`} />

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${branchFilter === 'all'
                    ? 'bg-[var(--color-primary)] text-[var(--color-bg-base)]'
                    : 'bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'
                    }`}>
                    <Globe size={20} strokeWidth={2.5} />
                  </div>
                  {branchFilter === 'all' && (
                    <span className="px-3 py-1 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[8px] font-black uppercase tracking-widest border border-[var(--color-primary)]/30">
                      Active
                    </span>
                  )}
                </div>
                <h4 className={`text-xl font-black tracking-tighter mb-1 transition-colors ${branchFilter === 'all' ? 'text-[var(--color-bg-base)]' : 'text-[var(--color-text-primary)]'
                  }`}>All Branches</h4>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${branchFilter === 'all' ? 'opacity-60' : 'text-[var(--color-text-muted)]'
                  }`}>Combined Data</p>

                <div className="mt-auto pt-6 flex items-center justify-between">
                  <div>
                    <p className={`text-[8px] font-black uppercase tracking-widest mb-1 opacity-60`}>Total Orders</p>
                    <p className={`text-lg font-black tracking-tighter ${branchFilter === 'all' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                      }`}>{data?.metrics?.totalOrders} <span className="text-[10px]">Units</span></p>
                  </div>
                  <ArrowRight size={16} className={branchFilter === 'all' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
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
                  ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)] border-[var(--color-text-primary)] shadow-2xl'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
                  }`}
              >
                <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl transition-opacity duration-700 ${branchFilter === branch.id ? 'bg-[var(--color-primary)]/20 opacity-100' : 'bg-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100'
                  }`} />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${branchFilter === branch.id
                      ? 'bg-[var(--color-primary)] text-[var(--color-bg-base)]'
                      : 'bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'
                      }`}>
                      <Building size={20} strokeWidth={2.5} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBranchDetails(locations.find(l => l._id === branch.id));
                      }}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${branchFilter === branch.id
                        ? 'bg-[var(--color-bg-base)]/10 text-[var(--color-bg-base)] hover:bg-[var(--color-bg-base)]/20'
                        : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                        }`}
                    >
                      <Zap size={14} />
                    </button>
                  </div>

                  <h4 className={`text-xl font-black tracking-tighter mb-1 truncate transition-colors ${branchFilter === branch.id ? 'text-[var(--color-bg-base)]' : 'text-[var(--color-text-primary)]'
                    }`}>{branch.name}</h4>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${branchFilter === branch.id ? 'opacity-60' : 'text-[var(--color-text-muted)]'
                    }`}>{branch.city} Area</p>

                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 opacity-60`}>Orders</p>
                      <p className={`text-lg font-black tracking-tighter ${branchFilter === branch.id ? 'text-[var(--color-bg-base)]' : 'text-[var(--color-text-primary)]'
                        }`}>{branch.totalOrders}</p>
                    </div>
                    <div>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 opacity-60`}>Avg Time</p>
                      <p className={`text-lg font-black tracking-tighter text-[var(--color-primary)]`}>{branch.avgPrepTime}m</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Charts List */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Distribution Chart */}
          <div className="xl:col-span-8 glass-morphism rounded-[2.5rem] border border-[var(--color-border)] p-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-2">
                  <LineIcon size={16} className="text-[var(--color-primary)]" /> Hourly Orders
                </h3>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-tight">Orders received throughout the day</p>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} />
                  <Tooltip
                    itemStyle={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown Pie */}
          <div className="xl:col-span-4 glass-morphism rounded-[2.5rem] border border-[var(--color-border)] p-8 flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-8 flex items-center gap-2">
              <PieIcon size={16} className="text-[var(--color-primary)]" /> Order Status
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
                      <Cell key={`cell-${index}`} fill={['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-danger)', 'var(--color-text-muted)'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {data?.charts?.ordersByStatus.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-[var(--color-surface-soft)] rounded-xl border border-[var(--color-border)]">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-danger)', 'var(--color-text-muted)'][i % 5] }} />
                  <span className="text-[10px] font-black uppercase tracking-tighter truncate">{s.name}</span>
                  <span className="text-[10px] font-black text-[var(--color-text-muted)] ml-auto">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chef Performance Leaderboard */}
          <div className="xl:col-span-12 glass-morphism rounded-[2.5rem] border border-[var(--color-border)] p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-2">
                  <ChefHat size={16} className="text-[var(--color-primary)]" /> Top Performing Chefs
                </h3>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-tight">Average cooking time and total orders by chef</p>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-[var(--color-text-primary)] text-[var(--color-bg-base)] text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all">
                <Download size={14} /> Export Dataset
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {data?.charts?.chefPerformance.sort((a, b) => a.avgTime - b.avgTime).map((chef, i) => (
                <div key={i} className="relative p-6 bg-[var(--color-surface-soft)] rounded-[2rem] border border-[var(--color-border)] overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ChefHat size={60} />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest">Rank #{i + 1}</span>
                    <span className="text-[10px] font-black bg-[var(--color-surface)] px-2 py-1 rounded-lg text-[var(--color-text-muted)]">{chef.total} Orders</span>
                  </div>
                  <h4 className="text-xl font-black text-[var(--color-text-primary)] mb-4 tracking-tight">{chef.name}</h4>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Avg Efficiency</p>
                      <p className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter">{chef.avgTime}m</p>
                    </div>
                    <div className="h-10 w-24 rounded-lg overflow-hidden relative">
                      {/* Mini visual indicator */}
                      <div className="absolute inset-0 bg-[var(--color-bg-soft)]" />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(10, 100 - (chef.avgTime * 2))}%` }}
                        className="absolute inset-0 bg-[var(--color-success)]/30 border-r-2 border-[var(--color-success)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!data?.charts?.chefPerformance || data.charts.chefPerformance.length === 0) && (
                <div className="lg:col-span-4 h-40 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-[2.5rem] opacity-30 italic text-xs font-bold text-[var(--color-text-muted)]">
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
              <div className="flex items-center gap-8 p-8 bg-[var(--color-surface-soft)] rounded-[2.5rem] border border-[var(--color-border)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-full blur-3xl" />
                <div className="h-24 w-24 rounded-3xl bg-[var(--color-surface)] text-[var(--color-primary)] flex items-center justify-center shadow-xl border border-[var(--color-border)] relative z-10">
                  <Building size={48} strokeWidth={1.5} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tighter leading-none mb-3">{selectedBranchDetails.name}</h3>
                  <div className="flex flex-wrap gap-3">
                    <span className="px-3 py-1 rounded-lg bg-[var(--color-text-primary)] text-[var(--color-bg-base)] text-[9px] font-black uppercase tracking-widest">
                      Branch ID: {selectedBranchDetails._id.substring(0, 8)}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[9px] font-black uppercase tracking-widest border border-[var(--color-primary)]/20">
                      {selectedBranchDetails.city} Area
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] flex flex-col gap-4 group hover:border-[var(--color-primary)]/30 transition-all">
                  <div className="h-12 w-12 rounded-2xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                    <Mail size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">Email</p>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{selectedBranchDetails.contactEmail || 'N/A'}</p>
                  </div>
                </div>
                <div className="p-6 bg-[var(--color-surface)] rounded-3xl border border-[var(--color-border)] flex flex-col gap-4 group hover:border-[var(--color-primary)]/30 transition-all">
                  <div className="h-12 w-12 rounded-2xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                    <Phone size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">Phone</p>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{selectedBranchDetails.contactPhone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="relative p-8 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 rounded-[2.5rem] overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 text-[var(--color-primary)]/10 group-hover:rotate-12 transition-transform duration-700">
                  <MapPin size={80} />
                </div>
                <div className="relative z-10">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-primary)] flex items-center gap-3 mb-6">
                    <div className="h-1 w-6 bg-[var(--color-primary)] rounded-full" />
                    Branch Address
                  </h4>
                  <div className="space-y-4">
                    <p className="text-lg font-black text-[var(--color-text-primary)] leading-tight max-w-xs">
                      {selectedBranchDetails.address}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                      <span>ZIP: {selectedBranchDetails.pincode}</span>
                      <span className="h-1 w-1 bg-[var(--color-border)] rounded-full" />
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
                  className="w-full py-5 bg-[var(--color-text-primary)] text-[var(--color-bg-base)] rounded-3xl text-xs font-black uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-[var(--color-primary)]/20"
                >
                  View Details
                </button>
                <p className="text-center text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
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
    amber: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 shadow-[var(--color-primary)]/5',
    blue: 'text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 border-[var(--color-secondary)]/20 shadow-[var(--color-secondary)]/5',
    rose: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20 shadow-[var(--color-danger)]/5',
    emerald: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20 shadow-[var(--color-success)]/5'
  };

  return (
    <CardHover>
      <div className="glass-morphism p-6 rounded-[2rem] border border-[var(--color-border)] flex flex-col items-center text-center group hover:scale-105 transition-all duration-500">
        <div className={`h-12 w-12 rounded-2xl ${colors[color]} flex items-center justify-center mb-4 border shadow-inner group-hover:rotate-12 transition-transform duration-500`}>
          <Icon size={22} strokeWidth={2.5} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">{label}</p>
        <h4 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter">{value || '0'}</h4>
      </div>
    </CardHover>
  );
}
