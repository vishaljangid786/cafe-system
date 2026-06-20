'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import {
  Crown, Map, TrendingUp, DollarSign,
  ArrowUpRight, ArrowDownRight, Users,
  ChefHat, Ticket, CreditCard, AlertOctagon,
  Radio, Cpu, Terminal, BarChart3, Globe, Zap, ShieldAlert, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import { DashboardSkeleton } from '@/app/components/ui/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchAdminSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/super-admin/executive-summary');
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to sync executive info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAdminSummary();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6 lg:p-12">
          <DashboardSkeleton />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen text-[var(--color-text-primary)] p-6 lg:p-12 space-y-16 overflow-hidden relative selection:bg-[var(--color-primary)] selection:text-white">

        {/* Atmospheric Smart Network */}
        {/* <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--color-primary)]/10 blur-[150px] rounded-full -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[var(--color-primary)]/5 blur-[150px] rounded-full -ml-64 -mb-64 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" /> */}

        {/* Global Control Header */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 relative z-10">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal rounded-full border border-[var(--color-primary)]/30 ">
                  <Cpu size={12} className="animate-pulse" /> Admin Dashboard
                </div>
                <div className="h-1 w-1 bg-[var(--color-border)] rounded-full" />
                <div className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-normal">Network Version 4.2.0</div>
              </div>
              <h1 className="text-8xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-6 italic leading-none">
                <Crown className="text-[var(--color-primary)] h-20 w-20 drop-" />
                COMMAND <span className="text-[var(--color-text-muted)]">CENTER</span>
              </h1>
              <div className="flex items-center gap-4 text-[var(--color-text-secondary)] font-bold italic text-sm">
                <Radio size={16} className="text-[var(--color-success)] animate-ping" />
                System Activity: <span className="text-[var(--color-text-primary)] uppercase tracking-normal">{data?.totalBranches} Branches Active</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 bg-[var(--color-surface)]/40  p-10 rounded-xl border border-[var(--color-border)] shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative z-10">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 flex items-center gap-2">
                  <Globe size={10} /> Active Branches
                </p>
                <p className="text-5xl font-bold text-[var(--color-text-primary)] tracking-tight italic">{data?.totalBranches}</p>
              </div>
              <div className="relative z-10 text-right">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 flex items-center justify-end gap-2">
                  <Zap size={10} /> System Health
                </p>
                <p className="text-5xl font-bold text-[var(--color-success)] tracking-tight italic">99.8%</p>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Smart Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          <Link href="/dashboard/admin/revenue" className="contents">
            <MetricCard
              title="Total Revenue"
              value={`₹${(data?.totalRevenue / 100000).toFixed(1)}L`}
              icon={<DollarSign className="text-[var(--color-primary)]" />}
              trend="+12.4%"
              sub="Total money collected"
            />
          </Link>
          <Link href="/dashboard/admin/orders" className="contents">
            <MetricCard
              title="Today's Sales"
              value={`₹${data?.todayRevenue?.toLocaleString()}`}
              icon={<Zap className="text-[var(--color-primary)]" />}
              trend="+8.2%"
              sub="Current sales stream"
              highlight
            />
          </Link>
          <Link href="/dashboard/admin/revenue" className="contents">
            <MetricCard
              title="Total Profit"
              value={`₹${(data?.netProfit / 100000).toFixed(1)}L`}
              icon={<BarChart3 className="text-[var(--color-success)]" />}
              trend="+5.1%"
              sub="Final earnings"
            />
          </Link>
          <Link href="/dashboard/admin/audit-logs" className="contents">
            <MetricCard
              title="System Alerts"
              value={data?.alerts?.lowStockItems + data?.alerts?.recentCancellations}
              icon={<AlertOctagon className="text-[var(--color-danger)]" />}
              trend="NEEDS ATTENTION"
              sub="Problems found"
              isRisk={true}
            />
          </Link>
        </div>

        {/* Global Operations Console */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">

          {/* Branch Leaderboard */}
          <div className="lg:col-span-2 bg-[var(--color-surface)]/40  rounded-[4rem] border border-[var(--color-border)] overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
              <Terminal size={300} strokeWidth={1} />
            </div>
            <div className="p-12 flex items-center justify-between border-b border-[var(--color-border)]">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-normal flex items-center gap-4 italic text-[var(--color-text-primary)]">
                  <Map className="text-[var(--color-primary)]" /> Branch Performance
                </h2>
                <p className="text-[var(--color-text-muted)] text-xs font-bold mt-2 italic">Ranking branches by sales and performance.</p>
              </div>
              <Link href="/dashboard/admin/locations">
                <button className="px-6 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary)]/30 transition-all">
                  View All
                </button>
              </Link>
            </div>
            <div className="p-8 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-4">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-secondary)] px-6">
                    <th className="pb-6 px-6">Branch Name</th>
                    <th className="pb-6 px-6">Sales Level</th>
                    <th className="pb-6 px-6 text-center">Sales Share</th>
                    <th className="pb-6 px-6 text-right">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="space-y-4">
                  {data?.branchRanking?.map((branch, idx) => (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => router.push('/dashboard/admin/locations')}
                      className="group bg-[var(--color-surface-soft)]/50 hover:bg-[var(--color-surface-soft)] transition-all cursor-pointer rounded-xl"
                    >
                      <td className="p-8 rounded-l-[2rem] border-l border-t border-b border-[var(--color-border)]/50">
                        <div className="flex items-center gap-6">
                          <span className={`h-14 w-14 rounded-xl flex items-center justify-center font-bold italic text-xl shadow-sm transition-transform group- ${idx === 0 ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]  rotate-3' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                            }`}>
                            0{idx + 1}
                          </span>
                          <p className="font-bold text-lg text-[var(--color-text-primary)] italic tracking-tight">{branch.name}</p>
                        </div>
                      </td>
                      <td className="p-8 border-t border-b border-[var(--color-border)]/50">
                        <div className="w-40 h-1.5 bg-[var(--color-bg-soft)] rounded-full overflow-hidden shadow-inner">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(branch.revenue / data.totalRevenue) * 100}%` }}
                            className={`h-full  ${idx === 0 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-muted)]'}`}
                          />
                        </div>
                      </td>
                      <td className="p-8 text-center border-t border-b border-[var(--color-border)]/50">
                        <span className="text-sm font-bold text-[var(--color-text-muted)] italic tracking-normal">
                          {((branch.revenue / data.totalRevenue) * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-8 text-right rounded-r-[2rem] border-r border-t border-b border-[var(--color-border)]/50">
                        <p className="text-xl font-bold text-[var(--color-text-primary)] italic tracking-tight">₹{branch.revenue?.toLocaleString()}</p>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Special Information Widgets */}
          <div className="space-y-8">
            {/* Elite Entities */}
            <div className="bg-[var(--color-surface)]/40  p-10 rounded-[4rem] border border-[var(--color-border)] shadow-sm space-y-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-[var(--color-secondary)]/5 hidden rounded-full -mr-20 -mt-20" />
              <h2 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] " />
                Top Performers
              </h2>

              <Link href="/dashboard/admin/staff" className="contents">
                <EntityItem
                  icon={<ChefHat className="text-[var(--color-primary)]" />}
                  label="Top Chef"
                  name={data?.topChefs?.[0]?.name || 'N/A'}
                  stat={`${data?.topChefs?.[0]?.orderCount || 0} Orders Done`}
                />
              </Link>
              <Link href="/dashboard/admin/staff" className="contents">
                <EntityItem
                  icon={<Users className="text-[var(--color-primary)]" />}
                  label="Top Staff"
                  name={data?.topStaff?.[0]?.name || 'N/A'}
                  stat={`${data?.topStaff?.[0]?.orderCount || 0} Orders Served`}
                />
              </Link>
              <div className="h-[1px] bg-[var(--color-border)] mx-2" />
              <Link href="/dashboard/admin/locations" className="contents">
                <EntityItem
                  icon={<CreditCard className="text-[var(--color-success)]" />}
                  label="Top UPI Branch"
                  name={data?.upiLeader?.branchName || 'N/A'}
                  stat={`₹${data?.upiLeader?.total?.toLocaleString()}`}
                />
              </Link>
              <Link href="/dashboard/admin/coupons" className="contents">
                <EntityItem
                  icon={<Ticket className="text-[var(--color-primary)]" />}
                  label="Coupon Usage"
                  name={data?.highestCouponBranch?.name || 'N/A'}
                  stat={`${data?.highestCouponBranch?.count || 0} Times Used`}
                />
              </Link>
            </div>

            {/* Smart Update Card */}
            <Link href="/dashboard/admin/revenue" className="relative group cursor-pointer overflow-hidden rounded-[4rem] shadow-sm block">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 10 }}
                className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)] opacity-90 group-hover:opacity-100 transition-opacity duration-700"
              />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/60-lines.png')] opacity-20" />
              <div className="relative p-12 text-white space-y-6">
                <p className="text-[10px] font-bold uppercase tracking-normal text-white/60">System Update</p>
                <h3 className="text-3xl font-bold italic tracking-tight leading-tight">Total sales is 18% more than last week.</h3>
                <div className="flex items-center gap-3 text-xs font-bold bg-[var(--color-bg-base)]/50 w-fit px-6 py-3 rounded-xl  border border-[var(--color-border)] group-hover:bg-[var(--color-primary-hover)]/20 transition-all uppercase tracking-normal italic">
                  View Details <ChevronRight size={16} />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function MetricCard({ title, value, icon, trend, sub, highlight, isRisk }) {
  return (
    <div className={`p-10 rounded-[4rem] border transition-all duration-700  relative overflow-hidden group ${highlight
        ? 'bg-[var(--color-primary)] border-[var(--color-primary)]  text-[var(--color-on-primary)]'
        : 'bg-[var(--color-surface)]/40  border-[var(--color-border)] text-[var(--color-text-primary)] shadow-sm hover:border-[var(--color-primary)]/30'
      }`}>
      {highlight && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.2),transparent_50%)]" />
      )}
      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className={`p-5 rounded-xl transition-transform duration-700 group-hover:rotate-12 ${highlight ? 'bg-white/20' : 'bg-[var(--color-surface-soft)] border border-[var(--color-border)]'}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full  border ${isRisk ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)] border-[var(--color-danger)]/30' : (highlight ? 'bg-white/20 border-[var(--color-border)] text-white' : 'bg-[var(--color-success)]/20 text-[var(--color-success)] border-[var(--color-success)]/30')
          }`}>
          {isRisk ? <ShieldAlert size={12} /> : <ArrowUpRight size={12} />}
          {trend}
        </div>
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-normal mb-3 relative z-10 ${highlight ? 'text-[var(--color-on-primary)]/70' : 'text-[var(--color-text-muted)]'}`}>{title}</p>
      <h3 className="text-5xl font-bold italic tracking-tight mb-4 relative z-10 leading-none">{value}</h3>
      <p className={`text-[10px] font-bold italic relative z-10 ${highlight ? 'text-[var(--color-on-primary)]/60' : 'text-[var(--color-text-muted)]'}`}>{sub}</p>
    </div>
  );
}

function EntityItem({ icon, label, name, stat }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-6">
        <div className="p-4 bg-[var(--color-surface-soft)] rounded-xl group-hover:bg-[var(--color-surface)] transition-all border border-[var(--color-border)] group-hover:border-[var(--color-primary)]/30 group-">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-1">{label}</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors italic tracking-tight">{name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors italic">{stat}</p>
      </div>
    </div>
  );
}
