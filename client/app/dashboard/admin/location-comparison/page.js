'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  MapPin, Calendar, TrendingUp, TrendingDown, Target,
  Award, AlertTriangle, ArrowUpRight, DollarSign,
  ShoppingCart, Activity, Zap, ChevronDown, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import toast from 'react-hot-toast';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e'];

export default function LocationComparisonPage() {
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState([]);
  const [topLocations, setTopLocations] = useState([]);
  const [underperforming, setUnderperforming] = useState([]);
  const [trendingItems, setTrendingItems] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [dateRange, setDateRange] = useState('month'); // week, month, year
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [productViewMode, setProductViewMode] = useState('location'); // location, global
  const [bottomProducts, setBottomProducts] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedLocations.length > 0) {
      fetchComparison();
      fetchIntelligence();
    }
  }, [selectedLocations, dateRange]);

  const fetchInitialData = async () => {
    try {
      const [locRes, topRes, underRes] = await Promise.all([
        api.get('/locations'),
        api.get('/analytics/top-locations'),
        api.get('/analytics/underperforming-locations')
      ]);
      setLocations(locRes.data.data);
      setTopLocations(topRes.data.data);
      setUnderperforming(underRes.data.data);

      // Auto-select top 2 locations initially
      if (locRes.data.data.length >= 2) {
        setSelectedLocations(locRes.data.data.slice(0, 2).map(l => l._id));
      } else if (locRes.data.data.length > 0) {
        setSelectedLocations([locRes.data.data[0]._id]);
      }
    } catch (error) {
      toast.error('Failed to initialize intelligence engine');
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    try {
      const res = await api.get(`/analytics/location-comparison?locationIds=${selectedLocations.join(',')}&period=${dateRange}`);
      setComparisonData(res.data.data);
    } catch (error) {
      toast.error('Comparison synchronization failed');
    }
  };

  const fetchIntelligence = async () => {
    try {
      const periodInDays = dateRange === 'week' ? 7 : (dateRange === 'month' ? 30 : 365);
      const [trendRes, prodRes] = await Promise.all([
        api.get(`/analytics/trending-items?period=${periodInDays}`),
        api.get(`/analytics/product-performance/${selectedLocations[0]}?period=${periodInDays}`)
      ]);
      setTrendingItems(trendRes.data.data);
      setProductPerformance(prodRes.data.data);
      // Derive bottom products
      const bottom = [...prodRes.data.data].sort((a, b) => a.quantity - b.quantity).slice(0, 5);
      setBottomProducts(bottom);
    } catch (error) {
      console.error('Failed to fetch detailed intelligence');
    }
  };

  const toggleLocation = (id) => {
    setSelectedLocations(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  if (loading) return (
    <div className="space-y-8 p-10">
      <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-xl mb-10" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="h-[400px] bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2.5rem]" />
    </div>
  );

  if (locations.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="h-24 w-24 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500">
        <MapPin size={48} />
      </div>
      <div>
        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">No Operational Hubs Found</h2>
        <p className="text-zinc-500 max-w-md mx-auto mt-2 font-medium">
          The intelligence matrix requires at least one active location to begin benchmarking.
          Please initialize locations in the Location Manager.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-8 py-4 bg-amber-500 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform"
      >
        Refresh Matrix
      </button>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header & Controls */}
        <SlideIn direction="down">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <div>
              <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center">
                <Target className="mr-4 text-amber-500" size={40} />
                Operational <span className="ml-3 text-amber-500">Intelligence</span>
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-2 max-w-xl">
                Multi-dimensional benchmarking and predictive performance analysis. {selectedLocations.length === 0 && <span className="text-rose-500 font-bold block mt-1">Select at least one hub to synchronize matrix.</span>}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Location Multi-Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsSelectorOpen(!isSelectorOpen)}
                  className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-amber-500/50 transition-all group min-w-[240px]"
                >
                  <MapPin size={18} className="text-amber-500" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Comparison Nodes</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {selectedLocations.length === 0 ? 'Select Hubs' : `${selectedLocations.length} Hubs Selected`}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`ml-auto transition-transform ${isSelectorOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isSelectorOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-3 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl z-50 p-4 max-h-[320px] overflow-y-auto custom-scrollbar"
                    >
                      {locations.map(loc => (
                        <button
                          key={loc._id}
                          onClick={() => toggleLocation(loc._id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-colors ${selectedLocations.includes(loc._id)
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-500'
                            }`}
                        >
                          <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${selectedLocations.includes(loc._id) ? 'bg-amber-500 border-amber-500' : 'border-zinc-300 dark:border-zinc-700'
                            }`}>
                            {selectedLocations.includes(loc._id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                          <span className="text-xs font-bold text-left">{loc.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date Filter */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                {['week', 'month', 'year'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setDateRange(p)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === p
                      ? 'bg-white dark:bg-zinc-700 text-amber-500 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Intelligence Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Top Performer Trophy */}
          <SlideIn delay={0.1}>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-amber-500/20 relative overflow-hidden group">
              <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Award size={200} />
              </div>
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Award size={24} className="text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Crown Performer</span>
              </div>
              <h2 className="text-3xl font-black mb-2 relative z-10 leading-tight">
                {topLocations[0]?.name || (loading ? 'Analyzing...' : 'No Data')}
              </h2>
              <p className="text-white/80 text-xs font-bold uppercase tracking-wider relative z-10">
                {topLocations[0]?.city || (loading ? 'Global Matrix' : 'Record Transactions to Populate')}
              </p>
              <div className="mt-8 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black italic">₹{((topLocations[0]?.profit || 0) / 1000).toFixed(1)}K</span>
                <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Net Profit</span>
              </div>
            </div>
          </SlideIn>

          {/* Top Locations Leaderboard (New) */}
          <SlideIn delay={0.15}>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Node Leaderboard</span>
                </div>
              </div>
              <div className="space-y-4">
                {topLocations.slice(0, 4).map((loc, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-zinc-400">0{i + 1}</span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{loc.name}</span>
                    </div>
                    <span className="text-xs font-black text-amber-500">₹{(loc.profit / 1000).toFixed(1)}K</span>
                  </div>
                ))}
                {topLocations.length === 0 && <p className="text-xs text-zinc-400 italic">No nodes matching criteria.</p>}
              </div>
            </div>
          </SlideIn>

          {/* Critical Attention Card */}
          <SlideIn delay={0.2}>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm group">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <AlertTriangle size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Node Attention</span>
              </div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-1">
                {underperforming[0]?.name || (loading ? 'Stable Matrix' : 'Optimal Grid')}
              </h2>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-6">
                {underperforming[0]?.reason || (underperforming.length > 0 ? 'Operational norms within threshold' : 'No performance lag detected')}
              </p>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${underperforming[0]?.score || 0}%` }}
                  className="h-full bg-rose-500"
                />
              </div>
              <div className="flex justify-between mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <span>Utilization Score</span>
                <span className="text-rose-500">{underperforming[0]?.score || 0}%</span>
              </div>
            </div>
          </SlideIn>

          {/* Trending Insight */}
          <SlideIn delay={0.3}>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <TrendingUp size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Growth Velocity</span>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Global Average Ticket</span>
                  <span className="text-lg font-black text-zinc-900 dark:text-zinc-100">₹842</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Yield Convergence</span>
                  <span className="text-lg font-black text-emerald-500">+12.4%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Network Idle Rate</span>
                  <span className="text-lg font-black text-rose-500">-3.1%</span>
                </div>
              </div>
              <button className="w-full mt-6 py-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-amber-500 hover:border-amber-500 transition-all">
                Download Global Audit
              </button>
            </div>
          </SlideIn>
        </div>

        {/* Primary Comparison Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue & Profit Benchmarking */}
          <SlideIn delay={0.4}>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm h-full">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Yield Benchmarking</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Cross-node revenue vs net profit analysis</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-black uppercase text-zinc-500">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase text-zinc-500">Profit</span>
                  </div>
                </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#888' }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#888' }}
                    />
                    <Tooltip
                      cursor={{ fill: '#88888810' }}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
                    <Bar dataKey="netProfit" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>

          {/* Revenue Contribution */}
          <SlideIn delay={0.5}>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm h-full">
              <div className="mb-10 text-center">
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Market Share</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Percentage of network contribution</p>
              </div>

              <div className="h-[400px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={comparisonData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={8}
                      dataKey="revenue"
                    >
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                {/* Custom Legend Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block">Total</span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 italic">₹{(comparisonData.reduce((acc, curr) => acc + curr.revenue, 0) / 1000).toFixed(1)}K</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                {comparisonData.map((entry, index) => (
                  <div key={entry.locationId} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase truncate">{entry.name}</span>
                    <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 ml-auto">
                      {((entry.revenue / comparisonData.reduce((a, c) => a + c.revenue, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SlideIn>
        </div>

        {/* Detailed Metrics Table */}
        <SlideIn delay={0.6}>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-10 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">Fiscal Ledger Comparison</h3>
                <p className="text-sm text-zinc-500 mt-2 font-medium">Granular performance breakdown per node.</p>
              </div>
              <button className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-amber-500 transition-colors">
                <ArrowUpRight size={20} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-950/50">
                    <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Location Node</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Gross Yield</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Operational Cost</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Net Profit</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Avg Ticket</th>
                    <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Order Vol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {comparisonData.map((loc) => (
                    <tr key={loc.locationId} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black">
                            {loc.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{loc.name}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{loc.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right font-black text-zinc-900 dark:text-zinc-100">₹{loc.revenue.toLocaleString()}</td>
                      <td className="px-10 py-8 text-right font-black text-rose-500">₹{loc.expenses.toLocaleString()}</td>
                      <td className="px-10 py-8 text-right font-black text-emerald-500">₹{loc.netProfit.toLocaleString()}</td>
                      <td className="px-10 py-8 text-right font-black text-zinc-900 dark:text-zinc-100">₹{Math.round(loc.avgOrderValue)}</td>
                      <td className="px-10 py-8 text-right font-black text-zinc-900 dark:text-zinc-100">{loc.orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>

        {/* Product Intelligence Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Culinary Intelligence</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                {productViewMode === 'global' ? 'Network-wide product velocity' : `Performance for ${locations.find(l => l._id === selectedLocations[0])?.name || 'Selected Hub'}`}
              </p>
            </div>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => setProductViewMode('location')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${productViewMode === 'location' ? 'bg-white dark:bg-zinc-700 text-amber-500 shadow-sm' : 'text-zinc-500'}`}
              >
                Hub Specific
              </button>
              <button
                onClick={() => setProductViewMode('global')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${productViewMode === 'global' ? 'bg-white dark:bg-zinc-700 text-amber-500 shadow-sm' : 'text-zinc-500'}`}
              >
                Global Grid
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {/* Most Popular Products */}
            <SlideIn delay={0.7}>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm h-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <ShoppingCart size={24} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Most Popular</h3>
                </div>
                <div className="space-y-6">
                  {(productViewMode === 'global' ? trendingItems : productPerformance).slice(0, 5).map((item, i) => (
                    <div key={item._id || item.itemId} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-zinc-300 group-hover:text-amber-500 transition-colors">0{i + 1}</span>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">{item.quantity || item.totalSold || 0} units</span>
                    </div>
                  ))}
                  {(productViewMode === 'global' ? trendingItems : productPerformance).length === 0 && (
                    <div className="py-10 text-center">
                      <p className="text-xs font-medium text-zinc-400 italic">No sales recorded {productViewMode === 'location' ? 'at this node' : 'globally'}.</p>
                      <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest font-black">Matrix: Idle</p>
                    </div>
                  )}
                </div>
              </div>
            </SlideIn>

            {/* Least Selling Products (New) */}
            <SlideIn delay={0.75}>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm h-full">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <TrendingDown size={24} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Cold Items</h3>
                </div>
                <div className="space-y-6">
                  {(productViewMode === 'global' ? [...trendingItems].sort((a, b) => (a.totalSold || 0) - (b.totalSold || 0)) : bottomProducts).slice(0, 5).map((item, i) => (
                    <div key={item._id || item.itemId} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-zinc-300 group-hover:text-rose-500 transition-colors">0{i + 1}</span>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{item.name}</span>
                      </div>
                      <span className="text-xs font-black text-rose-500">{item.quantity || item.totalSold || 0} units</span>
                    </div>
                  ))}
                  {(productViewMode === 'global' ? trendingItems : bottomProducts).length === 0 && (
                    <div className="py-10 text-center">
                      <p className="text-xs font-medium text-zinc-400 italic">No stagnant items detected.</p>
                    </div>
                  )}
                </div>
              </div>
            </SlideIn>

            {/* Trending Products */}
            <SlideIn delay={0.8}>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Activity size={24} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Trending Items</h3>
                </div>
                <div className="space-y-6">
                  {trendingItems.slice(0, 5).map((item, i) => (
                    <div key={item.itemId} className="flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black">
                          #{i + 1}
                        </div>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{item.name}</span>
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] font-black ${item.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {item.growth >= 0 ? <ArrowUpRight size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(item.growth)}%
                      </div>
                    </div>
                  ))}
                  {trendingItems.length === 0 && (
                    <p className="text-xs font-medium text-zinc-400 italic">Insufficient historical data to detect trends.</p>
                  )}
                </div>
              </div>
            </SlideIn>

            {/* Most Profitable Products */}
            <SlideIn delay={0.9}>
              <div className="bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-6 opacity-10 dark:text-white text-zinc-900">
                  <DollarSign size={80} />1
                </div>
                <div className="flex items-center gap-4 mb-8 relative z-10 ">
                  <div className="h-12 w-12 rounded-2xl dark:bg-white/10 bg-zinc-900/10 flex items-center justify-center dark:text-white text-zinc-900">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-lg font-black dark:text-white text-zinc-900 tracking-tight">Profit Matrix</h3>
                </div>
                <div className="space-y-6 relative z-10">
                  {(productViewMode === 'global' ? trendingItems : productPerformance).slice().sort((a, b) => (b.profit || 0) - (a.profit || 0)).slice(0, 5).map((item, i) => (
                    <div key={item._id || item.itemId} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 dark:text-zinc-600">{item.name}</span>
                      <span className="text-xs font-black text-emerald-400 dark:text-emerald-600">₹{Math.round(item.profit || 0).toLocaleString()} yield</span>
                    </div>
                  ))}
                  {(productViewMode === 'global' ? trendingItems : productPerformance).length === 0 && (
                    <p className="text-xs font-medium text-white/40 dark:text-zinc-400 italic">No profitability data available.</p>
                  )}
                </div>
              </div>
            </SlideIn>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

