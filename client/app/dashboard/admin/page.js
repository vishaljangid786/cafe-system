'use client';
import { useState, useEffect } from 'react';
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

export default function AdminDashboard() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user, selectedLocation: authLocation } = useAuth();
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
  const [timeFilter, setTimeFilter] = useState('all'); // '7d', '30d', 'all', 'custom'
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [isLocSelectorOpen, setIsLocSelectorOpen] = useState(false);

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
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterLocation !== 'all') params.append('locationId', filterLocation);

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
      setAnalytics(res.data.data);
    } catch (error) {
      console.error("Failed to fetch analytics");
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only auto-filter if user is not a super_admin or admin (who usually want global view)
    // Or if they explicitly have a selectedLocation that isn't 'all'
    if (authLocation && user?.role !== 'super_admin' && user?.role !== 'admin') {
      const timer = setTimeout(() => {
        setFilterLocation(authLocation._id || authLocation);
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [authLocation, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
    }, 0);

    return () => clearTimeout(timer);
  }, [filterLocation, timeFilter, customDates]);

  if (loading) return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CardSkeleton className="h-[400px]" /><CardSkeleton className="h-[400px]" />
      </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Cinematic System Information Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-[95]">
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-full">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-pulse shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.8)]" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)]/80">System: Online</span>
            </div>
            <div className="h-px w-8 bg-[var(--color-border)]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{filterLocation === 'all' ? 'View: All Branches' : 'View: Branch'}</span>
          </motion.div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-[var(--color-text-primary)] flex flex-wrap items-baseline gap-2 sm:gap-3 uppercase italic">
            {filterLocation === 'all' ? 'Business' : (locations.find(l => l._id === filterLocation)?.city || 'Branch')}
            <span className="text-[var(--color-primary)] not-italic">Overview</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] font-medium max-w-lg leading-relaxed border-l-2 border-[var(--color-primary)]/30 pl-4">
            Real-time data for {filterLocation === 'all' ? 'all your cafe branches' : (locations.find(l => l._id === filterLocation)?.name || 'the selected branch')}.
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
            className="w-full sm:w-[220px]"
          />

          <div className="flex items-center gap-2 sm:gap-3 bg-[var(--color-surface)]/40 p-1.5 rounded-2xl border border-[var(--color-border)] shadow-sm backdrop-blur-md overflow-x-auto no-scrollbar w-full md:w-auto max-w-full">
            {['today', '7d', '30d', 'all', 'custom'].map(t => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${timeFilter === t ? 'bg-[var(--color-primary)] text-[var(--color-bg-base)] shadow-lg shadow-[var(--color-primary)]/20' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]'}`}
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
          className="flex flex-col md:flex-row gap-4 p-6 glass-card border border-[var(--color-border)] rounded-3xl premium-shadow"
        >
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 ml-1">Start Date</label>
            <input type="date" className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 ml-1">End Date</label>
            <input type="date" className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <Link href="/dashboard/admin/orders" className="contents">
          <StatWidget label="Total Orders" value={analytics?.summary?.totalOrders || '0'} icon={ShoppingBag} color="amber" delay={0.3} />
        </Link>
        <Link href="/dashboard/admin/revenue" className="contents">
          <StatWidget label="Total Sales" value={`₹${analytics?.summary?.totalRevenue?.toLocaleString() || '0'}`} icon={TrendingUp} color="amber" delay={0} />
        </Link>
        <Link href="/dashboard/admin/revenue" className="contents">
          <StatWidget label="Net Profit" value={`₹${analytics?.summary?.netProfit?.toLocaleString() || '0'}`} icon={Zap} color="green" delay={0.1} />
        </Link>
        <Link href="/dashboard/admin/orders/analytics" className="contents">
          <StatWidget label="Avg Order Value" value={`₹${Math.round(analytics?.summary?.avgOrderValue || 0).toLocaleString()}`} icon={Target} color="indigo" delay={0.2} />
        </Link>
        <Link href="/dashboard/admin/orders/analytics" className="contents">
          <StatWidget label="Cancel Rate" value={`${analytics?.summary?.cancellationRate || 0}%`} icon={TrendingDown} color="rose" delay={0.4} />
        </Link>
      </div>

      {(user?.role === 'admin' || user?.role === 'super_admin') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/dashboard/admin/expenses" className="contents">
            <StatWidget label="Expenses" value={`₹${analytics?.summary?.totalExpenses?.toLocaleString() || '0'}`} icon={Wallet} color="rose" delay={0.5} />
          </Link>
          <Link href="/dashboard/admin/payroll" className="contents">
            <StatWidget label="Monthly Payroll" value={`₹${analytics?.staffStats?.totalMonthlySalary?.toLocaleString() || '0'}`} icon={Users} color="indigo" delay={0.6} />
          </Link>
          <Link href="/dashboard/admin/payroll" className="contents">
            <StatWidget label="Avg Staff Salary" value={`₹${Math.round(analytics?.staffStats?.avgSalary || 0).toLocaleString()}`} icon={DollarSign} color="amber" delay={0.7} />
          </Link>
          <Link href="/dashboard/admin/staff" className="contents">
            <StatWidget label="Staff Count" value={(analytics?.staffStats?.staffCount || 0) + (analytics?.staffStats?.chefCount || 0) || '0'} icon={Activity} color="indigo" delay={0.8} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 !p-8 glass-card border-[var(--color-border)] premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <CardTitle className="text-xl">Sales Report</CardTitle>
            <TrendingUp size={20} className="text-[var(--color-primary)]" />
          </div>
          <div className="h-[300px] w-full">
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
        <Card className="!p-8 glass-card border-[var(--color-border)] export-chart premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-10">
            <div className="space-y-1">
              <CardTitle className="text-xl">Daily Orders</CardTitle>
              <CardDescription>Total orders per day.</CardDescription>
            </div>
            <div className="p-3 bg-[var(--color-primary)]/10 rounded-2xl text-[var(--color-primary)]">
              <Layers size={20} />
            </div>
          </div>
          <div className="h-[300px] w-full">
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
        <Card className="!p-8 bg-[var(--color-surface)]/20 border-[var(--color-border)]" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Recent Expenses</CardTitle>
              <CardDescription>Latest expenses from all branches.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center text-[var(--color-danger)]">
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
                  className="flex items-center justify-between p-4 bg-[var(--color-surface-soft)]/50 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-danger)]/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Receipt size={18} className="text-[var(--color-danger)]" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-[var(--color-text-primary)]">{exp.title}</h5>
                      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{exp.locationId?.name || 'Main Office'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-[var(--color-danger)]">-₹{(exp.totalAmount || 0).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{new Date(exp.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-[var(--color-text-muted)] font-medium italic text-sm">No recent expenses found.</div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/admin/expenses')}
            className="w-full mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            View All Expenses
          </Button>
        </Card>

        {/* Recent Revenues */}
        <Card className="!p-8 bg-[var(--color-surface)]/20 border-[var(--color-border)]" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Recent Sales</CardTitle>
              <CardDescription>Latest completed orders.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-[var(--color-success)]/10 flex items-center justify-center text-[var(--color-success)]">
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
                  className="flex items-center justify-between p-4 bg-[var(--color-surface-soft)]/50 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-success)]/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <ShoppingBag size={18} className="text-[var(--color-success)]" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-[var(--color-text-primary)] truncate w-32 sm:w-auto">
                        Order #{rev._id.substring(rev._id.length - 6).toUpperCase()}
                      </h5>
                      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Marked by {rev.staffId?.name || 'Staff'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-[var(--color-success)]">+₹{rev.totalAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{new Date(rev.date).toLocaleDateString()}</div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-[var(--color-text-muted)] font-medium italic text-sm">No recent sales found.</div>
            )}
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/admin/revenue')}
            className="w-full mt-6 text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            View All Sales
          </Button>
        </Card>
      </div>

      {/* Advanced Intelligence Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Smart Forecasting Chart */}
        <Card className="!p-8 glass-card border-[var(--color-border)] premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Smart Forecasting</CardTitle>
              <CardDescription>Predicted sales trends based on history.</CardDescription>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] animate-pulse">
              <Zap size={20} />
            </div>
          </div>
          <div className="h-[300px] w-full">
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
          <div className="mt-6 p-4 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="text-[var(--color-primary)]" size={18} />
              <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Expected Today:</span>
            </div>
            <span className="text-lg font-black text-[var(--color-primary)]">₹{analytics?.forecast?.expectedTodayRevenue?.toLocaleString()}</span>
          </div>
        </Card>

        {/* Attendance Trend */}
        <Card className="!p-8 glass-card border-[var(--color-border)] premium-shadow" hover={false}>
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <CardTitle className="text-xl">Workforce Attendance</CardTitle>
              <CardDescription>Daily presence and absence trends.</CardDescription>
            </div>
            <Activity size={20} className="text-[var(--color-secondary)]" />
          </div>
          <div className="h-[300px] w-full">
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
        <Card className="!p-8 glass-card border-[var(--color-border)] premium-shadow" hover={false}>
          <CardTitle className="text-lg mb-6">Category Distribution</CardTitle>
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
        <Card className="!p-8 glass-card border-[var(--color-border)] premium-shadow" hover={false}>
          <CardTitle className="text-lg mb-6">Payment Intelligence</CardTitle>
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
            <div className="p-2 bg-[var(--color-primary)]/5 rounded-xl text-center">
              <p className="text-[8px] font-black uppercase text-[var(--color-primary)]">UPI</p>
              <p className="text-xs font-black">{analytics?.paymentStats?.methods?.upiCount}</p>
            </div>
            <div className="p-2 bg-[var(--color-secondary)]/5 rounded-xl text-center">
              <p className="text-[8px] font-black uppercase text-[var(--color-secondary)]">Cash</p>
              <p className="text-xs font-black">{analytics?.paymentStats?.methods?.cashCount}</p>
            </div>
            <div className="p-2 bg-[var(--color-amber)]/5 rounded-xl text-center">
              <p className="text-[8px] font-black uppercase text-[var(--color-amber)]">Other</p>
              <p className="text-xs font-black">{analytics?.paymentStats?.methods?.otherCount || 0}</p>
            </div>
          </div>
        </Card>

        {/* Staff Performance Leaderboard */}
        <Card className="!p-8 glass-card border-[var(--color-border)] premium-shadow lg:col-span-1" hover={false}>
          <div className="flex items-center justify-between mb-6">
            <CardTitle className="text-lg">Staff Leaderboard</CardTitle>
            <Target size={18} className="text-[var(--color-amber)]" />
          </div>
          <div className="space-y-3">
            {analytics?.staffPerformance?.slice(0, 5).map((staff, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[var(--color-surface-soft)]/50 rounded-xl border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[10px] font-black text-[var(--color-primary)]">
                    {i + 1}
                  </div>
                  <span className="text-xs font-bold truncate w-24">{staff.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[var(--color-success)]">₹{staff.revenue.toLocaleString()}</p>
                  <p className="text-[8px] font-bold text-[var(--color-text-muted)]">{staff.totalOrders} Orders</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Staff & Payroll Section */}
      {(user?.role === 'admin' || user?.role === 'super_admin') && analytics?.staffStats && (
        <SlideIn delay={0.4}>
          <Card className="!p-8 bg-[var(--color-surface)]/20 border-[var(--color-border)]" hover={false}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[var(--color-secondary)]/10 rounded-xl text-[var(--color-secondary)]">
                    <Users size={24} />
                  </div>
                  <CardTitle className="text-2xl">Staff & Payroll</CardTitle>
                </div>
                <CardDescription>Breakdown of branch staff, chefs and monthly salary obligations.</CardDescription>
              </div>
              <div className="px-6 py-3 bg-[var(--color-secondary)]/5 border border-[var(--color-secondary)]/10 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-secondary)] mb-1">Monthly Payroll Total</p>
                <p className="text-3xl font-black text-[var(--color-secondary)] tracking-tighter">₹{analytics?.staffStats?.totalMonthlySalary?.toLocaleString() || '0'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Staff', count: analytics?.staffStats?.staffCount || 0, icon: Users, color: 'amber' },
                { label: 'Total Chefs', count: analytics?.staffStats?.chefCount || 0, icon: ChefHat, color: 'orange' },
                { label: 'Branch Admins', count: analytics?.staffStats?.adminCount || 0, icon: User, color: 'indigo' }
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-3xl bg-[var(--color-surface-soft)]/50 border border-[var(--color-border)] flex items-center justify-between group hover:border-[var(--color-primary)]/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] group-hover:scale-110 transition-transform">
                      <item.icon size={22} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{item.label}</p>
                      <p className="text-2xl font-black text-[var(--color-text-primary)]">{item.count}</p>
                    </div>
                  </div>
                  <ChevronDown className="text-[var(--color-text-muted)] opacity-30 -rotate-90" size={18} />
                </div>
              ))}
            </div>
          </Card>
        </SlideIn>
      )}
    </div>
  );
}
