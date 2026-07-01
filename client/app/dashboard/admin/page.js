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
  ChevronDown, User, DollarSign,
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
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ExportActions from '../../components/ui/ExportActions';
import { SlideIn } from '@/app/components/ui/AnimatedContainer';
import Link from 'next/link';
import PeopleDrawer from './components/PeopleDrawer';
import CashDrawerWidget from './components/CashDrawerWidget';

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
  const [timeFilter, setTimeFilter] = useState('all'); // '7d', '30d', 'all', 'custom'
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  // Which role's people list the drawer is showing ('' = closed; 'staff' | 'chef' | 'branch_admin' | 'all')
  const [drawerRole, setDrawerRole] = useState('');

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

      const now = new Date();
      let start = '';
      let end = '';

      // Format as a LOCAL calendar date (YYYY-MM-DD). Using toISOString() shifted
      // IST-local midnight back to the previous UTC day, so "Today" wrongly pulled
      // in yesterday's orders. Local date parts keep the day boundary correct.
      const fmtLocal = (dt) =>
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

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

        start = fmtLocal(d);
        end = fmtLocal(now);
      }

      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);

      const res = await api.get(`/analytics/advanced?${params.toString()}`);
      if (res.data?.data) setAnalytics(res.data.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error.response?.data?.message || error.message);
      toast.error("Could not load dashboard. Please try again.");
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
  }, [authLocation, timeFilter, customDates, selectedLocationIds]);

  // On first open show the branded full loader (no skeleton). Skeletons only ever
  // appear for a filter-triggered refetch on an already-loaded page.
  if (loading) return <LoadingScreen fullScreen={false} />;

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
          <div className="flex items-center gap-2 sm:gap-3 bg-(--color-surface)/40 p-1.5 rounded-xl border border-(--color-border) shadow-sm  overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
            {['today', '7d', '30d', 'all', 'custom'].map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 sm:px-4 py-2 text-[11px] font-medium uppercase tracking-normal rounded-xl transition-all whitespace-nowrap ${timeFilter === t ? 'bg-primary text-(--color-bg-base) shadow-sm ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-surface)'}`}
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
          className="flex flex-col md:flex-row gap-4 p-5 glass-card border border-(--color-border) rounded-xl premium-shadow"
        >
          <div className="flex-1">
            <label className="block text-[11px] font-medium uppercase text-(--color-text-muted) mb-2 ml-1">Start Date</label>
            <input type="date" className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium uppercase text-(--color-text-muted) mb-2 ml-1">End Date</label>
            <input type="date" className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
          </div>
        </motion.div>
      )}

      {refetching ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <Link href={ordersHref} className="contents">
          <StatWidget label="Total Orders" value={<CountUp value={analytics?.summary?.totalOrders || 0} />} icon={ShoppingBag} color="amber" delay={0.3} />
        </Link>
        <Link href={`${dashPrefix}/revenue`} className="contents">
          <StatWidget label="Total Sales" value={<CountUp value={analytics?.summary?.totalRevenue || 0} prefix="₹" />} icon={TrendingUp} color="amber" delay={0} />
        </Link>
        <Link href={`${dashPrefix}/revenue`} className="contents">
          <StatWidget label="Net Profit (Revenue)" value={<CountUp value={analytics?.summary?.netProfit || 0} prefix="₹" />} icon={Zap} color="green" delay={0.1} />
        </Link>
        <Link href={orderAnalyticsHref} className="contents">
          <StatWidget label="Avg Order Value" value={<CountUp value={Math.round(analytics?.summary?.avgOrderValue || 0)} prefix="₹" />} icon={Target} color="indigo" delay={0.2} />
        </Link>
        <Link href={orderAnalyticsHref} className="contents">
          <StatWidget label="Cancel Rate" value={<CountUp value={analytics?.summary?.cancellationRate || 0} suffix="%" decimals={1} />} icon={TrendingDown} color="rose" delay={0.4} />
        </Link>
      </div>

      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link href={`${dashPrefix}/expenses`} className="contents">
            <StatWidget label="Expenses" value={<CountUp value={analytics?.summary?.totalExpenses || 0} prefix="₹" />} icon={Wallet} color="rose" delay={0.5} />
          </Link>
          <Link href={`${dashPrefix}/payroll`} className="contents">
            <StatWidget label="Monthly Payroll" value={<CountUp value={analytics?.staffStats?.totalMonthlySalary || 0} prefix="₹" />} icon={Users} color="indigo" delay={0.6} />
          </Link>
          <Link href={`${dashPrefix}/payroll`} className="contents">
            <StatWidget label="Avg Staff Salary" value={<CountUp value={Math.round(analytics?.staffStats?.avgSalary || 0)} prefix="₹" />} icon={DollarSign} color="amber" delay={0.7} />
          </Link>
          <Link href={`${dashPrefix}/staff`} className="contents">
            <StatWidget label="Staff Count" value={<CountUp value={(analytics?.staffStats?.staffCount || 0) + (analytics?.staffStats?.chefCount || 0)} />} icon={Activity} color="indigo" delay={0.8} />
          </Link>
        </div>
      )}

      {/* Cash Drawer — live register summary + last 10 shifts. Read-only here; full
          open/close/pay-in-out lives on the Cash Drawer page. Shown to every admin
          role that can view revenue (branch admins see this overview too). */}
      <CashDrawerWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 !p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <CardTitle className="text-xl">Sales Report</CardTitle>
            <TrendingUp size={20} className="text-primary" />
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.timeSeries}>
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
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} tickFormatter={v => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    borderColor: chartColors.tooltipBorder,
                    borderRadius: '16px',
                    border: '1px solid',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="profit" stroke="var(--color-success)" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                <Line type="monotone" dataKey="expenses" stroke="var(--color-danger)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Orders Timeline */}
        <Card className="!p-5 glass-card border-(--color-border) export-chart premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Daily Orders</CardTitle>
              <CardDescription>Total orders per day.</CardDescription>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Layers size={20} />
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.timeSeries}>
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
                      <td className="py-3 pr-4 text-xs font-bold text-(--color-text-primary) text-right whitespace-nowrap">₹{Number(o.totalAmount || o.grandTotal || 0).toLocaleString('en-IN')}</td>
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
                    <div className="text-sm font-semibold text-danger">-₹{(exp.totalAmount || 0).toLocaleString()}</div>
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
                      <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Marked by {rev.staffId?.name || 'Staff'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-success">+₹{rev.totalAmount.toLocaleString()}</div>
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
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Zap size={20} />
            </div>
          </div>
          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.forecast?.nextMonthSalesTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartColors.text }} />
                <Tooltip
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
            <span className="text-lg font-semibold text-primary">₹{analytics?.forecast?.expectedTodayRevenue?.toLocaleString()}</span>
          </div>
        </Card>

        {/* Attendance Trend */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Staff Attendance</CardTitle>
              <CardDescription>Daily present and absent trends.</CardDescription>
            </div>
            <Activity size={20} className="text-secondary" />
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
          <CardTitle className="text-lg mb-6">Sales by Category</CardTitle>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.categorySales}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {analytics?.categorySales?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Payment Methods */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow" hover={false}>
          <CardTitle className="text-lg mb-6">Payment Methods</CardTitle>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'UPI', value: analytics?.paymentStats?.methods?.upiCount || 0 },
                    { name: 'CASH', value: analytics?.paymentStats?.methods?.cashCount || 0 },
                    { name: 'OTHER', value: analytics?.paymentStats?.methods?.otherCount || 0 }
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="var(--color-primary)" />
                  <Cell fill="var(--color-secondary)" />
                  <Cell fill="var(--color-amber)" />
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="p-2 bg-primary/5 rounded-xl text-center">
              <p className="text-[11px] font-medium uppercase text-primary">UPI</p>
              <p className="text-xs font-semibold">{analytics?.paymentStats?.methods?.upiCount}</p>
            </div>
            <div className="p-2 bg-secondary/5 rounded-xl text-center">
              <p className="text-[11px] font-medium uppercase text-secondary">Cash</p>
              <p className="text-xs font-semibold">{analytics?.paymentStats?.methods?.cashCount}</p>
            </div>
            <div className="p-2 bg-(--color-amber)/5 rounded-xl text-center">
              <p className="text-[11px] font-medium uppercase text-(--color-amber)">Other</p>
              <p className="text-xs font-semibold">{analytics?.paymentStats?.methods?.otherCount || 0}</p>
            </div>
          </div>
        </Card>

        {/* Staff Performance Leaderboard */}
        <Card className="!p-5 glass-card border-(--color-border) premium-shadow lg:col-span-1" hover={false}>
          <button
            type="button"
            onClick={() => setDrawerRole('staff')}
            className="w-full flex items-center justify-between mb-6 group cursor-pointer text-left"
          >
            <CardTitle className="text-lg group-hover:text-primary transition-colors">Staff Leaderboard</CardTitle>
            <Target size={18} className="text-(--color-amber) transition-transform" />
          </button>
          <div className="space-y-3">
            {analytics?.staffPerformance?.slice(0, 5).map((staff, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border)">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
                    {i + 1}
                  </div>
                  <span className="text-xs font-medium truncate w-24">{staff.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-success">₹{staff.revenue.toLocaleString()}</p>
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
                <p className="text-2xl font-semibold text-secondary tracking-tight">₹{analytics?.staffStats?.totalMonthlySalary?.toLocaleString() || '0'}</p>
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
