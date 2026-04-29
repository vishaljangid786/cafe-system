'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  TrendingUp, CreditCard, ShoppingBag, Award, Zap,
  Filter, Calendar, Building, DollarSign, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colorMap = {
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-6 border border-zinc-200/50 dark:border-zinc-800/50 flex items-center gap-5 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${colorMap[color] || 'text-zinc-500 bg-zinc-500/10'}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">{label}</p>
        {sub && <p className="text-[9px] font-bold text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function PaymentIntelligencePage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date: '',
    period: '',
    startDate: '',
    endDate: '',
    financialYear: ''
  });

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.period) params.period = filters.period;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.financialYear) params.financialYear = filters.financialYear;

      const res = await api.get('/analytics/payment-intelligence', { params });
      setStats(res.data.data);
    } catch (error) {
      toast.error('Failed to load payment intelligence metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
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

  return (
    <div className="max-w-[1600px] mx-auto pb-20 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <CreditCard size={24} className="text-white" />
          </div>
          Payment Intelligence Dashboard
        </h1>
        <p className="text-xs text-zinc-500 mt-1 font-medium ml-13">Analyze Cash vs UPI metrics effortlessly.</p>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <Filter size={16} className="text-violet-500" />
          <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Payment Analytics Filters</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Exact Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-violet-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Time Period
            </label>
            <select
              value={filters.period}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-violet-500 focus:outline-none transition-all"
            >
              <option value="">Select Period</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="year">Past Year</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Financial Year
            </label>
            <select
              value={filters.financialYear}
              onChange={(e) => handleFilterChange('financialYear', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-violet-500 focus:outline-none transition-all"
            >
              <option value="">Select FY</option>
              <option value="2024">FY 2024-25</option>
              <option value="2025">FY 2025-26</option>
              <option value="2026">FY 2026-27</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Custom Start
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-violet-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Custom End
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-violet-500 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />)}
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
            <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 p-6 rounded-3xl text-white flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 flex items-center gap-1"><Award size={14} /> Peak digital hub</span>
                <p className="text-2xl font-black mt-1">{stats.highestUPIBranch.name}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">UPI Quota</span>
                <p className="text-2xl font-black mt-1">₹{stats.highestUPIBranch.revenue}</p>
              </div>
            </div>
          )}

          {/* Charts & Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Trend Graph */}
            <div className="lg:col-span-12 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-violet-500" /> Payment Trend Timeline (₹)
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
            <div className="lg:col-span-12 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
                <BarChart2 size={16} className="text-violet-500" /> Sector Allocation by payment mode (₹)
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
