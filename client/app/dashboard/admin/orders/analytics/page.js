'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Clock, AlertCircle, CheckCircle2,
  XCircle, Filter, Search, Globe, ChefHat,
  TrendingUp, Timer, Activity, Zap,
  Calendar, ArrowRight, Download, RefreshCw,
  PieChart as PieIcon, LineChart as LineIcon,
  MapPin, Building, Mail, Phone, ChevronDown,
  FilterX, Layers, Wallet, IndianRupee, Sparkles,
  ShoppingBag as BagIcon, Target, Cpu
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
import UniversalDateFilter from '../../../../components/ui/UniversalDateFilter';

export default function OrderAnalyticsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [locations, setLocations] = useState([]);
  const [selectedBranchDetails, setSelectedBranchDetails] = useState(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  const fetchAnalytics = useCallback(async () => {
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
      toast.error('Failed to calculate report data');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, dateRange]);

  useEffect(() => {
    if (user?.role === 'branch_admin' && user?.assignedLocation) {
      setBranchFilter(user.assignedLocation._id || user.assignedLocation);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportAnalyticsData = () => {
    if (!data) return toast.error('No data available to export');

    const timestamp = new Date().toISOString().split('T')[0];
    const branchName = branchFilter === 'all' ? 'All_Sectors' : locations.find(l => l._id === branchFilter)?.name.replace(/\s+/g, '_');
    
    // Header for Sector Performance
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "--- SECTOR PERFORMANCE ---\n";
    csvContent += "Sector Name,City,Total Orders,Avg Prep Time (m)\n";
    
    data.charts.branchPerformance.forEach(b => {
      csvContent += `${b.name},${b.city},${b.totalOrders},${b.avgPrepTime}\n`;
    });

    csvContent += "\n--- CULINARY INTELLIGENCE ---\n";
    csvContent += "Chef Name,Total Orders,Avg Fulfillment Speed (m)\n";
    
    data.charts.chefPerformance.forEach(c => {
      csvContent += `${c.name},${c.total},${c.avgTime}\n`;
    });

    csvContent += "\n--- GLOBAL METRICS ---\n";
    csvContent += `Total Orders,${data.metrics.totalOrders}\n`;
    csvContent += `Avg Prep Time,${data.metrics.avgPrepTime}m\n`;
    csvContent += `Cancelled Orders,${data.metrics.cancelledOrders}\n`;
    csvContent += `Rejected Orders,${data.metrics.rejectedOrders}\n`;
    csvContent += `Peak Load Hour,${data.metrics.peakHour}:00\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Analytics_Export_${branchName}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Intelligence Dossier Exported');
  };

  const resetFilters = () => {
    setBranchFilter(user?.role === 'branch_admin' ? (user.assignedLocation?._id || user.assignedLocation) : 'all');
    setDateRange({ start: '', end: '' });
    toast.success('Terminal reset to defaults');
  };

  if (loading && !data) return (
    <div className="flex items-center justify-center h-[70vh] flex-col gap-6">
      <div className="relative">
        <RefreshCw className="animate-spin text-blue-500" size={64} />
        <div className="absolute inset-0 blur-2xl bg-blue-500/20 rounded-full animate-pulse" />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.4em] text-[var(--color-text-muted)] animate-pulse">Updating Global Reports...</p>
    </div>
  );

  return (
    <PageTransition>
      <div className="relative space-y-12 pb-24">
        {/* Cinematic Grid Background Layer */}
        <div className="fixed inset-0 pointer-events-none z-[-1] opacity-[0.03]" 
             style={{ backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <div className="fixed inset-0 pointer-events-none z-[-1] bg-gradient-to-b from-transparent via-[var(--color-bg-base)]/50 to-[var(--color-bg-base)]" />

        {/* Futuristic Command Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-600/30 relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
               <TrendingUp size={36} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-[var(--color-text-primary)] leading-none mb-2">
                Order <span className="text-blue-500">Analytics</span>
              </h1>
              <div className="flex items-center gap-3">
                 <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-emerald-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Dataset
                 </div>
                 <div className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                   {user?.role === 'branch_admin' ? 'Branch operational monitor active' : 'Global operations monitoring active'}
                 </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button
               onClick={exportAnalyticsData}
               className="h-14 px-8 bg-[var(--color-surface)] hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)] rounded-2xl border border-[var(--color-border)] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-sm flex items-center gap-3 active:scale-95"
             >
               <Download size={18} /> Export CSV
             </button>
             <button
               onClick={fetchAnalytics}
               className="h-14 w-14 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-90"
             >
               <RefreshCw size={22} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>

        {/* Modular Command Console (Filters) */}
        <div className="relative">
           <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-2xl opacity-10 -z-10 rounded-[3.5rem]" />
           <div className="bg-[var(--color-surface)] p-2 rounded-[3.5rem] border border-[var(--color-border)] shadow-2xl space-y-2">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                 {/* Branch Selector */}
                 <div className="lg:col-span-4 bg-[var(--color-surface-soft)] rounded-[2.5rem] p-1.5 border border-[var(--color-border)] relative">
                    {user?.role === 'branch_admin' ? (
                       <div className="h-12 w-full flex items-center px-8 text-blue-500 gap-3">
                          <Building size={16} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{locations.find(l => l._id === branchFilter)?.name || 'Restricted Session'}</span>
                       </div>
                    ) : (
                       <div className="relative h-full">
                          <button 
                            onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                            className="w-full h-12 flex items-center justify-between px-8 text-[var(--color-text-primary)] hover:text-blue-500 transition-colors"
                          >
                             <div className="flex items-center gap-3">
                                <Globe size={16} className={branchFilter === 'all' ? 'text-blue-500' : 'text-indigo-500'} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                                   {branchFilter === 'all' ? 'All Global Sectors' : locations.find(l => l._id === branchFilter)?.name}
                                </span>
                             </div>
                             <ChevronDown size={14} className={`transition-transform duration-300 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                             {isBranchDropdownOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute top-full left-0 right-0 mt-4 bg-[var(--color-surface)] rounded-[2rem] border border-[var(--color-border)] shadow-2xl z-[100] p-3 overflow-hidden"
                                >
                                   <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                      {user?.role !== 'branch_admin' && (
                                         <>
                                            <button 
                                              onClick={() => { setBranchFilter('all'); setIsBranchDropdownOpen(false); }}
                                              className={`w-full p-4 rounded-xl text-left text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${branchFilter === 'all' ? 'bg-blue-600 text-white' : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}
                                            >
                                               <Globe size={14} /> All Sectors
                                            </button>
                                            <div className="h-px bg-[var(--color-border)] my-2" />
                                         </>
                                      )}
                                      {locations.map(loc => (
                                         <button 
                                           key={loc._id}
                                           onClick={() => { setBranchFilter(loc._id); setIsBranchDropdownOpen(false); }}
                                           className={`w-full p-4 rounded-xl text-left text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${branchFilter === loc._id ? 'bg-blue-600 text-white' : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}
                                         >
                                            <Building size={14} /> {loc.name}
                                         </button>
                                      ))}
                                   </div>
                                </motion.div>
                             )}
                          </AnimatePresence>
                       </div>
                    )}
                 </div>

                 {/* Temporal Controller */}
                 <div className="lg:col-span-6 bg-[var(--color-surface-soft)] rounded-[2.5rem] p-1.5 border border-[var(--color-border)] flex items-center px-6">
                    <UniversalDateFilter 
                      onFilterChange={({ startDate, endDate }) => setDateRange({ start: startDate, end: endDate })}
                      loading={loading}
                      className="w-full"
                    />
                 </div>

                 {/* Reset Command */}
                 <div className="lg:col-span-2">
                    <button 
                      onClick={resetFilters}
                      className="w-full h-full min-h-[60px] bg-[var(--color-surface-soft)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 rounded-[2.5rem] border border-[var(--color-border)] text-[var(--color-text-muted)] font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 group"
                    >
                       <FilterX size={18} className="group-hover:rotate-12 transition-transform" /> Reset Terminal
                    </button>
                 </div>
              </div>
           </div>
        </div>

        {/* Tactical Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <MetricCard label="Total Orders" value={data?.metrics?.totalOrders} icon={BagIcon} color="blue" />
          <MetricCard label="Avg Fulfillment" value={`${data?.metrics?.avgPrepTime}m`} icon={Timer} color="indigo" />
          <MetricCard label="Failure Rate" value={`${((data?.metrics?.cancelledOrders + data?.metrics?.rejectedOrders) / (data?.metrics?.totalOrders || 1) * 100).toFixed(1)}%`} icon={AlertCircle} color="rose" />
          <MetricCard label="Peak Sector" value={data?.metrics?.peakHour} icon={Target} color="amber" />
          <MetricCard label="Active Chefs" value={data?.charts?.chefPerformance?.length} icon={Cpu} color="emerald" />
        </div>

        {/* High-Fidelity Data Visualization */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Distribution Chart */}
          <div className="xl:col-span-8 bg-[var(--color-surface)] rounded-[3rem] border border-[var(--color-border)] p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
               <LineIcon size={200} />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] flex items-center gap-3">
                  <Activity size={18} className="text-blue-500" /> Hourly Load Analytics
                </h3>
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 uppercase tracking-tight">Real-time throughput distribution per sector</p>
              </div>
              <div className="px-4 py-1 bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-blue-500/20">
                 Peak Load: {Math.max(...(data?.charts?.ordersPerHour?.map(d => d.count) || [0]))} Units
              </div>
            </div>
            <div className="h-[350px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.charts?.ordersPerHour}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--color-text-muted)" fontSize={10} fontWeight={900} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1.5rem', border: '1px solid #27272a' }}
                    itemStyle={{ color: '#3b82f6', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown Pie */}
          <div className="xl:col-span-4 bg-[var(--color-surface)] rounded-[3rem] border border-[var(--color-border)] p-10 shadow-sm flex flex-col relative overflow-hidden group">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-10 flex items-center gap-3">
              <PieIcon size={18} className="text-indigo-500" /> Quality Matrix
            </h3>
            <div className="flex-1 min-h-[300px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.charts?.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {data?.charts?.ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#6366f1', '#10b981', '#f43f5e', '#71717a'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', border: '1px solid #27272a' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Total</p>
                 <p className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter">{data?.metrics?.totalOrders}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8 relative z-10">
              {data?.charts?.ordersByStatus.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[var(--color-surface-soft)] rounded-2xl border border-[var(--color-border)]">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#6366f1', '#10b981', '#f43f5e', '#71717a'][i % 5] }} />
                  <span className="text-[9px] font-black uppercase tracking-tight truncate flex-1">{s.name}</span>
                  <span className="text-[10px] font-black text-blue-500">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Sector Grid (Branch List) */}
          <div className="xl:col-span-12 space-y-10">
             <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-500 flex items-center gap-3 mb-4">
                    <div className="h-1 w-8 bg-blue-500 rounded-full" />
                    Strategic Infrastructure
                  </h3>
                  <h2 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter">Sector <span className="text-blue-500">Breakdown</span></h2>
                  <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2 max-w-xl">Deep dive into individual branch performance and operational efficiency metrics.</p>
                </div>
             </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {/* Global Command Hub Card - Only for Super Admin */}
                {user?.role !== 'branch_admin' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setBranchFilter('all')}
                    className={`group relative p-8 rounded-[3rem] border overflow-hidden cursor-pointer transition-all duration-500 ${branchFilter === 'all'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xl shadow-blue-600/30'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-blue-500/40 shadow-sm'
                      }`}
                  >
                    <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl transition-opacity duration-700 ${branchFilter === 'all' ? 'bg-white/20 opacity-100' : 'bg-blue-500/5 opacity-0 group-hover:opacity-100'}`} />

                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${branchFilter === 'all' ? 'bg-white text-blue-600' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'}`}>
                          <Globe size={24} strokeWidth={2.5} />
                        </div>
                        {branchFilter === 'all' && (
                           <div className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md">Primary Hub</div>
                        )}
                      </div>
                      <h4 className="text-2xl font-black tracking-tighter mb-1">Global Sectors</h4>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${branchFilter === 'all' ? 'opacity-80' : 'text-[var(--color-text-muted)]'}`}>Consolidated Stream</p>

                      <div className="mt-10 flex items-center justify-between">
                         <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Total Signals</p>
                            <p className="text-2xl font-black tracking-tighter">{data?.metrics?.totalOrders}</p>
                         </div>
                         <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${branchFilter === 'all' ? 'border-white/20 bg-white/10' : 'border-[var(--color-border)] bg-[var(--color-surface-soft)]'}`}>
                            <ArrowRight size={18} />
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Individual Sector Cards - Filtered for Branch Admin */}
                {data?.charts?.branchPerformance
                  .filter(b => user?.role !== 'branch_admin' || b.id === (user?.assignedLocation?._id || user?.assignedLocation))
                  .map((branch, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setBranchFilter(branch.id)}
                    className={`group relative p-8 rounded-[3rem] border overflow-hidden cursor-pointer transition-all duration-500 ${branchFilter === branch.id
                      ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)] border-[var(--color-text-primary)] shadow-2xl'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-blue-500/40 shadow-sm'
                      }`}
                  >
                    <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl transition-opacity duration-700 ${branchFilter === branch.id ? 'bg-blue-500/10 opacity-100' : 'bg-blue-500/5 opacity-0 group-hover:opacity-100'}`} />

                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${branchFilter === branch.id ? 'bg-blue-500 text-white' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'}`}>
                          <Building size={24} strokeWidth={2.5} />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBranchDetails(locations.find(l => l._id === branch.id));
                          }}
                          className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${branchFilter === branch.id ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-blue-500'}`}
                        >
                          <Zap size={16} />
                        </button>
                      </div>

                      <h4 className="text-2xl font-black tracking-tighter mb-1 truncate">{branch.name}</h4>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${branchFilter === branch.id ? 'opacity-80' : 'text-[var(--color-text-muted)]'}`}>{branch.city} Area</p>

                      <div className="mt-10 grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Signals</p>
                          <p className="text-xl font-black tracking-tighter">{branch.totalOrders}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Efficiency</p>
                          <p className="text-xl font-black tracking-tighter text-blue-500">{branch.avgPrepTime}m</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
             </div>
          </div>

          {/* Culinary Intelligence (Chef Leaderboard) */}
          <div className="xl:col-span-12 bg-[var(--color-surface)] rounded-[3rem] border border-[var(--color-border)] p-12 relative overflow-hidden group">
            <div className="absolute top-0 left-0 p-20 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity">
               <ChefHat size={300} />
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 relative z-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-blue-500 flex items-center gap-3 mb-4">
                  <div className="h-1 w-10 bg-blue-500 rounded-full" />
                  Culinary Performance
                </h3>
                <h2 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter">Kitchen <span className="text-blue-500">Leaderboard</span></h2>
                <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2">Evaluation of fulfillment speed and precision across all executive chefs.</p>
              </div>
              <button className="h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-[1.5rem] shadow-2xl shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-4">
                <Download size={18} strokeWidth={3} /> Intelligence Report
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
              {data?.charts?.chefPerformance.sort((a, b) => a.avgTime - b.avgTime).map((chef, i) => (
                <div key={i} className="relative p-8 bg-[var(--color-surface-soft)] rounded-[2.5rem] border border-[var(--color-border)] overflow-hidden group/chef hover:border-blue-500/30 transition-all">
                  <div className="absolute -top-4 -right-4 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover/chef:bg-blue-500/10 transition-colors" />
                  
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center text-blue-500 border border-[var(--color-border)] shadow-sm">
                       <ChefHat size={22} />
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Rank #{i + 1}</span>
                       <span className="text-[10px] font-bold text-[var(--color-text-muted)] mt-0.5">{chef.total} Orders</span>
                    </div>
                  </div>

                  <h4 className="text-2xl font-black text-[var(--color-text-primary)] mb-6 tracking-tighter">{chef.name}</h4>
                  
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Fulfillment Speed</span>
                        <span className="text-xl font-black text-blue-500 tracking-tight">{chef.avgTime}m</span>
                     </div>
                     <div className="h-1.5 w-full bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-border)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(10, 100 - (chef.avgTime * 2))}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                        />
                     </div>
                  </div>
                </div>
              ))}
              {(!data?.charts?.chefPerformance || data.charts.chefPerformance.length === 0) && (
                <div className="lg:col-span-4 h-60 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-[3rem] opacity-30 italic text-[10px] font-black uppercase tracking-[0.3em]">
                   Signals insufficient for ranking data
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Branch Detail Modal */}
        <Modal
          isOpen={!!selectedBranchDetails}
          onClose={() => setSelectedBranchDetails(null)}
          title="Sector Intelligence Dossier"
          maxWidth="max-w-4xl"
        >
          {selectedBranchDetails && (
            <div className="space-y-10 p-4">
              <div className="flex items-center gap-8 p-10 bg-zinc-900 text-white rounded-[3rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px]" />
                <div className="h-28 w-28 rounded-[2.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 shadow-2xl relative z-10 backdrop-blur-md">
                  <Building size={56} strokeWidth={1} />
                </div>
                <div className="relative z-10 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                     <div className="px-3 py-1 bg-blue-500 rounded-full text-[9px] font-black uppercase tracking-widest">Active Sector</div>
                     <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">ID: {selectedBranchDetails._id.substring(0, 12)}</span>
                  </div>
                  <h3 className="text-4xl font-black tracking-tighter leading-none mb-4">{selectedBranchDetails.name}</h3>
                  <p className="text-sm font-medium text-white/60 flex items-center gap-2"><MapPin size={16} className="text-blue-500" /> {selectedBranchDetails.address}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-[var(--color-surface)] rounded-[2.5rem] border border-[var(--color-border)] flex flex-col gap-6 group hover:border-blue-500/30 transition-all shadow-sm">
                  <div className="h-14 w-14 rounded-2xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-blue-500 transition-all group-hover:scale-110">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-1">Communications</p>
                    <p className="text-lg font-black text-[var(--color-text-primary)] tracking-tight">{selectedBranchDetails.contactEmail || 'SECURE_CHANNEL_PENDING'}</p>
                  </div>
                </div>
                <div className="p-8 bg-[var(--color-surface)] rounded-[2.5rem] border border-[var(--color-border)] flex flex-col gap-6 group hover:border-blue-500/30 transition-all shadow-sm">
                  <div className="h-14 w-14 rounded-2xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-blue-500 transition-all group-hover:scale-110">
                    <Phone size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-1">Emergency Uplink</p>
                    <p className="text-lg font-black text-[var(--color-text-primary)] tracking-tight">{selectedBranchDetails.contactPhone || 'ENCRYPTED_LINE'}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-6 border-t border-[var(--color-border)]">
                <button
                  onClick={() => {
                    setBranchFilter(selectedBranchDetails._id);
                    setSelectedBranchDetails(null);
                  }}
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-4"
                >
                  <Layers size={18} /> Deep Probe Analytics
                </button>
                <p className="text-center text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.4em] opacity-40">
                  Permission level: Administrator
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
  const themes = {
    blue: { 
      base: 'text-blue-500 bg-blue-500/5 border-blue-500/20 shadow-blue-500/10',
      glow: 'bg-blue-500/10',
      accent: 'border-blue-500/30'
    },
    indigo: { 
      base: 'text-indigo-500 bg-indigo-500/5 border-indigo-500/20 shadow-indigo-500/10',
      glow: 'bg-indigo-500/10',
      accent: 'border-indigo-500/30'
    },
    rose: { 
      base: 'text-rose-500 bg-rose-500/5 border-rose-500/20 shadow-rose-500/10',
      glow: 'bg-rose-500/10',
      accent: 'border-rose-500/30'
    },
    amber: { 
      base: 'text-amber-500 bg-amber-500/5 border-amber-500/20 shadow-amber-500/10',
      glow: 'bg-amber-500/10',
      accent: 'border-amber-500/30'
    },
    emerald: { 
      base: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20 shadow-emerald-500/10',
      glow: 'bg-emerald-500/10',
      accent: 'border-emerald-500/30'
    }
  };

  const theme = themes[color];

  return (
    <CardHover>
      <div className="relative bg-[var(--color-surface)]/60 backdrop-blur-md p-8 rounded-[2.5rem] border border-[var(--color-border)] flex flex-col items-center text-center group hover:border-[var(--color-primary)]/40 transition-all duration-500 shadow-xl overflow-hidden h-full">
        {/* Animated Glow Backplate */}
        <div className={`absolute inset-0 ${theme.glow} opacity-0 group-hover:opacity-100 blur-[60px] transition-opacity duration-1000 -z-10`} />
        
        <div className={`h-16 w-16 rounded-2xl ${theme.base} flex items-center justify-center mb-6 border-2 ${theme.accent} shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 relative`}>
          <div className="absolute inset-0 bg-white/5 rounded-2xl" />
          <Icon size={28} strokeWidth={2.5} className="relative z-10" />
        </div>
        
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-text-muted)] mb-3 group-hover:text-[var(--color-text-primary)] transition-colors">{label}</p>
        <h4 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter mb-1 relative">
          {value || '0'}
          <span className="absolute -top-1 -right-4 h-1.5 w-1.5 rounded-full bg-primary animate-ping opacity-0 group-hover:opacity-100 transition-opacity" />
        </h4>
        <div className="w-8 h-1 bg-[var(--color-border)] rounded-full mt-4 group-hover:w-16 group-hover:bg-primary transition-all duration-500" />
      </div>
    </CardHover>
  );
}
