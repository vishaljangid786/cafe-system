"use client"

import { 
  Coffee, Clock, ArrowRight, UserCircle, 
  TrendingUp, ShoppingBag, Zap, Wallet, 
  Calendar, CheckCircle2, XCircle, Activity,
  ArrowUpRight, IndianRupee, History, Filter
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import api from '@/app/services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar,
  Cell
} from 'recharts';
import toast from 'react-hot-toast';

function Skeleton({ className }) {
  return (
    <div className={`animate-pulse bg-(--color-surface-soft) rounded-xl ${className}`} />
  );
}

function MetricCard({ label, value, icon: Icon, color, sub, loading }) {
  if (loading) {
    return (
      <div className="bg-(--color-surface) p-6 rounded-xl border border-(--color-border) h-full space-y-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  const colors = {
    blue: 'bg-primary/10 text-primary border-primary/20',
    emerald: 'bg-success/10 text-success border-success/20',
    amber: 'bg-warning/10 text-warning border-warning/20',
    rose: 'bg-danger/10 text-danger border-danger/20',
    violet: 'bg-primary/10 text-primary border-primary/20'
  };

  return (
    <CardHover>
      <div className="bg-(--color-surface) p-6 rounded-xl border border-(--color-border) shadow-sm h-full flex flex-col group">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center border mb-4 transition-transform duration-500 ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">{label}</p>
        <p className="text-2xl font-bold text-(--color-text-primary) tracking-tight">{value}</p>
        {sub && <p className="text-[9px] font-bold text-(--color-text-secondary) mt-2">{sub}</p>}
      </div>
    </CardHover>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10 pb-20">
      {/* Header Skeleton */}
      <div className="bg-(--color-surface) rounded-xl p-10 border border-(--color-border) flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-8">
          <Skeleton className="h-12 w-48 rounded-xl" />
          <div className="flex gap-6">
            <Skeleton className="h-12 w-24 rounded-lg" />
            <Skeleton className="h-12 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <MetricCard key={i} loading={true} />)}
      </div>

      {/* Charts & Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) h-100">
             <Skeleton className="h-6 w-48 mb-8" />
             <Skeleton className="h-70 w-full" />
          </div>
          <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) h-75">
             <Skeleton className="h-6 w-48 mb-8" />
             <Skeleton className="h-45 w-full" />
          </div>
        </div>
        <div className="lg:col-span-4 space-y-10">
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) h-100">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-5">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between items-center">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState('month');

  useEffect(() => {
    setMounted(true);
  }, []);

  const getTimeframeDates = useCallback((tf) => {
    const end = new Date();
    const start = new Date();
    if (tf === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (tf === 'month') {
      start.setDate(1);
    } else if (tf === 'year') {
      start.setMonth(0, 1);
    } else if (tf === 'all') {
      start.setFullYear(2020, 0, 1); // Practically all time for a new system
    }
    return { 
      startDate: start.toISOString().split('T')[0], 
      endDate: end.toISOString().split('T')[0] 
    };
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const role = user?.role;
      const statsEndpoint = role === 'chef' ? '/orders/my-stats-chef' : '/orders/my-stats-staff';
      const { startDate, endDate } = getTimeframeDates(timeframe);
      
      const [statsRes, expenseRes, attendanceRes] = await Promise.all([
        api.get(statsEndpoint, { params: { startDate, endDate } }),
        api.get('/transactions', { params: { limit: 5, type: 'EXPENSE', startDate, endDate } }),
        api.get('/attendance/my', { params: { limit: timeframe === 'all' ? 1000 : timeframe === 'year' ? 365 : 31 } })
      ]);

      setStats(statsRes.data.data);
      setExpenses(expenseRes.data.data || []);
      setAttendance(attendanceRes.data.data || []);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      toast.error('Could not load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, timeframe, getTimeframeDates]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const attendanceChartData = attendance.slice(0, timeframe === 'all' ? 30 : 14).reverse().map(a => ({
    date: new Date(a.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    status: a.status === 'present' ? 1 : a.status === 'half-day' ? 0.5 : 0,
    statusLabel: a.status
  }));

  const orderTrendData = stats?.ordersByDate || [];

  if (!mounted || (loading && !stats)) {
    return <DashboardSkeleton />;
  }

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <div className="relative group overflow-hidden bg-(--color-surface) rounded-xl p-10 border border-(--color-border) shadow-sm ">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Activity size={200} className="text-primary" strokeWidth={1} />
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg ">
                  <Coffee size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-(--color-text-primary) leading-none">
                    Hi, <span className="text-primary">{mounted ? user?.name?.split(' ')[0] : ''}</span>
                  </h1>
                  <p className="text-(--color-text-muted) font-bold mt-2 flex items-center gap-2">
                    <Zap size={14} className="text-warning" />
                    {mounted ? user?.role?.replace('_', ' ').toUpperCase() : ''} @ {mounted ? user?.assignedLocation?.name : ''} Branch
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
              {/* Timeframe Filter */}
              <div className="bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border) flex items-center gap-1">
                {[
                  { id: '7d', label: '7D' },
                  { id: 'month', label: 'Month' },
                  { id: 'year', label: 'Year' },
                  { id: 'all', label: 'All' }
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeframe(tf.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all ${
                      timeframe === tf.id 
                        ? 'bg-primary text-white shadow-lg ' 
                        : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Payout ({timeframe})</p>
                  <p className="text-2xl font-bold text-success tracking-tight">₹{stats?.dailyPayout || 0}</p>
                </div>
                <div className="h-12 w-px bg-(--color-border)" />
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Success Rate</p>
                  <p className="text-2xl font-bold text-primary tracking-tight">{stats?.successRate || 0}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            label="Total Orders"
            value={stats?.totalOrders || 0}
            icon={ShoppingBag}
            color="blue"
            sub={`All-time total`}
          />
          <MetricCard
            label="Total Sales"
            value={`₹${stats?.totalSales || 0}`}
            icon={IndianRupee}
            color="emerald"
            sub="Sales you brought in"
          />
          <MetricCard
            label="Present Days"
            value={attendance.filter(a => a.status === 'present').length}
            icon={CheckCircle2}
            color="amber"
            sub={`Total days present`}
          />
          <MetricCard
            label="Expenses"
            value={expenses.length}
            icon={Wallet}
            color="violet"
            sub="Entries you added"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            {/* Order Trend Chart */}
            <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-3">
                    <TrendingUp size={16} className="text-primary" /> Order Trend
                  </h3>
                </div>
                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-bold uppercase tracking-normal">
                  {timeframe === 'all' ? 'ALL TIME' : timeframe.toUpperCase()} VIEW
                </div>
              </div>
              <div className="h-75">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={orderTrendData}>
                    <defs>
                      <linearGradient id="colorOrder" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }}
                      itemStyle={{ color: '#3b82f6' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fill="url(#colorOrder)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Attendance Visualization */}
            <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-8 flex items-center gap-3">
                <Calendar size={16} className="text-warning" /> Attendance ({timeframe})
              </h3>
              <div className="h-50">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={10} axisLine={false} tickLine={false} hide />
                    <Tooltip 
                      cursor={{fill: '#27272a10'}}
                      contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="status" radius={[6, 6, 6, 6]}>
                      {attendanceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.status === 1 ? '#10b981' : entry.status === 0.5 ? '#f59e0b' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-10">
            {/* Quick Actions */}
            <div className="space-y-4">
              <Link href="/dashboard/staff/tables" className="block">
                <div className="bg-primary hover:bg-primary p-6 rounded-xl text-white shadow-lg  transition-all active:scale-95 group">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-normal opacity-80 mb-1">Tables</p>
                      <h4 className="text-xl font-bold tracking-tight">Active Orders</h4>
                    </div>
                    <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </Link>
              <Link href="/dashboard/staff/expenses" className="block">
                <div className="bg-(--color-surface) hover:bg-(--color-surface-soft) p-6 rounded-xl border border-(--color-border) shadow-sm transition-all active:scale-95 group text-left">
                  <div className="flex justify-between items-center text-left">
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Expenses</p>
                      <h4 className="text-xl font-bold tracking-tight text-(--color-text-primary)">Add Expense</h4>
                    </div>
                    <ArrowUpRight className="text-primary group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>

            {/* Recent Expenses List */}
            <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-3">
                  <History size={16} className="text-primary" /> Recent Expenses
                </h3>
              </div>
              <div className="space-y-5">
                {expenses.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-(--color-border) rounded-xl">
                    <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">No recent expenses</p>
                  </div>
                ) : (
                  expenses.map((ex) => (
                    <div key={ex._id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                          <IndianRupee size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-(--color-text-primary) tracking-tight line-clamp-1">{ex.title}</p>
                          <p className="text-[9px] font-bold text-(--color-text-muted)">{new Date(ex.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-(--color-text-primary)">₹{ex.totalAmount}</p>
                    </div>
                  ))
                )}
                <Link href="/dashboard/staff/expenses" className="block text-center pt-4 text-[10px] font-bold uppercase tracking-normal text-primary hover:underline">
                  View All Expenses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
