'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import {
  History, DollarSign, Receipt, CheckCircle2, Calendar
} from 'lucide-react';
import { PageTransition } from '../../../components/ui/AnimatedContainer';
import toast from 'react-hot-toast';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
      toast.error('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [user]);

  if (!user) return null;

  return (
    <PageTransition>
      <div className="max-w-[1500px] mx-auto pb-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                <History size={24} className="text-white" />
              </div>
              Work History
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium ml-13">View your complete compensation and shift records.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex-1 space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Start Date</label>
            <input
              type="date"
              value={historyFilter.startDate}
              onChange={(e) => setHistoryFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500/20 outline-none text-xs font-bold transition-all"
            />
          </div>
          <div className="flex-1 space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">End Date</label>
            <input
              type="date"
              value={historyFilter.endDate}
              onChange={(e) => setHistoryFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500/20 outline-none text-xs font-bold transition-all"
            />
          </div>
          <button
            onClick={fetchData}
            className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all"
          >
            Apply Filter
          </button>
        </div>

        {loading ? (
          <div className="h-60 bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem] animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 space-y-8">
              {/* Salary Records */}
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-10 flex items-center gap-3">
                  <DollarSign size={16} className="text-emerald-500" /> Salary Records
                </h3>
                <div className="space-y-4">
                  {salaryHistory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 group hover:border-emerald-500/30 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="h-12 w-12 rounded-2xl bg-zinc-900 dark:bg-zinc-950 flex items-center justify-center text-emerald-400 shadow-lg">
                          <Receipt size={20} />
                        </div>
                        <div>
                          <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{new Date(entry.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{entry.payableDays} Working Days</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-emerald-500 tracking-tighter">₹{Math.round(entry.calculatedSalary).toLocaleString()}</p>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-1 flex items-center gap-1 justify-end">
                          Paid <CheckCircle2 size={10} className="text-emerald-500" />
                        </p>
                      </div>
                    </div>
                  ))}
                  {!salaryHistory.length && (
                    <div className="h-40 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold">No salary records available.</div>
                  )}
                </div>
              </div>

              {/* Salary Graph */}
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-8 flex items-center gap-3">
                  <DollarSign size={16} className="text-emerald-500" /> Salary Trends (6 Months)
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
                      <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSalary)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-8">
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-10 flex items-center gap-3">
                    <Calendar size={16} className="text-blue-500" /> Daily Attendance
                  </h3>
                  <div className="space-y-3">
                    {attendance.map((att, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-4">
                          <div className={`h-2 w-2 rounded-full ${att.status === 'present' ? 'bg-emerald-500' : att.status === 'absent' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{new Date(att.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${att.status === 'present' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                          {att.status}
                        </span>
                      </div>
                    ))}
                    {!attendance.length && (
                      <div className="h-60 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold">No presence records available.</div>
                    )}
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => fetchData(currentPage - 1)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Page {currentPage} of {totalPages}</span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => fetchData(currentPage + 1)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
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
