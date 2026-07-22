'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, Users,
  Coffee, Calendar, Zap, Activity, Clock,
  ArrowUpRight, Target, Flame, Layers, Filter,
  ChefHat, Utensils, Receipt, ShoppingBag,
  ChevronDown, User,
  CreditCard, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { ChartSkeleton } from '@/app/components/ui/Skeleton';
import { StatWidget } from '../../components/ui/StatWidget';
import { CountUp } from '../../components/ui/CountUp';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';import ExportActions from '../../components/ui/ExportActions';
import { SlideIn } from '@/app/components/ui/AnimatedContainer';
import Link from 'next/link';
import PeopleDrawer from './components/PeopleDrawer';
import CashFlowCard from '../../components/revenue/CashFlowCard';
import CashDrawerWidget from './components/CashDrawerWidget';
import UniversalDateFilter from '../../components/ui/UniversalDateFilter';
import { formatIndianCompact } from '../../utils/formatNumber';
import { Money, Num } from '@/app/components/ui/Money';
import { displayUserName } from '@/app/utils/userDisplay';
import ChartToolbar, { groupSeries, GROUP_OPTIONS } from '../../components/ui/ChartToolbar';

// Local YYYY-MM-DD (avoids the UTC shift toISOString() causes for IST midnight).
const fmtLocalDate = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

// Tile colours for the payment-method summary. Written out in full because
// Tailwind scans source text — a template-built class name never gets emitted.
const PAY_TILE = [
  { bg: 'bg-primary/5', text: 'text-primary' },
  { bg: 'bg-secondary/5', text: 'text-secondary' },
  { bg: 'bg-success/5', text: 'text-success' },
  { bg: 'bg-(--color-amber)/5', text: 'text-(--color-amber)' },
  { bg: 'bg-danger/5', text: 'text-danger' },
];

const ViewLink = ({ href, label = 'View' }) => (
  <Link
    href={href}
    onClick={(e) => e.stopPropagation()}
    className="group/vl flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors"
  >
    {label}
    <ArrowUpRight size={13} className="transition-transform group-hover/vl:translate-x-0.5 group-hover/vl:-translate-y-0.5" />
  </Link>
);

export default function AdminDashboard() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, selectedLocation: authLocation, selectedLocationIds } = useAuth();
  const dashPrefix = ['admin', 'super_admin'].includes(user?.role)
    ? '/dashboard/admin'
    : user?.role === 'location_admin'
      ? '/dashboard/location-admin'
      : '/dashboard/branch-admin';
  const ordersHref = '/dashboard/admin/orders';
  const orderAnalyticsHref = '/dashboard/admin/orders/analytics';
  const [locations, setLocations] = useState([]);
  const [analytics, setAnalytics] = useState({
    summary: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, netProfit: 0, totalExpenses: 0 },
    timeSeries: [],
    categorySales: [],
    staffPerformance: [],
    recentExpenses: [],
    recentRevenues: []
  });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(true);
  const didInitRef = useRef(false);
  // Global date range for the whole overview — driven by the reusable UniversalDateFilter
  // (Today, week, month, specific month, quarter, half-year, year, financial year, custom).
  // Defaults to Today; empty start/end = all time. Backend accepts arbitrary dates.
  const [dateRange, setDateRange] = useState(() => {
    const t = fmtLocalDate(new Date());
    return { startDate: t, endDate: t, label: 'today' };
  });
  // Which role's people list the drawer is showing ('' = closed; 'staff' | 'chef' | 'branch_admin' | 'all')
  const [drawerRole, setDrawerRole] = useState('');
  // Sales Report per-chart controls — independent of the global filter. A local
  // trailing-window date filter + which series lines are visible (click to toggle).
  const [salesRange, setSalesRange] = useState('all'); // 'today' | '7d' | '30d' | 'all'
  const [salesSeries, setSalesSeries] = useState({ revenue: true, profit: true, expenses: true });

  // Per-chart controls. Each chart narrows only itself; the page-level date
  // filter still decides the overall period every chart draws from.
  const [salesGrain, setSalesGrain] = useState('day');      // Sales Report bucketing
  const [ordersGrain, setOrdersGrain] = useState('day');    // Daily Orders bucketing
  const [catSelected, setCatSelected] = useState([]);       // [] = every category
  const [paySelected, setPaySelected] = useState([]);       // [] = every method
  const [staffLimit, setStaffLimit] = useState('5');        // leaderboard size
  const [staffSort, setStaffSort] = useState('revenue');    // revenue | orders

  // Branch scope comes solely from the Navbar global filter (AuthContext).
  // Single branch -> its id; all / multi-branch subset -> 'all' (the subset is sent via locationIds).
  const activeLocationId = authLocation ? (authLocation._id || authLocation) : 'all';

  const isDark = theme === 'dark';

  const chartColors = {
    grid: 'var(--color-border)',
    text: 'var(--color-text-muted)',
    tooltipBg: 'var(--color-surface)',
    tooltipBorder: 'var(--color-border)',
  };

  const COLORS = [
    'var(--color-primary)',
    'var(--color-secondary)',
    'var(--color-success)',
    'var(--color-danger)',
    'var(--color-text-muted)'
  ];

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations");
    }
  };

  const fetchAnalytics = async () => {
    const isInitial = !didInitRef.current;
    try {
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
      const params = new URLSearchParams();
      // Multi-branch subset takes priority over single location filter
      if (selectedLocationIds.length > 0) {
        params.append('locationIds', selectedLocationIds.join(','));
      } else if (activeLocationId !== 'all') {
        params.append('locationId', activeLocationId);
      }

      // Date range comes from the UniversalDateFilter (dateRange). Empty = all time.
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const res = await api.get(`/analytics/advanced?${params.toString()}`);
      if (res.data?.data) setAnalytics(res.data.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error.response?.data?.message || error.message);
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  // Recent 10 orders for the overview. Role-scoped by the API: super_admin sees
  // every branch, admin/branch_admin only their own. Fetched separately so it never
  // blocks the stat cards. When a single branch is selected, scope to it.
  const fetchRecentOrders = async () => {
    try {
      setRecentOrdersLoading(true);
      const params = new URLSearchParams({ limit: '10' });
      if (activeLocationId !== 'all') params.append('branchId', activeLocationId);
      const res = await api.get(`/orders?${params.toString()}`);
      setRecentOrders(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch recent orders');
    } finally {
      setRecentOrdersLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
      fetchRecentOrders();
    }, 0);

    return () => clearTimeout(timer);
  }, [authLocation, dateRange, selectedLocationIds]);

  // On first open show the branded full loader (no skeleton). Skeletons only ever
  // appear for a filter-triggered refetch on an already-loaded page.
  if (loading) return <LoadingScreen fullScreen={false} />;

  // Sales Report series definitions (for the click-to-toggle chips + lines).
  const SALES_SERIES = [
    { key: 'revenue', label: 'Revenue', color: 'var(--color-primary)' },
    { key: 'profit', label: 'Profit', color: 'var(--color-success)' },
    { key: 'expenses', label: 'Expenses', color: 'var(--color-danger)' },
  ];

  // Per-chart trailing-window filter for the Sales Report — applied client-side over
  // the already-loaded series, so switching is instant and stays independent of the
  // global time filter at the top of the page.
  const salesData = (() => {
    const ts = analytics?.timeSeries || [];
    let rows = ts;
    if (salesRange !== 'all' && ts.length > 0) {
      const days = salesRange === 'today' ? 1 : salesRange === '7d' ? 7 : 30;
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      rows = ts.filter((d) => new Date(`${d.date}T00:00:00`) >= cutoff);
    }
    return groupSeries(rows, salesGrain, ['revenue', 'profit', 'expenses']);
  })();

  // ── Per-chart derived data ────────────────────────────────────────────────
  // Each block narrows ONE chart from the already-loaded payload, so switching a
  // control is instant and never refetches.

  const allCategories = analytics?.categorySales || [];
  const categoryData = catSelected.length
    ? allCategories.filter((c) => catSelected.includes(c.name))
    : allCategories;

  // Prefer the real per-method breakdown; fall back to the legacy UPI/Cash/Other
  // tiles for a server that has not been redeployed yet.
  const allPayments = (analytics?.paymentStats?.breakdown?.length
    ? analytics.paymentStats.breakdown
    : [
      { name: 'UPI', count: analytics?.paymentStats?.methods?.upiCount || 0 },
      { name: 'CASH', count: analytics?.paymentStats?.methods?.cashCount || 0 },
    ]).filter((m) => m.count > 0);
  const paymentData = paySelected.length
    ? allPayments.filter((m) => paySelected.includes(m.name))
    : allPayments;

  const staffRows = [...(analytics?.staffPerformance || [])]
    .sort((a, b) => (staffSort === 'orders'
      ? (b.totalOrders || 0) - (a.totalOrders || 0)
      : (b.revenue || 0) - (a.revenue || 0)))
    .slice(0, staffLimit === 'all' ? undefined : Number(staffLimit));

  const ordersData = groupSeries(analytics?.timeSeries || [], ordersGrain, ['orders']);

  // Profit margin % over the filtered range — derived from the same summary the
  // stat tiles use, so it follows the global date/branch filters automatically.
  const summaryRevenue = analytics?.summary?.totalRevenue || 0;
  const profitMargin = summaryRevenue > 0
    ? ((analytics?.summary?.netProfit || 0) / summaryRevenue) * 100
    : 0;

  // Small "View →" affordance so every chart links to its full page. stopPropagation
  // keeps it from triggering any click handler on a wrapping card.
  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-95">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-primary " />
              <span className="text-[11px] font-medium uppercase tracking-normal text-primary/80">Online</span>
            </div>
            <div className="h-px w-8 bg-(--color-border)" />
            <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
              {selectedLocationIds.length > 1 ? `Showing ${selectedLocationIds.length} Branches` : activeLocationId === 'all' ? 'Showing All Branches' : 'Showing Branch'}
            </span>
          </motion.div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-(--color-text-primary) flex flex-wrap items-baseline gap-2 sm:gap-3">
            {selectedLocationIds.length > 1 ? 'Multi-Branch' : activeLocationId === 'all' ? 'Business' : (locations.find(l => l._id === activeLocationId)?.city || 'Branch')}
            <span className="text-primary">Overview</span>
          </h1>
          <p className="text-sm text-(--color-text-muted) font-medium max-w-lg leading-relaxed border-l-2 border-primary/30 pl-4">
            Real-time data for {selectedLocationIds.length > 1 ? `${selectedLocationIds.length} selected branches` : activeLocationId === 'all' ? 'all your cafe branches' : (locations.find(l => l._id === activeLocationId)?.name || 'the selected branch')}.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start md:justify-end gap-4 w-full md:w-auto">
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
          {/* Rich reusable date filter — Today (default), week, month, specific month,
              quarter, half-year, year, financial year, custom. Applies on select. */}
          <UniversalDateFilter
            persistKey="dashboard"
            defaultFilter="today"
            loading={refetching}
            onFilterChange={({ startDate, endDate, filterType }) =>
              setDateRange((prev) =>
                prev.startDate === (startDate || '') && prev.endDate === (endDate || '')
                  ? prev
                  : { startDate: startDate || '', endDate: endDate || '', label: filterType }
              )
            }
          />
        </div>
      </div>

      {refetching ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartSkeleton className="lg:col-span-2 h-100" /><ChartSkeleton className="h-100" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CardSkeleton className="h-75" /><CardSkeleton className="h-75" />
          </div>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        <Link href={ordersHref} className="contents">
          <StatWidget label="Total Orders" value={<Num value={analytics?.summary?.totalOrders || 0} animate />} icon={ShoppingBag} color="amber" delay={0.3} />
        </Link>
        <Link href={`${dashPrefix}/revenue`} className="contents">
          <StatWidget label="Total Sales" value={<Money value={analytics?.summary?.totalRevenue || 0} animate />} icon={TrendingUp} color="amber" delay={0} />
        </Link>
        <Link href={`${dashPrefix}/revenue`} className="contents">
          <StatWidget
            label="Net Profit (Revenue)"
            value={
              <span className="inline-flex items-baseline gap-2">
                <Money value={analytics?.summary?.netProfit || 0} animate />
                <span className={`text-sm font-bold ${profitMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                  <CountUp value={profitMargin} suffix="%" decimals={1} />
                </span>
              </span>
            }
            sub={<>Revenue: <Money value={analytics?.summary?.totalRevenue || 0} /></>}
            icon={Zap}
            color="green"
            delay={0.1}
          />
        </Link>
        <Link href={orderAnalyticsHref} className="contents">
          <StatWidget label="Cancel Rate" value={<CountUp value={analytics?.summary?.cancellationRate || 0} suffix="%" decimals={1} />} icon={TrendingDown} color="rose" delay={0.4} />
        </Link>
      </div>

      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link href={`${dashPrefix}/expenses`} className="contents">
            <StatWidget label="Expenses" value={<Money value={analytics?.summary?.totalExpenses || 0} animate />} icon={Wallet} color="rose" delay={0.5} />
          </Link>
          <Link href={`${dashPrefix}/staff`} className="contents">
            <StatWidget label="Staff Count" value={<CountUp value={(analytics?.staffStats?.staffCount || 0) + (analytics?.staffStats?.chefCount || 0)} />} icon={Activity} color="indigo" delay={0.8} />
          </Link>
        </div>
      )}

      <div className="mb-6">
        <CashFlowCard locationId={activeLocationId !== 'all' ? activeLocationId : undefined} />
      </div>

      {/* Cash Drawer — live register summary + last 10 shifts. Read-only here; full
          open/close/pay-in-out lives on the Cash Drawer page. Shown to every admin
          role that can view revenue (branch admins see this overview too). */}
      <CashDrawerWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 !p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Sales Report</CardTitle>
              <TrendingUp size={18} className="text-primary" />
            </div>
            <div className="flex items-center gap-3">
              {/* Per-chart date range — independent of the global filter above */}
              <div className="flex items-center gap-1 bg-(--color-surface-soft)/60 p-1 rounded-xl border border-(--color-border)">
                {['today', '7d', '30d', 'all'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setSalesRange(r)}
                    className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-normal rounded-lg transition-all ${salesRange === r ? 'bg-primary text-(--color-bg-base)' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                  >
                    {r === 'today' ? '1D' : r.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Roll the same window up by day / week / month / year */}
              <ChartToolbar
                segments={[{ key: 'grain', options: GROUP_OPTIONS, value: salesGrain, onChange: setSalesGrain }]}
              />
              <ViewLink href={`${dashPrefix}/revenue`} />
            </div>
          </div>

          {/* Click a chip to show/hide that series on the chart */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {SALES_SERIES.map((s) => {
              const on = salesSeries[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => setSalesSeries((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                  aria-pressed={on}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${on ? 'border-(--color-border) bg-(--color-surface-soft)/60 text-(--color-text-primary)' : 'border-dashed border-(--color-border) text-(--color-text-muted) opacity-60 hover:opacity-100'}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full transition-colors" style={{ backgroundColor: on ? s.color : 'var(--color-text-muted)' }} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="h-75 w-full">
            {salesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-(--color-text-muted) text-sm font-medium">No sales data for this range.</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} dy={10} minTickGap={20} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} width={70} tickFormatter={(v) => formatIndianCompact(v, { currency: true })} />
                <Tooltip
                  formatter={(v) => formatIndianCompact(v, { currency: true })}
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: '16px',
                    border: '1px solid',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                {salesSeries.revenue && <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />}
                {salesSeries.profit && <Area type="monotone" dataKey="profit" name="Profit" stroke="var(--color-success)" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />}
                {salesSeries.expenses && <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-danger)" strokeWidth={2} strokeDasharray="5 5" dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Orders Timeline */}
        <Card className="!p-5 glass-card border-(--color-border) export-chart premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Orders</CardTitle>
              <CardDescription>Total orders per {ordersGrain}.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ChartToolbar
                segments={[{ key: 'grain', options: GROUP_OPTIONS, value: ordersGrain, onChange: setOrdersGrain }]}
              />
              <ViewLink href={orderAnalyticsHref} />
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: '16px',
                    border: '1px solid',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar dataKey="orders" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Orders — last 10 across the viewer's scope (all branches for
          super_admin, own branches for admin/branch_admin). */}
      <Card className="!p-5 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <CardTitle className="text-xl">Recent Orders</CardTitle>
            <CardDescription>
              {user?.role === 'super_admin' ? 'Latest 10 orders across all branches.' : 'Latest 10 orders from your branches.'}
            </CardDescription>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingBag size={20} />
          </div>
        </div>

        {recentOrdersLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-(--color-surface-soft)/40 animate-pulse" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-10 text-(--color-text-muted) font-medium text-sm">No recent orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-normal text-(--color-text-muted) border-b border-(--color-border)">
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Branch</th>
                  <th className="py-3 pr-4">Items</th>
                  <th className="py-3 pr-4 text-center">Qty</th>
                  <th className="py-3 pr-4 text-right">Amount</th>
                  <th className="py-3 pr-4 text-center">Status</th>
                  <th className="py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)/60">
                {recentOrders.map((o, idx) => {
                  const items = Array.isArray(o.items) ? o.items : [];
                  const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
                  const itemsLabel = items.slice(0, 2).map((it) => `${it.quantity}× ${it.itemName || it.menuItem?.name || 'Item'}`).join(', ');
                  const more = items.length > 2 ? ` +${items.length - 2} more` : '';
                  const cancelled = ['CANCELLED', 'REJECTED'].includes(o.status);
                  const done = ['SERVED', 'COMPLETED'].includes(o.status);
                  const statusCls = cancelled ? 'bg-danger/10 text-danger' : done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary';
                  return (
                    <motion.tr
                      key={o._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                      className="hover:bg-(--color-surface-soft)/40 transition-colors"
                    >
                      <td className="py-3 pr-4 text-xs font-semibold text-(--color-text-primary) whitespace-nowrap">
                        #{o._id.substring(o._id.length - 6).toUpperCase()}
                      </td>
                      <td className="py-3 pr-4 text-xs font-medium text-(--color-text-secondary) whitespace-nowrap">{o.branch?.name || '—'}</td>
                      <td className="py-3 pr-4 text-xs font-medium text-(--color-text-muted) max-w-50 truncate" title={itemsLabel + more}>{itemsLabel || '—'}{more}</td>
                      <td className="py-3 pr-4 text-xs font-semibold text-(--color-text-primary) text-center">{totalQty}</td>
                      <td className="py-3 pr-4 text-xs font-bold text-(--color-text-primary) text-right whitespace-nowrap"><Money value={Number(o.totalAmount || o.grandTotal || 0)} /></td>
                      <td className="py-3 pr-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-normal ${statusCls}`}>{o.status}</span>
                      </td>
                      <td className="py-3 text-[11px] font-medium text-(--color-text-muted) text-right whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={() => router.push(ordersHref)}
          className="w-full mt-4 text-xs font-medium uppercase tracking-normal text-(--color-text-muted) hover:text-(--color-text-primary)"
        >
          View All Orders
        </Button>
      </Card>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Expenditures */}
        <Card className="!p-5 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Recent Expenses</CardTitle>
              <CardDescription>Latest expenses from all branches.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
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
                  className="flex items-center justify-between p-4 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border) hover:border-danger/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-(--color-surface) flex items-center justify-center shadow-sm transition-transform">
                      <Receipt size={18} className="text-danger" />
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-(--color-text-primary)">{exp.title}</h5>
                      <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">{exp.locationId?.name || 'Main Office'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-danger"><Money value={exp.totalAmount || 0} prefix="-" /></div>
                    <div className="text-[11px] font-medium text-(--color-text-muted)">{new Date(exp.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-(--color-text-muted) font-medium text-sm">No recent expenses found.</div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push(`${dashPrefix}/expenses`)}
            className="w-full mt-6 text-xs font-medium uppercase tracking-normal text-(--color-text-muted) hover:text-(--color-text-primary)"
          >
            View All Expenses
          </Button>
        </Card>

        {/* Recent Revenues */}
        <Card className="!p-5 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Recent Sales</CardTitle>
              <CardDescription>Latest completed orders.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
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
                  className="flex items-center justify-between p-4 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border) hover:border-success/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-(--color-surface) flex items-center justify-center shadow-sm transition-transform">
                      <ShoppingBag size={18} className="text-success" />
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-(--color-text-primary) truncate w-32 sm:w-auto">
                        Order #{rev._id.substring(rev._id.length - 6).toUpperCase()}
                      </h5>
                      <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Marked by {displayUserName(rev.staffId, 'Staff')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-success"><Money value={rev.totalAmount} prefix="+" /></div>
                    <div className="text-[11px] font-medium text-(--color-text-muted)">{new Date(rev.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-(--color-text-muted) font-medium text-sm">No recent sales found.</div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push(`${dashPrefix}/revenue`)}
            className="w-full mt-6 text-xs font-medium uppercase tracking-normal text-(--color-text-muted) hover:text-(--color-text-primary)"
          >
            View All Sales
          </Button>
        </Card>
      </div>

      {/* Advanced Intelligence Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Smart Forecasting Chart */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Sales Forecast</CardTitle>
              <CardDescription>Predicted sales based on past records.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ViewLink href={`${dashPrefix}/revenue`} />
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Zap size={20} />
              </div>
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.forecast?.nextMonthSalesTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} width={70} tickFormatter={(v) => formatIndianCompact(v, { currency: true })} />
                <Tooltip
                  formatter={(v) => formatIndianCompact(v, { currency: true })}
                  contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '12px' }}
                />
                <Bar dataKey="projected" fill="var(--color-primary)" radius={[6, 6, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="text-primary" size={18} />
              <span className="text-xs font-medium text-(--color-text-muted) uppercase tracking-normal">Expected Today:</span>
            </div>
            <span className="text-lg font-semibold text-primary"><Money value={analytics?.forecast?.expectedTodayRevenue} /></span>
          </div>
        </Card>

        {/* Attendance Trend */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Staff Attendance</CardTitle>
              <CardDescription>Daily present and absent trends.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <ViewLink href={`${dashPrefix}/attendance`} />
              <Activity size={20} className="text-secondary" />
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.attendanceStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} />
                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '12px' }} />
                <Area type="monotone" dataKey="present" stroke="var(--color-secondary)" fill="var(--color-secondary)" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="absent" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.05} strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Category Sales Distribution */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between gap-2 mb-6">
            <CardTitle className="text-lg">Sales by Category</CardTitle>
            <div className="flex items-center gap-2">
              <ChartToolbar
                filters={[{
                  key: 'cat',
                  label: 'Categories',
                  options: allCategories.map((c) => ({ value: c.name, label: c.name })),
                  selected: catSelected,
                  onChange: setCatSelected,
                }]}
              />
              <ViewLink href={orderAnalyticsHref} />
            </div>
          </div>
          <div className="h-[250px] w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm font-medium text-(--color-text-muted)">No sales in this range.</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatIndianCompact(v, { currency: true })} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Payment Methods */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between gap-2 mb-6">
            <CardTitle className="text-lg">Payment Methods</CardTitle>
            <div className="flex items-center gap-2">
              <ChartToolbar
                filters={[{
                  key: 'pay',
                  label: 'Methods',
                  options: allPayments.map((m) => ({ value: m.name, label: m.name, count: m.count })),
                  selected: paySelected,
                  onChange: setPaySelected,
                }]}
              />
              <ViewLink href={['admin', 'super_admin'].includes(user?.role) ? `${dashPrefix}/payment-intelligence` : `${dashPrefix}/revenue`} />
            </div>
          </div>
          <div className="h-[250px] w-full">
            {paymentData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm font-medium text-(--color-text-muted)">No payments in this range.</div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* One slice per method actually used — no residual "Other" bucket. */}
                <Pie
                  data={paymentData.map((m) => ({ name: m.name, value: m.count }))}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentData.map((m, i) => (
                    <Cell
                      key={m.name}
                      fill={['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-amber)', 'var(--color-danger)'][i % 5]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
          {/* Tiles mirror the slices exactly, so the legend and the numbers can
              never tell different stories. */}
          {paymentData.length > 0 && (
            <div className={`mt-4 grid gap-2 ${paymentData.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {paymentData.map((m, i) => (
                // Full class strings, never interpolated — Tailwind only emits
                // classes it can see literally in the source.
                <div key={m.name} className={`p-2 rounded-xl text-center ${PAY_TILE[i % PAY_TILE.length].bg}`}>
                  <p className={`text-[11px] font-medium uppercase ${PAY_TILE[i % PAY_TILE.length].text}`}>{m.name}</p>
                  <p className="text-xs font-semibold">{m.count}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Staff Performance Leaderboard */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow lg:col-span-1" hover={false}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <button
              type="button"
              onClick={() => setDrawerRole('staff')}
              className="group cursor-pointer text-left"
            >
              <CardTitle className="text-lg group-hover:text-primary transition-colors">Staff Leaderboard</CardTitle>
            </button>
            <div className="flex items-center gap-2">
              <ChartToolbar
                segments={[
                  {
                    key: 'sort',
                    options: [{ value: 'revenue', label: '₹' }, { value: 'orders', label: 'Orders' }],
                    value: staffSort,
                    onChange: setStaffSort,
                  },
                  {
                    key: 'limit',
                    options: [{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: 'all', label: 'All' }],
                    value: staffLimit,
                    onChange: setStaffLimit,
                  },
                ]}
              />
              <Target size={18} className="text-(--color-amber) shrink-0" />
            </div>
          </div>
          <div className={`space-y-3 ${staffLimit === 'all' ? 'max-h-80 overflow-y-auto custom-scrollbar pr-1' : ''}`}>
            {staffRows.length === 0 && (
              <p className="text-sm font-medium text-(--color-text-muted) py-8 text-center">No staff sales in this range.</p>
            )}
            {staffRows.map((staff, i) => (
              <div key={staff.name || i} className="flex items-center justify-between p-3 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border)">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-xs font-medium truncate">{staff.name}</span>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <p className="text-[11px] font-semibold text-success"><Money value={staff.revenue} /></p>
                  <p className="text-[11px] font-medium text-(--color-text-muted)">{staff.totalOrders} Orders</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Staff & Payroll Section */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && analytics?.staffStats && (
        <SlideIn delay={0.4}>
          <Card className="!p-5 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                    <Users size={22} />
                  </div>
                  <CardTitle className="text-2xl">Staff & Payroll</CardTitle>
                </div>
                <CardDescription>Breakdown of branch staff, chefs and monthly salary obligations.</CardDescription>
              </div>
              <div className="px-6 py-3 bg-secondary/5 border border-secondary/10 rounded-xl">
                <p className="text-[11px] font-medium uppercase tracking-normal text-secondary mb-1">Monthly Payroll Total</p>
                <p className="text-2xl font-semibold text-secondary tracking-tight"><Money value={analytics?.staffStats?.totalMonthlySalary || 0} /></p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: 'Total Staff', count: analytics?.staffStats?.staffCount || 0, icon: Users, roleKey: 'staff' },
                { label: 'Total Chefs', count: analytics?.staffStats?.chefCount || 0, icon: ChefHat, roleKey: 'chef' },
                { label: 'Branch Admins', count: analytics?.staffStats?.adminCount || 0, icon: User, roleKey: 'branch_admin' }
              ].map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDrawerRole(item.roleKey)}
                  className="text-left p-5 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) flex items-center justify-between group hover:border-primary/30 hover:bg-(--color-surface-soft) transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform">
                      <item.icon size={22} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">{item.label}</p>
                      <p className="text-2xl font-semibold text-(--color-text-primary)">{item.count}</p>
                    </div>
                  </div>
                  <ChevronDown className="text-(--color-text-muted) opacity-30 group-hover:opacity-70 group-hover:text-primary -rotate-90 transition-all" size={18} />
                </button>
              ))}
            </div>
          </Card>
        </SlideIn>
      )}
      </>
      )}

      <PeopleDrawer
        roleKey={drawerRole}
        onClose={() => setDrawerRole('')}
        currentUserRole={user?.role}
        locationId={activeLocationId !== 'all' ? activeLocationId : ''}
        staffHref={`${dashPrefix}/staff`}
      />
    </div>
  );
}
