'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import {
  Crown, Map, DollarSign, ArrowUpRight, Users, ChefHat, Ticket, CreditCard,
  AlertOctagon, Radio, Cpu, Terminal, BarChart3, Globe, Zap, ShieldAlert,
  ChevronRight, ShoppingBag, Receipt, Wallet, Package, Store, UtensilsCrossed,
  Clock, TrendingUp, Coins, Percent, Building2, ClipboardList, ScrollText,
} from 'lucide-react';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { StatGridSkeleton } from '@/app/components/ui/Skeleton';
import UniversalDateFilter from '@/app/components/ui/UniversalDateFilter';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Money, Num } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const PAY_COLORS = { CASH: '#f59e0b', UPI: '#8b5cf6', CARD: '#3b82f6', ONLINE: '#10b981', GIFT_CARD: '#ec4899', OTHER: '#71717a' };
const STATUS_TONE = {
  COMPLETED: 'text-success', SERVED: 'text-success', PLACED: 'text-primary',
  PREPARING: 'text-primary', ACCEPTED: 'text-primary', READY: 'text-primary',
  CANCELLED: 'text-danger', REJECTED: 'text-danger', AWAITING_APPROVAL: 'text-(--color-text-muted)',
};

const QUICK_LINKS = [
  { label: 'Revenue', href: '/dashboard/admin/revenue', icon: TrendingUp },
  { label: 'Expenses', href: '/dashboard/admin/expenses', icon: Wallet },
  { label: 'Orders', href: '/dashboard/admin/orders', icon: ShoppingBag },
  { label: 'Menu', href: '/dashboard/admin/menu', icon: UtensilsCrossed },
  { label: 'Staff', href: '/dashboard/admin/staff', icon: Users },
  { label: 'Customers', href: '/dashboard/admin/customers', icon: Users },
  { label: 'Coupons', href: '/dashboard/admin/coupons', icon: Ticket },
  { label: 'Inventory', href: '/dashboard/admin/inventory', icon: Package },
  { label: 'Branches', href: '/dashboard/admin/locations', icon: Building2 },
  { label: 'Payroll', href: '/dashboard/admin/payroll', icon: Coins },
  { label: 'Payments', href: '/dashboard/admin/payment-intelligence', icon: CreditCard },
  { label: 'Audit Logs', href: '/dashboard/admin/audit-logs', icon: ScrollText },
];

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { cafes = [] } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', cafeId: 'all' });

  const fetchSummary = async (isInitial) => {
    if (isInitial) setLoading(true); else setRefetching(true);
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.cafeId && filters.cafeId !== 'all') params.cafeId = filters.cafeId;
      const res = await api.get('/super-admin/executive-summary', { params });
      setData(res.data.data);
    } catch (err) {
      console.error('Could not load dashboard data');
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchSummary(!data), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const alertCount = (data?.alerts?.lowStockItems || 0) + (data?.alerts?.recentCancellations || 0);
  const trend = useMemo(
    () => (data?.revenueTrend || []).map((d) => ({ ...d, label: d.date?.slice(5) })),
    [data]
  );
  const paymentData = useMemo(
    () => (data?.paymentSplit || []).filter((p) => p.type),
    [data]
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="min-h-screen text-(--color-text-primary) p-6 lg:p-12 space-y-6 relative selection:bg-primary selection:text-white">

        {/* Global Control Header */}
        <SlideIn>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 relative z-10">
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-2.5 py-1 bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wide rounded-full border border-primary/30">
                  <Cpu size={12} /> Command Center
                </div>
                <div className="h-1 w-1 bg-(--color-border) rounded-full" />
                <div className="text-(--color-text-muted) text-[11px] font-medium uppercase tracking-wide">Version 4.2.0</div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-(--color-text-primary) flex items-center flex-wrap gap-x-4 gap-y-1 leading-tight wrap-break-word">
                <Crown className="text-primary h-7 w-7 shrink-0" />
                Admin <span className="text-(--color-text-muted)">Dashboard</span>
              </h1>
              <div className="flex items-center gap-3 text-(--color-text-secondary) font-medium text-sm">
                <Radio size={16} className="text-success animate-pulse" />
                <span className="text-(--color-text-primary) tracking-normal"><Num value={data?.totalBranches || 0} /> branches · <Num value={data?.totalCafes || 0} /> cafes active</span>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {cafes.length > 1 && (
                <div className="w-full sm:w-48 h-11">
                  <PremiumSelect
                    icon={Store}
                    value={filters.cafeId}
                    onChange={(v) => setFilters((f) => ({ ...f, cafeId: v }))}
                    options={[{ label: 'All Cafes', value: 'all' }, ...cafes.map((c) => ({ label: c.name, value: c._id }))]}
                    className="h-full"
                  />
                </div>
              )}
              <div className="w-full sm:w-auto h-11">
                <UniversalDateFilter
                  onFilterChange={({ startDate, endDate }) => setFilters((f) => ({ ...f, startDate, endDate }))}
                  loading={refetching}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </SlideIn>

        {refetching ? (
          <div className="space-y-6">
            <StatGridSkeleton count={4} />
            <StatGridSkeleton count={6} />
          </div>
        ) : (
          <>
            {/* Primary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
              <Link href="/dashboard/admin/revenue" className="contents">
                <MetricCard title="Total Revenue" icon={<DollarSign className="text-primary" />} trend="+12.4%" sub="Total money collected"
                  value={<Money value={data?.totalRevenue || 0} animate />} />
              </Link>
              <Link href="/dashboard/admin/orders" className="contents">
                <MetricCard title="Today's Sales" icon={<Zap className="text-white" />} trend="+8.2%" sub={`${data?.todayOrders || 0} orders today`} highlight
                  value={<Money value={data?.todayRevenue || 0} animate />} />
              </Link>
              <Link href="/dashboard/admin/revenue" className="contents">
                <MetricCard title="Net Profit" icon={<BarChart3 className="text-success" />} trend="+5.1%" sub="Estimated earnings"
                  value={<Money value={data?.netProfit || 0} animate />} />
              </Link>
              <Link href="/dashboard/admin/orders/analytics" className="contents">
                <MetricCard title="Avg Order Value" icon={<Receipt className="text-primary" />} trend="Per order" sub={`Across ${data?.completedOrders || 0} orders`}
                  value={<Money value={data?.avgOrderValue || 0} animate decimals={0} />} />
              </Link>
            </div>

            {/* Secondary stat strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 relative z-10">
              <MiniStat icon={ShoppingBag} label="Total Orders" value={<Num value={data?.totalOrders || 0} animate />} href="/dashboard/admin/orders" />
              <MiniStat icon={Users} label="Customers" value={<Num value={data?.totalCustomers || 0} animate />} href="/dashboard/admin/customers" />
              <MiniStat icon={ChefHat} label="Staff & Chefs" value={<Num value={data?.totalStaff || 0} animate />} href="/dashboard/admin/staff" />
              <MiniStat icon={UtensilsCrossed} label="Menu Items" value={<Num value={data?.totalMenuItems || 0} animate />} href="/dashboard/admin/menu" />
              <MiniStat icon={Coins} label="Discounts" value={<Money value={data?.totalDiscount || 0} animate />} href="/dashboard/admin/coupons" />
              <MiniStat icon={Clock} label="Pending Pay" value={<Num value={data?.pendingApprovals || 0} animate />} tone={data?.pendingApprovals ? 'danger' : 'muted'} href="/dashboard/admin/orders" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">
              {/* Revenue Trend */}
              <div className="lg:col-span-2 bg-(--color-surface)/40 rounded-2xl border border-(--color-border) shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary)">
                      <TrendingUp size={20} className="text-primary" /> Revenue Trend
                    </h2>
                    <p className="text-(--color-text-muted) text-xs font-medium mt-1">Daily completed-order revenue.</p>
                  </div>
                </div>
                <div className="h-64">
                  {trend.length === 0 ? (
                    <EmptyState label="No revenue in this period" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend} margin={{ left: -8, right: 8, top: 4 }}>
                        <defs>
                          <linearGradient id="saRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                        <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--color-text-muted)" fontSize={10} width={64} tickLine={false} axisLine={false}
                          tickFormatter={(v) => formatIndianCompact(v, { currency: true })} />
                        <Tooltip
                          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', fontSize: '12px' }}
                          formatter={(v, n) => [formatIndianCompact(v, { currency: true }), n === 'revenue' ? 'Revenue' : n]}
                          labelFormatter={(l) => `Date: ${l}`} />
                        <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#saRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Payment Split */}
              <div className="bg-(--color-surface)/40 rounded-2xl border border-(--color-border) shadow-sm p-6">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary) mb-6">
                  <CreditCard size={20} className="text-primary" /> Payment Split
                </h2>
                {paymentData.length === 0 ? (
                  <EmptyState label="No payments yet" />
                ) : (
                  <>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentData} dataKey="total" nameKey="type" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="none">
                            {paymentData.map((p) => <Cell key={p.type} fill={PAY_COLORS[p.type] || '#71717a'} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', fontSize: '12px' }}
                            formatter={(v, n) => [formatIndianCompact(v, { currency: true }), n]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                      {paymentData.map((p) => (
                        <div key={p.type} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-(--color-text-secondary) font-medium">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAY_COLORS[p.type] || '#71717a' }} />
                            {p.type} <span className="text-(--color-text-muted) text-xs">· {p.count}</span>
                          </span>
                          <span className="font-semibold text-(--color-text-primary)"><Money value={p.total} /></span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Operations Console */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">
              {/* Branch Leaderboard */}
              <div className="lg:col-span-2 bg-(--color-surface)/40 rounded-2xl border border-(--color-border) overflow-hidden shadow-sm relative">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
                  <Terminal size={300} strokeWidth={1} />
                </div>
                <div className="p-6 flex items-center justify-between border-b border-(--color-border)">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary)">
                      <Map size={20} className="text-primary" /> Branch Performance
                    </h2>
                    <p className="text-(--color-text-muted) text-xs font-medium mt-2">Ranking branches by sales.</p>
                  </div>
                  <Link href="/dashboard/admin/locations">
                    <button className="px-2.5 py-1 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-[11px] font-medium uppercase tracking-wide text-(--color-text-secondary) hover:text-(--color-text-primary) hover:border-primary/30 transition-all">
                      View All
                    </button>
                  </Link>
                </div>
                <div className="p-5 overflow-x-auto custom-scrollbar">
                  {(!data?.branchRanking || data.branchRanking.length === 0) ? (
                    <EmptyState label="No branch sales yet" />
                  ) : (
                    <table className="w-full text-left border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-secondary)">
                          <th className="pb-3 px-5">Branch</th>
                          <th className="pb-3 px-5">Sales Share</th>
                          <th className="pb-3 px-5 text-center">Orders</th>
                          <th className="pb-3 px-5 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.branchRanking.map((branch, idx) => {
                          const share = data.totalRevenue ? (branch.revenue / data.totalRevenue) * 100 : 0;
                          return (
                            <motion.tr
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.08 }}
                              onClick={() => router.push('/dashboard/admin/locations')}
                              className="group bg-(--color-surface-soft)/50 hover:bg-(--color-surface-soft) transition-all cursor-pointer"
                            >
                              <td className="px-5 py-4 rounded-l-2xl border-l border-t border-b border-(--color-border)/50">
                                <div className="flex items-center gap-4">
                                  <span className={`h-10 w-10 rounded-xl flex items-center justify-center font-semibold text-sm ${idx === 0 ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted) border border-(--color-border)'}`}>
                                    0{idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm text-(--color-text-primary) tracking-tight truncate">{branch.name}</p>
                                    {branch.city && <p className="text-[11px] text-(--color-text-muted)">{branch.city}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 border-t border-b border-(--color-border)/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-28 h-1.5 bg-(--color-bg-soft) rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${share}%` }}
                                      className={`h-full ${idx === 0 ? 'bg-primary' : 'bg-(--color-text-muted)'}`} />
                                  </div>
                                  <span className="text-xs font-medium text-(--color-text-muted)">{share.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-center border-t border-b border-(--color-border)/50">
                                <span className="text-sm font-medium text-(--color-text-secondary)"><Num value={branch.orders || 0} /></span>
                              </td>
                              <td className="px-5 py-4 text-right rounded-r-2xl border-r border-t border-b border-(--color-border)/50">
                                <p className="text-base font-semibold text-(--color-text-primary) tracking-tight"><Money value={branch.revenue} /></p>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Top Performers */}
              <div className="space-y-5">
                <div className="bg-(--color-surface)/40 p-5 rounded-2xl border border-(--color-border) shadow-sm space-y-5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" /> Top Performers
                  </h2>
                  <Link href="/dashboard/admin/staff" className="contents">
                    <EntityItem icon={<ChefHat className="text-primary" />} label="Top Chef"
                      name={data?.topChefs?.[0]?.name || 'N/A'} stat={`${data?.topChefs?.[0]?.orderCount || 0} orders`} />
                  </Link>
                  <Link href="/dashboard/admin/staff" className="contents">
                    <EntityItem icon={<Users className="text-primary" />} label="Top Staff"
                      name={data?.topStaff?.[0]?.name || 'N/A'} stat={`${data?.topStaff?.[0]?.orderCount || 0} orders`} />
                  </Link>
                  <div className="h-px bg-(--color-border) mx-2" />
                  <Link href="/dashboard/admin/payment-intelligence" className="contents">
                    <EntityItem icon={<CreditCard className="text-success" />} label="Top UPI Branch"
                      name={data?.upiLeader?.branchName || 'N/A'}
                      stat={data?.upiLeader ? <Money value={data.upiLeader.total} /> : '—'} />
                  </Link>
                  <Link href="/dashboard/admin/coupons" className="contents">
                    <EntityItem icon={<Ticket className="text-primary" />} label="Top Coupon Branch"
                      name={data?.highestCouponBranch?.name || 'N/A'} stat={`${data?.highestCouponBranch?.count || 0} used`} />
                  </Link>
                </div>

                {/* Alerts */}
                <Link href="/dashboard/admin/audit-logs" className="block bg-(--color-surface)/40 p-5 rounded-2xl border border-(--color-border) shadow-sm hover:border-danger/30 transition-all group">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-2">
                      <AlertOctagon size={14} className="text-danger" /> Alerts
                    </h2>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${alertCount ? 'bg-danger/10 text-danger border-danger/30' : 'bg-success/10 text-success border-success/30'}`}>
                      {alertCount ? 'Needs attention' : 'All clear'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-3">
                      <p className="text-2xl font-semibold text-(--color-text-primary)"><Num value={data?.alerts?.lowStockItems || 0} /></p>
                      <p className="text-[11px] text-(--color-text-muted) font-medium mt-1">Out of stock</p>
                    </div>
                    <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-3">
                      <p className="text-2xl font-semibold text-(--color-text-primary)"><Num value={data?.alerts?.recentCancellations || 0} /></p>
                      <p className="text-[11px] text-(--color-text-muted) font-medium mt-1">Cancels (24h)</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Top Items + Orders by Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">
              <div className="lg:col-span-2 bg-(--color-surface)/40 rounded-2xl border border-(--color-border) shadow-sm p-6">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary) mb-5">
                  <UtensilsCrossed size={20} className="text-primary" /> Best-Selling Items
                </h2>
                {(!data?.topMenuItems || data.topMenuItems.length === 0) ? (
                  <EmptyState label="No item sales yet" />
                ) : (
                  <div className="space-y-3">
                    {data.topMenuItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-(--color-surface-soft)/50 hover:bg-(--color-surface-soft) transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">{idx + 1}</span>
                          <p className="text-sm font-medium text-(--color-text-primary) truncate">{item.name || 'Unnamed'}</p>
                        </div>
                        <div className="flex items-center gap-6 shrink-0">
                          <span className="text-xs font-medium text-(--color-text-muted)"><Num value={item.quantity} /> sold</span>
                          <span className="text-sm font-semibold text-(--color-text-primary) w-24 text-right"><Money value={item.revenue} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-(--color-surface)/40 rounded-2xl border border-(--color-border) shadow-sm p-6">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary) mb-5">
                  <ClipboardList size={20} className="text-primary" /> Orders by Status
                </h2>
                {(!data?.ordersByStatus || data.ordersByStatus.length === 0) ? (
                  <EmptyState label="No orders yet" />
                ) : (
                  <div className="space-y-2.5">
                    {data.ordersByStatus.map((s) => (
                      <div key={s.status} className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${STATUS_TONE[s.status] || 'text-(--color-text-secondary)'}`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                        <span className="font-semibold text-(--color-text-primary)"><Num value={s.count} /></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-(--color-surface)/40 rounded-2xl border border-(--color-border) shadow-sm p-6 relative z-10">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-2 mb-5">
                <Globe size={14} className="text-primary" /> Quick Access
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
                  <Link key={href} href={href}
                    className="group flex flex-col items-center gap-2.5 p-4 rounded-xl border border-(--color-border) bg-(--color-surface-soft)/40 hover:bg-(--color-surface-soft) hover:border-primary/30 transition-all">
                    <span className="h-10 w-10 rounded-xl bg-(--color-surface) border border-(--color-border) group-hover:border-primary/30 flex items-center justify-center text-(--color-text-muted) group-hover:text-primary transition-colors">
                      <Icon size={18} />
                    </span>
                    <span className="text-[11px] font-medium text-(--color-text-secondary) group-hover:text-(--color-text-primary) transition-colors">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}

function MetricCard({ title, value, icon, trend, sub, highlight, isRisk }) {
  return (
    <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${highlight
      ? 'bg-primary border-primary text-(--color-on-primary)'
      : 'bg-(--color-surface)/40 border-(--color-border) text-(--color-text-primary) shadow-sm hover:border-primary/30'}`}>
      {highlight && <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.2),transparent_50%)]" />}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className={`p-3 rounded-xl transition-colors ${highlight ? 'bg-white/20' : 'bg-(--color-surface-soft) border border-(--color-border)'}`}>{icon}</div>
        <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-normal px-2.5 py-1 rounded-full border ${isRisk ? 'bg-danger/10 text-danger border-danger/30' : (highlight ? 'bg-white/20 border-white/30 text-white' : 'bg-success/10 text-success border-success/30')}`}>
          {isRisk ? <ShieldAlert size={12} /> : <ArrowUpRight size={12} />}{trend}
        </div>
      </div>
      <p className={`text-[11px] font-medium uppercase tracking-normal mb-2 relative z-10 ${highlight ? 'text-(--color-on-primary)/70' : 'text-(--color-text-muted)'}`}>{title}</p>
      <h3 className="text-3xl font-semibold tracking-tight mb-1.5 relative z-10 leading-none">{value}</h3>
      <p className={`text-[11px] font-medium relative z-10 ${highlight ? 'text-(--color-on-primary)/60' : 'text-(--color-text-muted)'}`}>{sub}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, href, tone = 'default' }) {
  const body = (
    <div className="h-full flex items-center gap-3 p-4 rounded-2xl border border-(--color-border) bg-(--color-surface)/40 shadow-sm hover:border-primary/30 transition-all">
      <span className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border ${tone === 'danger' ? 'bg-danger/10 text-danger border-danger/30' : 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)'}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-(--color-text-primary) tracking-tight leading-none">{value}</p>
        <p className="text-[11px] font-medium text-(--color-text-muted) mt-1 truncate">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function EntityItem({ icon, label, name, stat }) {
  return (
    <div className="flex items-center justify-between gap-3 group cursor-pointer">
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-3 bg-(--color-surface-soft) rounded-xl group-hover:bg-(--color-surface) transition-all border border-(--color-border) group-hover:border-primary/30 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal mb-0.5">{label}</p>
          <p className="text-sm font-semibold text-(--color-text-primary) group-hover:text-primary transition-colors tracking-tight truncate">{name}</p>
        </div>
      </div>
      <div className="text-right shrink-0 text-xs font-medium text-(--color-text-muted) group-hover:text-(--color-text-primary) transition-colors">{stat}</div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="h-full min-h-32 flex flex-col items-center justify-center text-center gap-2 text-(--color-text-muted)">
      <Package size={22} className="opacity-40" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
