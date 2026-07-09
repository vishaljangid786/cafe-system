'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { StatGridSkeleton, ChartSkeleton } from '@/app/components/ui/Skeleton';
import {
  TrendingUp, CreditCard, ShoppingBag, Award, Zap,
  Filter, Calendar, DollarSign, BarChart2,
  Clock, CalendarRange, CalendarClock, RotateCcw
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Money, Num } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';
import useBranchScope from '../../../hooks/useBranchScope';

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colorMap = {
    amber: 'text-primary bg-primary/10 border-primary/20',
    blue: 'text-primary bg-primary/10 border-primary/20',
    emerald: 'text-success bg-success/10 border-success/20',
    rose: 'text-danger bg-danger/10 border-danger/20',
    violet: 'text-primary bg-primary/10 border-primary/20',
  };

  return (
    <div className="bg-(--color-surface)/80  rounded-xl p-5 border border-(--color-border) flex items-center gap-4 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`h-6 w-6 rounded-xl flex items-center justify-center border ${colorMap[color] || 'text-(--color-text-muted) bg-(--color-surface-soft)'}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-(--color-text-primary) tracking-tight leading-none">{value}</p>
        <p className="text-[11px] font-medium text-(--color-text-muted) mt-2">{label}</p>
        {sub && <p className="text-[11px] font-medium text-(--color-text-secondary) mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function PaymentInformationPage() {
  const { singleBranchId } = useBranchScope();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [filters, setFilters] = useState({
    date: '',
    period: '',
    startDate: '',
    endDate: '',
    financialYear: ''
  });

  const fetchStats = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true); else setRefetching(true);
    progress.start();
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.period) params.period = filters.period;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.financialYear) params.financialYear = filters.financialYear;
      if (singleBranchId !== 'all') params.branchId = singleBranchId;

      const res = await api.get('/analytics/payment-intelligence', { params });
      setStats(res.data.data);
    } catch (error) {
      console.error('Could not load payment details. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 0);
    return () => clearTimeout(timer);
  }, [filters, singleBranchId]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      // Clear conflicting date criteria
      if (key === 'date') { updated.period = ''; updated.startDate = ''; updated.endDate = ''; updated.financialYear = ''; }
      if (key === 'period') { updated.date = ''; updated.startDate = ''; updated.endDate = ''; updated.financialYear = ''; }
      if (key === 'financialYear') { updated.date = ''; updated.period = ''; updated.startDate = ''; updated.endDate = ''; }
      if (key === 'startDate' || key === 'endDate') { updated.date = ''; updated.period = ''; updated.financialYear = ''; }
      return updated;
    });
  };

  const resetFilters = () => setFilters({ date: '', period: '', startDate: '', endDate: '', financialYear: '' });

  if (loading) return <LoadingScreen fullScreen={false} />;

  const activeDate = !!filters.date;
  const activePeriod = !!filters.period;
  const activeFY = !!filters.financialYear;
  const activeRange = !!(filters.startDate || filters.endDate);
  const anyActive = activeDate || activePeriod || activeFY || activeRange;

  const cardCls = (active) =>
    `rounded-xl border p-4 space-y-2.5 transition-all ${
      active
        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/25'
        : 'border-(--color-border) bg-(--color-surface-soft)/40 hover:border-(--color-border-strong)'
    }`;
  const labelCls = (active) =>
    `text-[11px] font-medium uppercase tracking-normal flex items-center gap-1.5 ${
      active ? 'text-primary' : 'text-(--color-text-muted)'
    }`;
  const dateInputCls =
    'w-full min-w-0 px-3.5 py-2.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-(--color-text-primary) text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-colors';

  return (
    <div className="max-w-400 mx-auto pb-10 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight flex items-center gap-3">
          <div className="h-6 w-6 rounded-xl bg-primary flex items-center justify-center ">
            <CreditCard size={24} className="text-white" />
          </div>
          Payment Information Dashboard
        </h1>
        <p className="text-xs text-(--color-text-secondary) mt-1 font-medium ml-13">Compare Cash and UPI payments easily.</p>
      </div>

      {/* Advanced Filters */}
      <div className="bg-(--color-surface)/80 p-5 sm:p-6 rounded-xl border border-(--color-border) shadow-sm space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-(--color-border)">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Filter size={15} className="text-primary" />
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-normal text-(--color-text-secondary)">Payment Filters</span>
              <span className="block text-[10px] font-medium text-(--color-text-muted)">Pick one filter — choosing another clears the rest.</span>
            </div>
            {anyActive && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-normal">Active</span>
            )}
          </div>
          {anyActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-(--color-text-muted) hover:text-danger hover:bg-danger/5 border border-transparent hover:border-danger/20 transition-all"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Exact Date */}
          <div className={cardCls(activeDate)}>
            <label className={labelCls(activeDate)}>
              <Calendar size={13} /> Exact Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className={dateInputCls}
            />
          </div>

          {/* Time Period */}
          <div className={cardCls(activePeriod)}>
            <label className={labelCls(activePeriod)}>
              <Clock size={13} /> Time Period
            </label>
            <PremiumSelect
              value={filters.period}
              onChange={(val) => handleFilterChange('period', val)}
              options={[
                { label: 'Select Period', value: '' },
                { label: 'Today', value: '1' },
                { label: 'Past Week', value: 'week' },
                { label: 'Past Month', value: 'month' },
                { label: 'Past Year', value: 'year' }
              ]}
              className="w-full"
            />
          </div>

          {/* Financial Year */}
          <div className={cardCls(activeFY)}>
            <label className={labelCls(activeFY)}>
              <CalendarClock size={13} /> Financial Year
            </label>
            <PremiumSelect
              value={filters.financialYear}
              onChange={(val) => handleFilterChange('financialYear', val)}
              options={[
                { label: 'Select FY', value: '' },
                { label: 'FY 2024-25', value: '2024' },
                { label: 'FY 2025-26', value: '2025' },
                { label: 'FY 2026-27', value: '2026' }
              ]}
              className="w-full"
            />
          </div>

          {/* Custom Range */}
          <div className={`${cardCls(activeRange)} sm:col-span-2 lg:col-span-2`}>
            <label className={labelCls(activeRange)}>
              <CalendarRange size={13} /> Custom Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                aria-label="From date"
                className={dateInputCls}
              />
              <span className="text-[11px] font-medium text-(--color-text-muted) shrink-0">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                aria-label="To date"
                className={dateInputCls}
              />
            </div>
          </div>
        </div>
      </div>

      {refetching ? (
        <div className="space-y-6">
          <StatGridSkeleton count={4} />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard label="Total UPI Orders" value={<Num value={stats?.totalUPIOrders || 0} />} sub="Paid by UPI" icon={ShoppingBag} color="violet" />
            <MetricCard label="Total Cash Orders" value={<Num value={stats?.totalCashOrders || 0} />} sub="Paid by cash" icon={ShoppingBag} color="amber" />
            <MetricCard label="UPI Revenue" value={<Money value={stats?.upiRevenue || 0} />} sub="Total from UPI payments" icon={Zap} color="violet" />
            <MetricCard label="Cash Revenue" value={<Money value={stats?.cashRevenue || 0} />} sub="Total from cash payments" icon={DollarSign} color="amber" />
          </div>

          {stats?.highestUPIBranch && (
            <div className="bg-gradient-to-r from-primary to-primary p-5 rounded-xl text-white flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-normal opacity-80 flex items-center gap-1"><Award size={14} /> Top UPI Branch</span>
                <p className="text-2xl font-semibold mt-1">{stats.highestUPIBranch.name}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium uppercase tracking-normal opacity-80">UPI Revenue</span>
                <p className="text-2xl font-semibold mt-1"><Money value={stats.highestUPIBranch.revenue} /></p>
              </div>
            </div>
          )}

          {/* Charts & Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Trend Graph */}
            <div className="lg:col-span-12 bg-(--color-surface)/80  rounded-xl border border-(--color-border) p-6">
              <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-primary" /> Payment Trend Over Time (₹)
              </h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trendGraph || []} margin={{ left: -10, right: 10 }}>
                    <defs>
                      <linearGradient id="colorUpi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} width={70} tickFormatter={(v) => formatIndianCompact(v, { currency: true })} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} formatter={(v) => formatIndianCompact(v, { currency: true })} />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="upi" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorUpi)" name="UPI" />
                    <Area type="monotone" dataKey="cash" stroke="#f59e0b" strokeWidth={2.5} fill="url(#colorCash)" name="Cash" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Branch Wise Mode Comparison */}
            <div className="lg:col-span-12 bg-(--color-surface)/80  rounded-xl border border-(--color-border) p-6">
              <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                <BarChart2 size={16} className="text-primary" /> Branch-wise Payment Split (₹)
              </h3>
              <div className="h-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.branchUPIStats || []} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="branchName" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} width={70} tickFormatter={(v) => formatIndianCompact(v, { currency: true })} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} formatter={(v) => formatIndianCompact(v, { currency: true })} />
                    <Legend iconType="circle" />
                    <Bar dataKey="upiRevenue" fill="#8b5cf6" name="UPI Revenue (₹)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="cashRevenue" fill="#f59e0b" name="Cash Revenue (₹)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
