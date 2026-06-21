'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { StatGridSkeleton, ChartSkeleton } from '@/app/components/ui/Skeleton';
import {
  TrendingUp, CreditCard, ShoppingBag, Award, Zap,
  Filter, Calendar, Building, DollarSign, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PremiumSelect from '@/app/components/ui/PremiumSelect';

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colorMap = {
    amber: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20',
    blue: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20',
    emerald: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20',
    rose: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20',
    violet: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20',
  };

  return (
    <div className="bg-[var(--color-surface)]/80  rounded-xl p-6 border border-[var(--color-border)] flex items-center gap-5 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${colorMap[color] || 'text-[var(--color-text-muted)] bg-[var(--color-surface-soft)]'}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-2">{label}</p>
        {sub && <p className="text-[9px] font-bold text-[var(--color-text-secondary)] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function PaymentInformationPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    date: '',
    period: '',
    startDate: '',
    endDate: '',
    financialYear: '',
    branchId: 'all'
  });

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data || []);
    } catch (err) {
      console.error('Failed to load branches');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
      if (filters.branchId && filters.branchId !== 'all') params.branchId = filters.branchId;

      const res = await api.get('/analytics/payment-intelligence', { params });
      setStats(res.data.data);
    } catch (error) {
      toast.error('Failed to load payment info metrics');
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
  }, [filters]);

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

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <div className="max-w-[1600px] mx-auto pb-20 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg ">
            <CreditCard size={24} className="text-white" />
          </div>
          Payment Information Dashboard
        </h1>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 font-medium ml-13">Analyze Cash vs UPI metrics effortlessly.</p>
      </div>

      {/* Advanced Filters */}
      <div className="bg-[var(--color-surface)]/80  p-8 rounded-xl border border-[var(--color-border)] shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
          <Filter size={16} className="text-[var(--color-primary)]" />
          <span className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-secondary)]">Payment Analytics Filters</span>
        </div>
        
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Building size={12} /> Branch Center
            </label>
            <PremiumSelect
              value={filters.branchId}
              onChange={(val) => handleFilterChange('branchId', val)}
              options={[
                { label: 'Global Network', value: 'all' },
                ...locations.map(loc => ({ label: loc.name, value: loc._id }))
              ]}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Exact Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs font-bold focus:border-[var(--color-primary)] focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Time Period
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

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Financial Year
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

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Custom Range
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-1/2 px-3 py-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[10px] font-bold focus:border-[var(--color-primary)] focus:outline-none transition-all"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-1/2 px-3 py-3 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[10px] font-bold focus:border-[var(--color-primary)] focus:outline-none transition-all"
              />
            </div>
          </div>
      </div>

      {refetching ? (
        <div className="space-y-10">
          <StatGridSkeleton count={4} />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Total UPI Orders" value={stats?.totalUPIOrders || 0} sub="Successful direct transfers" icon={ShoppingBag} color="violet" />
            <MetricCard label="Total Cash Orders" value={stats?.totalCashOrders || 0} sub="Successful physical transactions" icon={ShoppingBag} color="amber" />
            <MetricCard label="UPI Revenue" value={`₹${stats?.upiRevenue || 0}`} sub="Direct digital quota" icon={Zap} color="violet" />
            <MetricCard label="Cash Revenue" value={`₹${stats?.cashRevenue || 0}`} sub="Direct physical quota" icon={DollarSign} color="amber" />
          </div>

          {stats?.highestUPIBranch && (
            <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)] p-6 rounded-xl text-white flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-normal opacity-80 flex items-center gap-1"><Award size={14} /> Peak digital hub</span>
                <p className="text-2xl font-bold mt-1">{stats.highestUPIBranch.name}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-normal opacity-80">UPI Quota</span>
                <p className="text-2xl font-bold mt-1">₹{stats.highestUPIBranch.revenue}</p>
              </div>
            </div>
          )}

          {/* Charts & Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Trend Graph */}
            <div className="lg:col-span-12 bg-[var(--color-surface)]/80  rounded-xl border border-[var(--color-border)] p-8">
              <h3 className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-[var(--color-primary)]" /> Payment Trend Timeline (₹)
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
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="upi" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorUpi)" name="UPI" />
                    <Area type="monotone" dataKey="cash" stroke="#f59e0b" strokeWidth={2.5} fill="url(#colorCash)" name="Cash" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Branch Wise Mode Comparison */}
            <div className="lg:col-span-12 bg-[var(--color-surface)]/80  rounded-xl border border-[var(--color-border)] p-8">
              <h3 className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-3">
                <BarChart2 size={16} className="text-[var(--color-primary)]" /> Allocation by payment mode (₹)
              </h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.branchUPIStats || []} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="branchName" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
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
