'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import {
  History, DollarSign, Receipt, CheckCircle2, Calendar
} from 'lucide-react';
import { PageTransition } from '../../../components/ui/AnimatedContainer';
import { Skeleton } from '@/app/components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function WorkHistoryPage() {
  const { user } = useAuth();
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState({ startDate: '', endDate: '' });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async (pageToFetch = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const historyParams = { page: pageToFetch, limit: 20 };
      if (historyFilter.startDate) historyParams.startDate = historyFilter.startDate;
      if (historyFilter.endDate) historyParams.endDate = historyFilter.endDate;

      const [salaryRes, attRes] = await Promise.all([
        api.get('/salary/my-history'),
        api.get('/attendance/my', { params: historyParams })
      ]);
      setSalaryHistory(salaryRes.data.data);
      setAttendance(attRes.data.data);
      setCurrentPage(attRes.data.pagination?.page || 1);
      setTotalPages(attRes.data.pagination?.pages || 1);
    } catch (error) {
      console.error('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(1);
    }, 0);

    return () => clearTimeout(timer);
  }, [user]);

  if (!user) return null;
  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="max-w-375 mx-auto pb-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight flex items-center gap-3">
              <div className="h-6 w-6 rounded-xl bg-primary flex items-center justify-center">
                <History size={24} className="text-white" />
              </div>
              Work History
            </h1>
            <p className="text-xs text-(--color-text-muted) mt-1 font-medium ml-13">View your complete compensation and shift records.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-4 bg-(--color-surface) dark:bg-(--color-surface) p-5 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm">
          <div className="flex-1 space-y-3">
            <label className="text-[11px] font-medium text-(--color-text-muted) ml-4">Start Date</label>
            <input
              type="date"
              value={historyFilter.startDate}
              onChange={(e) => setHistoryFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-6 py-2.5 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border-2 border-transparent focus:border-primary/20 outline-none text-xs font-medium transition-all"
            />
          </div>
          <div className="flex-1 space-y-3">
            <label className="text-[11px] font-medium text-(--color-text-muted) ml-4">End Date</label>
            <input
              type="date"
              value={historyFilter.endDate}
              onChange={(e) => setHistoryFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-6 py-2.5 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border-2 border-transparent focus:border-primary/20 outline-none text-xs font-medium transition-all"
            />
          </div>
          <button
            onClick={() => fetchData(1)}
            className="px-8 py-2.5 bg-primary text-white rounded-xl text-[11px] font-semibold active:scale-95 transition-all"
          >
            Apply Filter
          </button>
        </div>

        {loading ? (
          <Skeleton className="h-60 rounded-xl" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 space-y-6">
              {/* Salary Records */}
              <div className="bg-(--color-surface) dark:bg-(--color-surface) rounded-xl p-5 border border-(--color-border) dark:border-(--color-border) shadow-sm">
                <h3 className="text-[11px] font-medium text-(--color-text-muted) dark:text-(--color-text-muted) mb-6 flex items-center gap-3">
                  <DollarSign size={16} className="text-success" /> Salary Records
                </h3>
                <div className="space-y-4">
                  {salaryHistory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-(--color-surface-soft) dark:bg-(--color-surface)/40 rounded-xl border border-(--color-border) dark:border-(--color-border) group hover:border-success/30 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="h-12 w-12 rounded-xl bg-(--color-surface) dark:bg-(--color-bg) flex items-center justify-center text-success">
                          <Receipt size={20} />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">{new Date(entry.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                          <p className="text-[11px] font-medium text-(--color-text-muted) mt-1">{entry.payableDays} Working Days</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-success tracking-tight">₹{Math.round(entry.calculatedSalary).toLocaleString()}</p>
                        <p className="text-[11px] font-medium text-(--color-text-muted) mt-1 flex items-center gap-1 justify-end">
                          Paid <CheckCircle2 size={10} className="text-success" />
                        </p>
                      </div>
                    </div>
                  ))}
                  {!salaryHistory.length && (
                    <div className="h-40 flex flex-col items-center justify-center opacity-30 text-xs font-medium">No salary records available.</div>
                  )}
                </div>
              </div>

              {/* Salary Graph */}
              <div className="bg-(--color-surface) dark:bg-(--color-surface) rounded-xl p-5 border border-(--color-border) dark:border-(--color-border) shadow-sm flex flex-col">
                <h3 className="text-[11px] font-medium text-(--color-text-muted) dark:text-(--color-text-muted) mb-6 flex items-center gap-3">
                  <DollarSign size={16} className="text-success" /> Salary Trends (6 Months)
                </h3>
                <div className="flex-1 min-h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salaryHistory.map(s => ({ month: new Date(s.month + '-01').toLocaleDateString('en-US', { month: 'short' }), amount: Math.round(s.calculatedSalary) })).reverse()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSalary" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a30" />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '1rem', color: 'var(--color-text-primary)', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSalary)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <div className="bg-(--color-surface) dark:bg-(--color-surface) rounded-xl p-5 border border-(--color-border) dark:border-(--color-border) shadow-sm h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-[11px] font-medium text-(--color-text-muted) dark:text-(--color-text-muted) mb-6 flex items-center gap-3">
                    <Calendar size={16} className="text-primary" /> Daily Attendance
                  </h3>
                  <div className="space-y-3">
                    {attendance.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-(--color-surface-soft) dark:bg-(--color-surface)/30 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                        <div className="flex items-center gap-4">
                          <div className={`h-2 w-2 rounded-full ${att.status === 'present' ? 'bg-success' : att.status === 'absent' ? 'bg-danger' : 'bg-primary'}`} />
                          <p className="text-xs font-medium text-(--color-text-secondary) dark:text-(--color-text-muted)">{new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md ${att.status === 'present' ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                          {att.status}
                        </span>
                      </div>
                    ))}
                    {!attendance.length && (
                      <div className="h-60 flex flex-col items-center justify-center opacity-30 text-xs font-medium">No presence records available.</div>
                    )}
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-(--color-border) dark:border-(--color-border)/50">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => fetchData(currentPage - 1)}
                      className="px-5 py-2.5 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) text-[11px] font-medium text-(--color-text-secondary) dark:text-(--color-text-muted) disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-[11px] font-medium text-(--color-text-muted)">Page {currentPage} of {totalPages}</span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => fetchData(currentPage + 1)}
                      className="px-5 py-2.5 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) text-[11px] font-medium text-(--color-text-secondary) dark:text-(--color-text-muted) disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
