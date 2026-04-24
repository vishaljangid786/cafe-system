'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell
} from 'recharts';
import {
  MapPin, Calendar, TrendingUp, TrendingDown, Target,
  Award, AlertTriangle, ArrowUpRight, DollarSign,
  ShoppingCart, Activity, Zap, ChevronDown, Filter,
  Users, ShoppingBag, Receipt, ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import toast from 'react-hot-toast';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f43f5e'];

export default function LocationComparisonPage() {
  const [locations, setLocations] = useState([]);
  const [loc1, setLoc1] = useState('');
  const [loc2, setLoc2] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState([]);
  const [detailedData, setDetailedData] = useState([]);
  const [dateRange, setDateRange] = useState('month'); // week, month, year, custom
  const [isLoc1Open, setIsLoc1Open] = useState(false);
  const [isLoc2Open, setIsLoc2Open] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (loc1 && loc2) {
      fetchComparison();
    }
  }, [loc1, loc2, dateRange]);

  const fetchInitialData = async () => {
    try {
      const res = await api.get('/locations');
      const locs = res.data.data;
      setLocations(locs);
      
      if (locs.length >= 2) {
        setLoc1(locs[0]._id);
        setLoc2(locs[1]._id);
      } else if (locs.length > 0) {
        setLoc1(locs[0]._id);
      }
    } catch (error) {
      toast.error('Failed to initialize branches');
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    try {
      const params = `locationIds=${loc1},${loc2}&period=${dateRange === 'week' ? 7 : (dateRange === 'month' ? 30 : 365)}`;
      const [compRes, detailRes] = await Promise.all([
        api.get(`/analytics/location-comparison?${params}`),
        api.get(`/analytics/comparison-details?${params}`)
      ]);
      setComparisonData(compRes.data.data);
      setDetailedData(detailRes.data.data);
    } catch (error) {
      toast.error('Matrix synchronization failed');
    }
  };

  const getWinner = (field) => {
    if (comparisonData.length < 2) return null;
    const l1 = comparisonData.find(d => d.locationId === loc1);
    const l2 = comparisonData.find(d => d.locationId === loc2);
    if (!l1 || !l2) return null;
    
    if (l1[field] > l2[field]) return { name: l1.name, diff: ((l1[field] - l2[field]) / (l2[field] || 1) * 100).toFixed(1) };
    if (l2[field] > l1[field]) return { name: l2.name, diff: ((l2[field] - l1[field]) / (l1[field] || 1) * 100).toFixed(1) };
    return { name: 'Draw', diff: 0 };
  };

  const l1Data = comparisonData.find(d => d.locationId === loc1);
  const l2Data = comparisonData.find(d => d.locationId === loc2);
  const l1Detail = detailedData.find(d => d.locationId === loc1);
  const l2Detail = detailedData.find(d => d.locationId === loc2);

  const getRadarData = () => {
    if (comparisonData.length < 2) return [];
    const l1 = comparisonData.find(d => d.locationId === loc1);
    const l2 = comparisonData.find(d => d.locationId === loc2);
    if (!l1 || !l2) return [];

    const maxRevenue = Math.max(l1.revenue, l2.revenue, 1);
    const maxProfit = Math.max(l1.netProfit, l2.netProfit, 1);
    const maxOrders = Math.max(l1.orders, l2.orders, 1);
    const maxExpenses = Math.max(l1.expenses, l2.expenses, 1);
    const maxTicket = Math.max(l1.avgOrderValue, l2.avgOrderValue, 1);

    return [
      { subject: 'Revenue', A: (l1.revenue / maxRevenue) * 100, B: (l2.revenue / maxRevenue) * 100, fullMark: 100 },
      { subject: 'Net Profit', A: (l1.netProfit / maxProfit) * 100, B: (l2.netProfit / maxProfit) * 100, fullMark: 100 },
      { subject: 'Orders', A: (l1.orders / maxOrders) * 100, B: (l2.orders / maxOrders) * 100, fullMark: 100 },
      { subject: 'Ticket Size', A: (l1.avgOrderValue / maxTicket) * 100, B: (l2.avgOrderValue / maxTicket) * 100, fullMark: 100 },
      { subject: 'Efficiency', A: 100 - (l1.expenses / (l1.revenue || 1) * 100), B: 100 - (l2.expenses / (l2.revenue || 1) * 100), fullMark: 100 },
      { subject: 'Cost Control', A: (1 - l1.expenses / maxExpenses) * 100, B: (1 - l2.expenses / maxExpenses) * 100, fullMark: 100 },
    ];
  };

  if (loading) return (
    <div className="p-10 space-y-10">
      <div className="h-20 w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="h-40 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />
        <div className="h-40 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />
        <div className="h-40 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2rem]" />
      </div>
      <div className="h-[500px] w-full bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-[2.5rem]" />
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header with Dual Selectors */}
        <SlideIn direction="down">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ArrowRightLeft size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Branch <span className="text-amber-600">Comparison</span>
                </h1>
                <p className="text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">Compare performance between two branches</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Loc 1 Selector */}
              <div className="relative">
                <button
                  onClick={() => { setIsLoc1Open(!isLoc1Open); setIsLoc2Open(false); }}
                  className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-amber-500/50 transition-all min-w-[220px]"
                >
                  <MapPin size={18} className="text-amber-500" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">First Branch</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{locations.find(l => l._id === loc1)?.name || 'Select Branch'}</span>
                  </div>
                  <ChevronDown size={16} className={`ml-auto transition-transform ${isLoc1Open ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isLoc1Open && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-3 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2"
                    >
                      {locations.filter(l => l._id !== loc2).map(loc => (
                        <button key={loc._id} onClick={() => { setLoc1(loc._id); setIsLoc1Open(false); }} className="w-full text-left p-3 rounded-xl hover:bg-amber-500/10 hover:text-amber-500 text-xs font-bold transition-colors">
                          {loc.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

              {/* Loc 2 Selector */}
              <div className="relative">
                <button
                  onClick={() => { setIsLoc2Open(!isLoc2Open); setIsLoc1Open(false); }}
                  className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-blue-500/50 transition-all min-w-[220px]"
                >
                  <MapPin size={18} className="text-blue-500" />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Second Branch</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{locations.find(l => l._id === loc2)?.name || 'Select Branch'}</span>
                  </div>
                  <ChevronDown size={16} className={`ml-auto transition-transform ${isLoc2Open ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isLoc2Open && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-3 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 p-2"
                    >
                      {locations.filter(l => l._id !== loc1).map(loc => (
                        <button key={loc._id} onClick={() => { setLoc2(loc._id); setIsLoc2Open(false); }} className="w-full text-left p-3 rounded-xl hover:bg-blue-500/10 hover:text-blue-500 text-xs font-bold transition-colors">
                          {loc.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date Filter */}
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                {['week', 'month', 'year'].map((p) => (
                  <button key={p} onClick={() => setDateRange(p)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateRange === p ? 'bg-white dark:bg-zinc-700 text-amber-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Winner Analysis Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Sales Winner', field: 'revenue', icon: DollarSign, color: 'amber' },
            { label: 'Profit Leader', field: 'netProfit', icon: Zap, color: 'emerald' },
            { label: 'Order Leader', field: 'orders', icon: ShoppingBag, color: 'blue' },
            { label: 'Expense Control', field: 'expenses', icon: Receipt, color: 'rose', reverse: true }
          ].map((item, idx) => {
            const winner = getWinner(item.field);
            const isWinner1 = winner?.name === l1Data?.name;
            return (
              <SlideIn key={idx} delay={idx * 0.1}>
                <div className={`p-8 rounded-[2.5rem] border transition-all ${isWinner1 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20'} relative overflow-hidden`}>
                   <div className="flex items-center gap-4 mb-4">
                     <item.icon size={20} className={isWinner1 ? 'text-amber-500' : 'text-blue-500'} />
                     <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.label}</span>
                   </div>
                   <div className="flex flex-col gap-4 mt-6">
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Branch 1</span>
                        </div>
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                          {item.field === 'revenue' || item.field === 'netProfit' || item.field === 'expenses' ? '₹' : ''}
                          {l1Data?.[item.field]?.toLocaleString() || 0}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Branch 2</span>
                        </div>
                        <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                          {item.field === 'revenue' || item.field === 'netProfit' || item.field === 'expenses' ? '₹' : ''}
                          {l2Data?.[item.field]?.toLocaleString() || 0}
                        </span>
                     </div>
                     <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-900 dark:text-white truncate max-w-[120px]">{winner?.name} Wins</span>
                        <span className={`text-[10px] font-black ${winner?.diff > 0 ? 'text-emerald-500' : 'text-zinc-400'}`}>
                          {winner?.diff > 0 ? `+${winner.diff}%` : '0%'}
                        </span>
                     </div>
                   </div>
                </div>
              </SlideIn>
            );
          })}
        </div>

        {/* Benchmarking Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Analysis */}
          <div className="bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Performance Chart</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Multi-sector performance overview</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[8px] font-black uppercase text-zinc-500">{l1Data?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[8px] font-black uppercase text-zinc-500">{l2Data?.name}</span>
                </div>
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                  <PolarGrid stroke="#88888820" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#888' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name={l1Data?.name}
                    dataKey="A"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.4}
                  />
                  <Radar
                    name={l2Data?.name}
                    dataKey="B"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.4}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sector Comparison Bar Chart */}
          <div className="bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm">
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-10">Sales Comparison</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { subject: 'Revenue', A: l1Data?.revenue, B: l2Data?.revenue },
                  { subject: 'Net Profit', A: l1Data?.netProfit, B: l2Data?.netProfit },
                  { subject: 'Expenses', A: l1Data?.expenses, B: l2Data?.expenses },
                  { subject: 'Orders', A: l1Data?.orders, B: l2Data?.orders }
                ]}>
                  <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis hide />
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }} />
                  <Bar name={l1Data?.name} dataKey="A" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Bar name={l2Data?.name} dataKey="B" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Financial Duel Section */}
        <div className="bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
             <DollarSign size={200} />
          </div>
          
          <div className="mb-12 text-center">
            <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Direct <span className="text-amber-500">Comparison</span></h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Direct performance comparison between branches</p>
          </div>

          <div className="space-y-12">
            {[
              { label: 'Total Sales', field: 'revenue', colorA: 'bg-amber-500', colorB: 'bg-blue-500', icon: TrendingUp },
              { label: 'Net Profit', field: 'netProfit', colorA: 'bg-emerald-500', colorB: 'bg-sky-500', icon: Zap },
              { label: 'Daily Expenses', field: 'expenses', colorA: 'bg-rose-500', colorB: 'bg-indigo-500', icon: Receipt }
            ].map((metric, i) => {
              const val1 = l1Data?.[metric.field] || 0;
              const val2 = l2Data?.[metric.field] || 0;
              const total = (val1 + val2) || 1;
              const perc1 = (val1 / total) * 100;
              const perc2 = (val2 / total) * 100;

              return (
                <div key={i} className="space-y-4">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 italic">₹{val1.toLocaleString()}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{l1Data?.name}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <metric.icon size={16} className="text-zinc-400 mb-1" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{metric.label}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-zinc-900 dark:text-zinc-100 italic">₹{val2.toLocaleString()}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{l2Data?.name}</span>
                    </div>
                  </div>
                  
                  <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full flex overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${perc1}%` }} 
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full ${metric.colorA} relative group`}
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${perc2}%` }} 
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full ${metric.colorB} relative group`}
                    >
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  </div>

                  <div className="flex justify-between px-2">
                    <span className="text-[10px] font-black text-zinc-400">{perc1.toFixed(1)}% Share</span>
                    <span className="text-[10px] font-black text-zinc-400">{perc2.toFixed(1)}% Share</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {/* Hub Alpha Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">1</div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{l1Data?.name} Details</h3>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Top Selling Item</span>
                <span className="text-sm font-black text-amber-500">{l1Detail?.topItem?.name || 'N/A'} ({l1Detail?.topItem?.quantity || 0} Sold)</span>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                {l1Detail?.staffSales?.map((staff, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-xs">
                        {staff.name.charAt(0)}
                      </div>
                      <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{staff.name}</span>
                    </div>
                    <div className="space-y-2">
                      {staff.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-medium text-zinc-500">
                          <span>{item.name}</span>
                          <span className="font-black text-zinc-900 dark:text-zinc-100">{item.quantity} Qty</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hub Beta Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black">2</div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{l2Data?.name} Details</h3>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Top Selling Item</span>
                <span className="text-sm font-black text-blue-500">{l2Detail?.topItem?.name || 'N/A'} ({l2Detail?.topItem?.quantity || 0} Sold)</span>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                {l2Detail?.staffSales?.map((staff, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-xs">
                        {staff.name.charAt(0)}
                      </div>
                      <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{staff.name}</span>
                    </div>
                    <div className="space-y-2">
                      {staff.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-medium text-zinc-500">
                          <span>{item.name}</span>
                          <span className="font-black text-zinc-900 dark:text-zinc-100">{item.quantity} Qty</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Workforce Intelligence Section */}
        <div className="bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 shadow-sm">
          <div className="mb-12 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Staff <span className="text-blue-500">Performance</span></h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Attendance and stability overview</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                 <Users size={16} className="text-blue-500" />
                 <span className="text-[10px] font-black uppercase text-zinc-500">Stability Gap: {Math.abs((l1Detail?.attendance?.rate || 0) - (l2Detail?.attendance?.rate || 0)).toFixed(1)}%</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Hub Alpha Attendance */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{l1Data?.name}</h4>
              </div>
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Present', value: l1Detail?.attendance?.present || 0 },
                        { name: 'Absent', value: l1Detail?.attendance?.absent || 0 },
                        { name: 'Half-Day', value: l1Detail?.attendance?.halfDay || 0 }
                      ]}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{l1Detail?.attendance?.rate || 0}%</span>
                   <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Stability</span>
                </div>
              </div>
            </div>

            {/* Hub Beta Attendance */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">{l2Data?.name}</h4>
              </div>
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Present', value: l2Detail?.attendance?.present || 0 },
                        { name: 'Absent', value: l2Detail?.attendance?.absent || 0 },
                        { name: 'Half-Day', value: l2Detail?.attendance?.halfDay || 0 }
                      ]}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{l2Detail?.attendance?.rate || 0}%</span>
                   <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Stability</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Most Selling Item Between Both */}
        <div className="bg-gradient-to-r from-amber-500/10 to-blue-500/10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 text-center">
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">Overall Best Seller</h3>
           <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-[2rem] bg-white dark:bg-zinc-900 shadow-xl flex items-center justify-center text-amber-500">
                <Zap size={40} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
                  {(() => {
                    const allItems = [...(l1Detail?.staffSales || []), ...(l2Detail?.staffSales || [])]
                      .flatMap(s => s.items)
                      .reduce((acc, curr) => {
                        acc[curr.name] = (acc[curr.name] || 0) + curr.quantity;
                        return acc;
                      }, {});
                    const champion = Object.entries(allItems).sort((a,b) => b[1] - a[1])[0];
                    return champion ? `${champion[0]} (${champion[1]} Units)` : 'Awaiting Data';
                  })()}
                </h2>
                <p className="text-zinc-500 text-xs font-medium mt-2 italic">Most frequently ordered item across both branches.</p>
              </div>
           </div>
        </div>
      </div>
    </PageTransition>
  );
}
