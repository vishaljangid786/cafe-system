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
  ChevronDown, MapPin, User, DollarSign,
  CreditCard, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { ChartSkeleton } from '@/app/components/ui/Skeleton';
import { StatWidget } from '../../components/ui/StatWidget';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Button } from '../../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ExportActions from '../../components/ui/ExportActions';
import PremiumSelect from '../../components/ui/PremiumSelect';
import { SlideIn } from '@/app/components/ui/AnimatedContainer';
import Link from 'next/link';
import PeopleDrawer from './components/PeopleDrawer';

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
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [timeFilter, setTimeFilter] = useState('all'); // '7d', '30d', 'all', 'custom'
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [isLocSelectorOpen, setIsLocSelectorOpen] = useState(false);
  // Which role's people list the drawer is showing ('' = closed; 'staff' | 'chef' | 'branch_admin' | 'all')
  const [drawerRole, setDrawerRole] = useState('');

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
      } else if (filterLocation !== 'all') {
        params.append('locationId', filterLocation);
      }

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Sync page filter whenever the Navbar branch selector changes (all roles)
  useEffect(() => {
    if (selectedLocationIds.length > 0) {
      // Multi-branch selection — keep filterLocation as 'all' visually; fetchAnalytics uses locationIds
      setFilterLocation('all');
    } else {
      const id = authLocation?._id || authLocation;
      setFilterLocation(id || 'all');
    }
  }, [authLocation, selectedLocationIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
    }, 0);

    return () => clearTimeout(timer);
  }, [filterLocation, timeFilter, customDates, selectedLocationIds]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-95">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse " />
              <span className="text-[9px] font-bold uppercase tracking-normal text-primary/80">Online</span>
            </div>
            <div className="h-px w-8 bg-(--color-border)" />
            <span className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">
              {selectedLocationIds.length > 1 ? `Showing ${selectedLocationIds.length} Branches` : filterLocation === 'all' ? 'Showing All Branches' : 'Showing Branch'}
            </span>
          </motion.div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-(--color-text-primary) flex flex-wrap items-baseline gap-2 sm:gap-3 uppercase italic">
            {selectedLocationIds.length > 1 ? 'Multi-Branch' : filterLocation === 'all' ? 'Business' : (locations.find(l => l._id === filterLocation)?.city || 'Branch')}
            <span className="text-primary not-italic">Overview</span>
          </h1>
          <p className="text-sm text-(--color-text-muted) font-medium max-w-lg leading-relaxed border-l-2 border-primary/30 pl-4">
            Real-time data for {selectedLocationIds.length > 1 ? `${selectedLocationIds.length} selected branches` : filterLocation === 'all' ? 'all your cafe branches' : (locations.find(l => l._id === filterLocation)?.name || 'the selected branch')}.
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
          <PremiumSelect
            icon={MapPin}
            value={filterLocation}
            onChange={(val) => setFilterLocation(val)}
            options={[
              { label: 'All Branches', value: 'all' },
              ...locations.map(loc => ({ label: loc.name, value: loc._id }))
            ]}
            className="w-full sm:w-55"
          />

          <div className="flex items-center gap-2 sm:gap-3 bg-(--color-surface)/40 p-1.5 rounded-xl border border-(--color-border) shadow-sm  overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
            {['today', '7d', '30d', 'all', 'custom'].map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all whitespace-nowrap ${timeFilter === t ? 'bg-primary text-(--color-bg-base) shadow-lg ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-surface)'}`}
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
          className="flex flex-col md:flex-row gap-4 p-6 glass-card border border-(--color-border) rounded-xl premium-shadow"
        >
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">Start Date</label>
            <input type="date" className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">End Date</label>
            <input type="date" className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
          </div>
        </motion.div>
      )}

      {refetching ? (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <ChartSkeleton className="lg:col-span-2 h-100" /><ChartSkeleton className="h-100" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CardSkeleton className="h-75" /><CardSkeleton className="h-75" />
          </div>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <Link href={ordersHref} className="contents">
          <StatWidget label="Total Orders" value={analytics?.summary?.totalOrders || '0'} icon={ShoppingBag} color="amber" delay={0.3} />
        </Link>
        <Link href={`${dashPrefix}/revenue`} className="contents">
          <StatWidget label="Total Sales" value={`₹${analytics?.summary?.totalRevenue?.toLocaleString() || '0'}`} icon={TrendingUp} color="amber" delay={0} />
        </Link>
        <Link href={`${dashPrefix}/revenue`} className="contents">
          <StatWidget label="Net Profit" value={`₹${analytics?.summary?.netProfit?.toLocaleString() || '0'}`} icon={Zap} color="green" delay={0.1} />
        </Link>
        <Link href={orderAnalyticsHref} className="contents">
          <StatWidget label="Avg Order Value" value={`₹${Math.round(analytics?.summary?.avgOrderValue || 0).toLocaleString()}`} icon={Target} color="indigo" delay={0.2} />
        </Link>
        <Link href={orderAnalyticsHref} className="contents">
          <StatWidget label="Cancel Rate" value={`${analytics?.summary?.cancellationRate || 0}%`} icon={TrendingDown} color="rose" delay={0.4} />
        </Link>
      </div>

      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href={`${dashPrefix}/expenses`} className="contents">
            <StatWidget label="Expenses" value={`₹${analytics?.summary?.totalExpenses?.toLocaleString() || '0'}`} icon={Wallet} color="rose" delay={0.5} />
          </Link>
          <Link href={`${dashPrefix}/payroll`} className="contents">
            <StatWidget label="Monthly Payroll" value={`₹${analytics?.staffStats?.totalMonthlySalary?.toLocaleString() || '0'}`} icon={Users} color="indigo" delay={0.6} />
          </Link>
          <Link href={`${dashPrefix}/payroll`} className="contents">
            <StatWidget label="Avg Staff Salary" value={`₹${Math.round(analytics?.staffStats?.avgSalary || 0).toLocaleString()}`} icon={DollarSign} color="amber" delay={0.7} />
          </Link>
          <Link href={`${dashPrefix}/staff`} className="contents">
            <StatWidget label="Staff Count" value={(analytics?.staffStats?.staffCount || 0) + (analytics?.staffStats?.chefCount || 0) || '0'} icon={Activity} color="indigo" delay={0.8} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 !p-8 glass-card border-(--color-border) premium-shadow" hover={false}>
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
        <Card className="!p-8 glass-card border-(--color-border) export-chart premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-10">
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

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Expenditures */}
        <Card className="!p-8 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
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
                      <h5 className="text-sm font-bold text-(--color-text-primary)">{exp.title}</h5>
                      <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">{exp.locationId?.name || 'Main Office'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-danger">-₹{(exp.totalAmount || 0).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-(--color-text-muted) uppercase">{new Date(exp.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-(--color-text-muted) font-medium italic text-sm">No recent expenses found.</div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push(`${dashPrefix}/expenses`)}
            className="w-full mt-6 text-xs font-bold uppercase tracking-normal text-(--color-text-muted) hover:text-(--color-text-primary)"
          >
            View All Expenses
          </Button>
        </Card>

        {/* Recent Revenues */}
        <Card className="!p-8 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
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
                      <h5 className="text-sm font-bold text-(--color-text-primary) truncate w-32 sm:w-auto">
                        Order #{rev._id.substring(rev._id.length - 6).toUpperCase()}
                      </h5>
                      <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">Marked by {rev.staffId?.name || 'Staff'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-success">+₹{rev.totalAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-(--color-text-muted) uppercase">{new Date(rev.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-(--color-text-muted) font-medium italic text-sm">No recent sales found.</div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push(`${dashPrefix}/revenue`)}
            className="w-full mt-6 text-xs font-bold uppercase tracking-normal text-(--color-text-muted) hover:text-(--color-text-primary)"
          >
            View All Sales
          </Button>
        </Card>
      </div>

      {/* Advanced Intelligence Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Smart Forecasting Chart */}
        <Card className="!p-8 glass-card border-(--color-border) premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Sales Forecast</CardTitle>
              <CardDescription>Predicted sales based on past records.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
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
              <span className="text-xs font-bold text-(--color-text-muted) uppercase tracking-normal">Expected Today:</span>
            </div>
            <span className="text-lg font-bold text-primary">₹{analytics?.forecast?.expectedTodayRevenue?.toLocaleString()}</span>
          </div>
        </Card>

        {/* Attendance Trend */}
        <Card className="!p-8 glass-card border-(--color-border) premium-shadow" hover={false}>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Category Sales Distribution */}
        <Card className="!p-8 glass-card border-(--color-border) premium-shadow" hover={false}>
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
        <Card className="!p-8 glass-card border-(--color-border) premium-shadow" hover={false}>
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
              <p className="text-[8px] font-bold uppercase text-primary">UPI</p>
              <p className="text-xs font-bold">{analytics?.paymentStats?.methods?.upiCount}</p>
            </div>
            <div className="p-2 bg-secondary/5 rounded-xl text-center">
              <p className="text-[8px] font-bold uppercase text-secondary">Cash</p>
              <p className="text-xs font-bold">{analytics?.paymentStats?.methods?.cashCount}</p>
            </div>
            <div className="p-2 bg-(--color-amber)/5 rounded-xl text-center">
              <p className="text-[8px] font-bold uppercase text-(--color-amber)">Other</p>
              <p className="text-xs font-bold">{analytics?.paymentStats?.methods?.otherCount || 0}</p>
            </div>
          </div>
        </Card>

        {/* Staff Performance Leaderboard */}
        <Card className="!p-8 glass-card border-(--color-border) premium-shadow lg:col-span-1" hover={false}>
          <button
            type="button"
            onClick={() => setDrawerRole('staff')}
            className="w-full flex items-center justify-between mb-6 group cursor-pointer text-left"
          >
            <CardTitle className="text-lg group-hover:text-primary transition-colors">Staff Leaderboard</CardTitle>
            <Target size={18} className="text-(--color-amber) group-hover:scale-110 transition-transform" />
          </button>
          <div className="space-y-3">
            {analytics?.staffPerformance?.slice(0, 5).map((staff, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border)">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {i + 1}
                  </div>
                  <span className="text-xs font-bold truncate w-24">{staff.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-success">₹{staff.revenue.toLocaleString()}</p>
                  <p className="text-[8px] font-bold text-(--color-text-muted)">{staff.totalOrders} Orders</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Staff & Payroll Section */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && analytics?.staffStats && (
        <SlideIn delay={0.4}>
          <Card className="!p-8 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-secondary/10 rounded-xl text-secondary">
                    <Users size={24} />
                  </div>
                  <CardTitle className="text-2xl">Staff & Payroll</CardTitle>
                </div>
                <CardDescription>Breakdown of branch staff, chefs and monthly salary obligations.</CardDescription>
              </div>
              <div className="px-6 py-3 bg-secondary/5 border border-secondary/10 rounded-xl">
                <p className="text-[10px] font-bold uppercase tracking-normal text-secondary mb-1">Monthly Payroll Total</p>
                <p className="text-3xl font-bold text-secondary tracking-tight">₹{analytics?.staffStats?.totalMonthlySalary?.toLocaleString() || '0'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Staff', count: analytics?.staffStats?.staffCount || 0, icon: Users, roleKey: 'staff' },
                { label: 'Total Chefs', count: analytics?.staffStats?.chefCount || 0, icon: ChefHat, roleKey: 'chef' },
                { label: 'Branch Admins', count: analytics?.staffStats?.adminCount || 0, icon: User, roleKey: 'branch_admin' }
              ].map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDrawerRole(item.roleKey)}
                  className="text-left p-6 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) flex items-center justify-between group hover:border-primary/30 hover:bg-(--color-surface-soft) transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-105">
                      <item.icon size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">{item.label}</p>
                      <p className="text-2xl font-bold text-(--color-text-primary)">{item.count}</p>
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
        locationId={filterLocation !== 'all' ? filterLocation : ''}
        staffHref={`${dashPrefix}/staff`}
      />
    </div>
  );
}
