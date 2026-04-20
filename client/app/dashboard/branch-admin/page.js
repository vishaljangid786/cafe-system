'use client';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, TrendingDown, Users, Wallet, Zap } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../components/ui/AnimatedContainer';

export default function BranchAdminDashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/analytics/branch');
        setAnalytics(res.data.data);
      } catch (error) {
        console.error("Failed to fetch branch analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 bg-gray-200 dark:bg-zinc-800 rounded-xl w-64"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-zinc-800 rounded-3xl"></div>)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight leading-none">
                Branch <span className="text-amber-600">Overview</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm font-medium mt-2 uppercase tracking-widest text-[10px]">
                {user?.branchName || 'Local Branch'} Manager Portal
              </p>
            </div>
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-full text-xs font-black uppercase tracking-widest border border-amber-100 dark:border-amber-500/20">
              {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </SlideIn>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <CardHover>
              <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm p-8 border border-gray-100 dark:border-zinc-800 h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingUp size={100} />
                </div>
                <div className="rounded-2xl bg-green-50 dark:bg-green-500/10 p-4 text-green-600 border border-green-100 dark:border-green-500/20 w-fit">
                  <TrendingUp size={24} />
                </div>
                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">Total Revenue</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-zinc-100 mt-1">₹{analytics?.totalRevenue?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardHover>
          </SlideIn>

          <SlideIn delay={0.2}>
            <CardHover>
              <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm p-8 border border-gray-100 dark:border-zinc-800 h-full relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <TrendingDown size={100} />
                </div>
                <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 p-4 text-red-600 border border-red-100 dark:border-red-500/20 w-fit">
                  <TrendingDown size={24} />
                </div>
                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">Direct Expenses</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-zinc-100 mt-1">₹{analytics?.totalExpense?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardHover>
          </SlideIn>

          <SlideIn delay={0.3}>
            <CardHover>
              <div className="bg-zinc-900 dark:bg-amber-600 rounded-3xl shadow-xl p-8 h-full relative overflow-hidden group text-white">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Wallet size={100} />
                </div>
                <div className="rounded-2xl bg-white/10 p-4 text-white border border-white/20 w-fit">
                  <Wallet size={24} />
                </div>
                <div className="mt-6">
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">Calculated Profit</p>
                  <p className="text-3xl font-black mt-1">₹{analytics?.profit?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardHover>
          </SlideIn>
        </div>
        
        {/* Quick Actions */}
        <SlideIn delay={0.4} direction="up">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-10 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 tracking-tight flex items-center">
              <Zap className="mr-3 text-amber-600 fill-amber-600" size={24} /> Rapid Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {[
                { name: 'Mark Attendance', href: '/dashboard/branch-admin/attendance', color: 'hover:bg-green-50 dark:hover:bg-green-500/10' },
                { name: 'Log New Expense', href: '/dashboard/branch-admin/expenses', color: 'hover:bg-red-50 dark:hover:bg-red-500/10' },
                { name: 'Manage Tables', href: '/dashboard/branch-admin/tables', color: 'hover:bg-blue-50 dark:hover:bg-blue-500/10' },
              ].map((action, i) => (
                <a 
                  key={i}
                  href={action.href} 
                  className={`flex items-center justify-between p-6 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 font-bold transition-all group ${action.color}`}
                >
                  {action.name}
                  <TrendingUp className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={18} />
                </a>
              ))}
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
