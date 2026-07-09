'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/app/components/ui/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell
} from 'recharts';
import {
  MapPin, Calendar, TrendingUp, TrendingDown, Target,
  Award, AlertTriangle, ArrowUpRight, DollarSign,
  ShoppingCart, Zap, ChevronDown, Filter,
  Users, ShoppingBag, Receipt, ArrowRightLeft, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';
export default function LocationComparisonPage() {
  const [locations, setLocations] = useState([]);
  const [loc1, setLoc1] = useState('');
  const [loc2, setLoc2] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState([]);
  const [detailedData, setDetailedData] = useState([]);
  const [dateRange, setDateRange] = useState('month'); // week, month, year, FY
  const [isLoc1Open, setIsLoc1Open] = useState(false);
  const [isLoc2Open, setIsLoc2Open] = useState(false);

  // Advanced Benchmarking states
  const [activeTab, setActiveTab] = useState('dual'); // dual, advanced
  const [suiteData, setSuiteData] = useState(null);
  const [suiteLoading, setSuiteLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);

  const fetchInitialData = async () => {
    progress.start();
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
      console.error('Could not load branches. Please try again.');
    } finally {
      setLoading(false);
      progress.done();
    }
  };

  const fetchComparison = async () => {
    const isInitial = !didInitRef.current;
    if (!isInitial) setRefetching(true);
    progress.start();
    try {
      const params = `locationIds=${loc1},${loc2}&period=${dateRange === 'week' ? 7 : (dateRange === 'month' ? 30 : 365)}`;
      const [compRes, detailRes] = await Promise.all([
        api.get(`/analytics/location-comparison?${params}`),
        api.get(`/analytics/comparison-details?${params}`)
      ]);
      setComparisonData(compRes.data.data);
      setDetailedData(detailRes.data.data);
    } catch (error) {
      console.error('Could not load comparison. Please try again.');
    } finally {
      didInitRef.current = true;
      setRefetching(false);
      progress.done();
    }
  };

  const fetchSuite = async () => {
    setSuiteLoading(true);
    progress.start();
    try {
      const res = await api.get(`/analytics/branch-comparison-suite?period=${dateRange}`);
      setSuiteData(res.data.data);
    } catch (error) {
      console.error('Could not load branch comparison. Please try again.');
    } finally {
      setSuiteLoading(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitialData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loc1 && loc2) {
        fetchComparison();
      }
      if (activeTab === 'advanced') {
        fetchSuite();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [loc1, loc2, dateRange, activeTab]);

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
    const maxTicket = Math.max(l1.avgOrderValue, l2.avgOrderValue, 1);

    return [
      { subject: 'Revenue', A: (l1.revenue / maxRevenue) * 100, B: (l2.revenue / maxRevenue) * 100 },
      { subject: 'Net Profit', A: (l1.netProfit / maxProfit) * 100, B: (l2.netProfit / maxProfit) * 100 },
      { subject: 'Orders', A: (l1.orders / maxOrders) * 100, B: (l2.orders / maxOrders) * 100 },
      { subject: 'Ticket Size', A: (l1.avgOrderValue / maxTicket) * 100, B: (l2.avgOrderValue / maxTicket) * 100 },
    ];
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  if (locations.length < 2) {
    const onlyBranch = locations[0];

    return (
      <PageTransition>
        <div className="space-y-6 pb-10">
          <SlideIn direction="down">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight">
                    Branch <span className="text-primary">Comparison</span>
                  </h1>
                  <p className="text-(--color-text-secondary) text-sm font-medium mt-1">Compare how your branches are performing</p>
                </div>
              </div>
            </div>
          </SlideIn>

          <div className="min-h-[42vh] flex items-center justify-center">
            <div className="w-full max-w-2xl bg-(--color-surface)/80 border border-(--color-border) rounded-xl p-6 text-center shadow-sm">
              <div className="mx-auto h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <MapPin size={16} />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-(--color-text-primary)">Branch comparison is unavailable</h2>
              <p className="mt-3 text-sm font-medium text-(--color-text-secondary) leading-6">
                {onlyBranch
                  ? `${onlyBranch.name || onlyBranch.city || 'Your assigned branch'} is the only branch assigned to this account. A second assigned branch is required before comparisons are available.`
                  : 'No branches are assigned to this account yet. At least two assigned branches are required before comparisons are available.'}
              </p>
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header with Dual Selectors */}
        <SlideIn direction="down">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-6 w-6 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <ArrowRightLeft size={16} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight">
                  Branch <span className="text-primary">Comparison</span>
                </h1>
                <p className="text-(--color-text-secondary) text-sm font-medium mt-1">Compare how your branches are performing</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {activeTab === 'dual' && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => { setIsLoc1Open(!isLoc1Open); setIsLoc2Open(false); }}
                      className="flex items-center gap-3 px-5 py-2.5 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm hover:border-primary/50 transition-all min-w-55 font-medium text-xs"
                    >
                      <MapPin size={18} className="text-primary" />
                      <div className="flex flex-col items-start">
                        <span className="text-[11px] text-(--color-text-muted)">Branch 1</span>
                        <span>{locations.find(l => l._id === loc1)?.name || 'Select'}</span>
                      </div>
                      <ChevronDown size={16} className="ml-auto" />
                    </button>
                    {isLoc1Open && (
                      <div className="absolute top-full left-0 mt-3 w-full bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm z-50 p-2">
                        {locations.filter(l => l._id !== loc2).map(loc => (
                          <button key={loc._id} onClick={() => { setLoc1(loc._id); setIsLoc1Open(false); }} className="w-full text-left p-3 rounded-xl hover:bg-primary/10 hover:text-primary text-xs font-medium transition-colors">
                            {loc.name}{loc.cafe?.name ? <span className="text-[11px] text-(--color-text-muted) font-medium"> · {loc.cafe.name}</span> : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => { setIsLoc2Open(!isLoc2Open); setIsLoc1Open(false); }}
                      className="flex items-center gap-3 px-5 py-2.5 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm hover:border-primary/50 transition-all min-w-55 font-medium text-xs"
                    >
                      <MapPin size={18} className="text-primary" />
                      <div className="flex flex-col items-start">
                        <span className="text-[11px] text-(--color-text-muted)">Branch 2</span>
                        <span>{locations.find(l => l._id === loc2)?.name || 'Select'}</span>
                      </div>
                      <ChevronDown size={16} className="ml-auto" />
                    </button>
                    {isLoc2Open && (
                      <div className="absolute top-full left-0 mt-3 w-full bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm z-50 p-2">
                        {locations.filter(l => l._id !== loc1).map(loc => (
                          <button key={loc._id} onClick={() => { setLoc2(loc._id); setIsLoc2Open(false); }} className="w-full text-left p-3 rounded-xl hover:bg-primary/10 hover:text-primary text-xs font-medium transition-colors">
                            {loc.name}{loc.cafe?.name ? <span className="text-[11px] text-(--color-text-muted) font-medium"> · {loc.cafe.name}</span> : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Tab Selector */}
              <div className="flex bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border)">
                <button onClick={() => setActiveTab('dual')} className={`px-5 py-2.5 rounded-xl text-[11px] font-medium uppercase tracking-normal transition-all ${activeTab === 'dual' ? 'bg-(--color-surface) text-primary shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}>
                  Compare Two
                </button>
                <button onClick={() => setActiveTab('advanced')} className={`px-5 py-2.5 rounded-xl text-[11px] font-medium uppercase tracking-normal transition-all ${activeTab === 'advanced' ? 'bg-(--color-surface) text-primary shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}>
                  All Branches
                </button>
              </div>

              {/* Date Filter */}
              <div className="flex bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border)">
                {['week', 'month', 'year', 'FY'].map((p) => (
                  <button key={p} onClick={() => setDateRange(p)} className={`px-5 py-2.5 rounded-xl text-[11px] font-medium uppercase tracking-normal transition-all ${dateRange === p ? 'bg-(--color-surface) text-primary shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SlideIn>

        {activeTab === 'dual' ? (
          refetching ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            </>
          ) : (
          <>
            {/* Winner Analysis Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Sales Winner', field: 'revenue', icon: DollarSign },
                { label: 'Profit Leader', field: 'netProfit', icon: Zap },
                { label: 'Order Leader', field: 'orders', icon: ShoppingBag },
                { label: 'Ticket Size', field: 'avgOrderValue', icon: CreditCard }
              ].map((item, idx) => {
                const winner = getWinner(item.field);
                const isWinner1 = winner?.name === l1Data?.name;
                return (
                  <div key={idx} className={`p-5 rounded-xl border transition-all ${isWinner1 ? 'bg-primary/5 border-primary/20' : 'bg-primary/5 border-primary/20'}`}>
                     <div className="flex items-center gap-4 mb-4">
                       <item.icon size={20} className={isWinner1 ? 'text-primary' : 'text-primary'} />
                       <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">{item.label}</span>
                     </div>
                     <div className="flex flex-col gap-4 mt-6">
                       <div className="flex justify-between items-center">
                         <span className="text-xs font-medium text-(--color-text-muted)">{l1Data?.name || 'Branch A'}</span>
                         <span className="text-xs font-semibold text-(--color-text-primary)"><Money value={l1Data?.[item.field] || 0} /></span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-xs font-medium text-(--color-text-muted)">{l2Data?.name || 'Branch B'}</span>
                         <span className="text-xs font-semibold text-(--color-text-primary)"><Money value={l2Data?.[item.field] || 0} /></span>
                       </div>
                       <div className="pt-3 border-t border-(--color-border) flex justify-between items-center">
                         <span className="text-[11px] font-medium truncate text-primary">{winner?.name}</span>
                         <span className="text-[11px] font-semibold text-success">+{winner?.diff}%</span>
                       </div>
                     </div>
                  </div>
                );
              })}
            </div>

            {/* Graphical Benchmark */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-(--color-surface)/80  border border-(--color-border) rounded-xl p-6">
                <h3 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-normal mb-6">Performance Radar</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                      <PolarGrid stroke="#88888820" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#888' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                      <Radar name={l1Data?.name} dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                      <Radar name={l2Data?.name} dataKey="B" stroke="#f97316" fill="#f97316" fillOpacity={0.4} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-(--color-surface)/80  border border-(--color-border) rounded-xl p-6">
                <h3 className="text-sm font-semibold text-(--color-text-muted) uppercase tracking-normal mb-6">Total Sales Breakdown</h3>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { subject: 'Revenue', A: l1Data?.revenue, B: l2Data?.revenue },
                      { subject: 'Net Profit', A: l1Data?.netProfit, B: l2Data?.netProfit },
                      { subject: 'Orders', A: l1Data?.orders, B: l2Data?.orders }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                      <XAxis dataKey="subject" fontSize={10} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => formatIndianCompact(v, { currency: true })} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar name={l1Data?.name} dataKey="A" fill="#f59e0b" radius={[6,6,0,0]} />
                      <Bar name={l2Data?.name} dataKey="B" fill="#f97316" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
          )
        ) : (
          <div className="space-y-6">
            {suiteLoading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
                </div>
                <TableSkeleton rows={6} cols={10} />
              </>
            ) : (
              <>
                {/* Outliers Premium Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="p-5 bg-gradient-to-br from-success to-success rounded-xl text-white shadow-sm">
                    <Award size={24} className="opacity-80" />
                    <p className="text-[11px] font-medium uppercase tracking-normal mt-4 opacity-80">Most Profitable</p>
                    <p className="text-2xl font-semibold mt-1 truncate">{suiteData?.outliers?.mostProfitable?.name || 'N/A'}</p>
                    <p className="text-sm font-medium mt-2 opacity-90"><Money value={suiteData?.outliers?.mostProfitable?.value} /></p>
                  </div>

                  <div className="p-5 bg-gradient-to-br from-primary to-primary rounded-xl text-white shadow-sm">
                    <AlertTriangle size={24} className="opacity-80" />
                    <p className="text-[11px] font-medium uppercase tracking-normal mt-4 opacity-80">Slowest Growth</p>
                    <p className="text-2xl font-semibold mt-1 truncate">{suiteData?.outliers?.slowestGrowth?.name || 'N/A'}</p>
                    <p className="text-sm font-medium mt-2 opacity-90">{suiteData?.outliers?.slowestGrowth?.value}</p>
                  </div>

                  <div className="p-5 bg-gradient-to-br from-danger to-danger rounded-xl text-white shadow-sm">
                    <TrendingDown size={24} className="opacity-80" />
                    <p className="text-[11px] font-medium uppercase tracking-normal mt-4 opacity-80">Lowest Performing</p>
                    <p className="text-2xl font-semibold mt-1 truncate">{suiteData?.outliers?.lowestPerforming?.name || 'N/A'}</p>
                    <p className="text-sm font-medium mt-2 opacity-90"><Money value={suiteData?.outliers?.lowestPerforming?.value} /></p>
                  </div>
                </div>

                {/* Advanced Comparison List Table */}
                <div className="bg-(--color-surface)/80  border border-(--color-border) p-5 rounded-xl shadow-sm">
                  <h3 className="text-xs font-semibold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                    <Target size={16} className="text-primary" /> All Branches Comparison
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-(--color-border)">
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Branch Name</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Cafe</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Revenue</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Orders</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Growth</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">UPI %</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Avg Ticket</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Staff Eff.</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Cancel Rate</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Coupon Usage</th>
                          <th className="py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suiteData?.branches?.map((branch) => (
                          <tr key={branch._id} className="border-b border-(--color-border)/50 hover:bg-(--color-surface-soft)/50 transition-all font-medium text-xs">
                            <td className="py-4 text-(--color-text-primary)">{branch.name}</td>
                            <td className="py-4 text-primary">{branch.cafeName || '—'}</td>
                            <td className="py-4 text-(--color-text-primary)"><Money value={branch.revenue} /></td>
                            <td className="py-4 text-(--color-text-muted)">{branch.orders}</td>
                            <td className={`py-4 font-medium ${Number(branch.growthPercent) >= 0 ? 'text-success' : 'text-danger'}`}>{branch.growthPercent}%</td>
                            <td className="py-4 text-(--color-text-muted)">{branch.upiPercent}%</td>
                            <td className="py-4 text-(--color-text-primary)"><Money value={branch.avgOrderValue} /></td>
                            <td className="py-4 text-(--color-text-muted)">{branch.staffEfficiency}</td>
                            <td className="py-4 text-danger">{branch.cancellationRate}%</td>
                            <td className="py-4 text-(--color-text-muted)">{branch.couponUsage}</td>
                            <td className="py-4 text-success font-semibold"><Money value={branch.profitability} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
