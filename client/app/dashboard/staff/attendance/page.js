"use client"
import { useState, useEffect } from 'react';
import api from '../../../../app/services/api';
import { Calendar, Wallet, CheckCircle, XCircle, Clock, Loader2, Search, Filter, TrendingUp, CalendarDays, Activity } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { useAuth } from '../../../../app/context/AuthContext';

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [attRes, salRes] = await Promise.all([
          api.get(`/attendance/my?month=${month}`),
          api.get(`/salary/my?month=${month}`)
        ]);
        setAttendance(attRes.data.data);
        setSalaryData(salRes.data.data);
      } catch (error) {
        console.error('Personnel telemetry sync failure');
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user, month]);

  const filteredAttendance = attendance.filter(log => 
    new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
      .toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && attendance.length === 0) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <Loader2 className="animate-spin text-amber-500" size={40} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Syncing Personnel Matrix...</p>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
              <CalendarDays className="text-amber-500" size={36} strokeWidth={2.5} />
              Personnel <span className="text-amber-500">Metrics</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-1">Live work-cycle telemetry and fiscal disbursements.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <Calendar size={14} className="text-amber-500" />
              <input
                type="month"
                className="bg-transparent outline-none text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Salary High-Yield Card */}
        <SlideIn delay={0.1}>
          <div className="relative overflow-hidden rounded-[3rem] bg-zinc-900 dark:bg-zinc-950 p-10 lg:p-14 text-white shadow-2xl shadow-zinc-900/30 border border-white/5">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 h-80 w-80 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
              <div className="flex-1 space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                      <Wallet className="text-amber-500" size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80">Fiscal Disbursement</span>
                  </div>
                  <h2 className="text-6xl font-black tracking-tighter mb-2">
                    ₹{Math.round(salaryData?.calculatedSalary || 0).toLocaleString()}
                  </h2>
                  <p className="text-zinc-400 font-medium text-sm">Estimated payout for the <span className="text-white font-bold">{new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span> operational cycle.</p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Base Yield</p>
                    <p className="text-sm font-bold tracking-tight">₹{user.monthlySalary?.toLocaleString()}</p>
                  </div>
                  <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">Payable Cycle</p>
                    <p className="text-sm font-bold tracking-tight text-amber-500">{salaryData?.payableDays} Nodes</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
                {[
                  { label: 'Present', val: salaryData?.totalPresent, color: 'text-emerald-500', icon: CheckCircle },
                  { label: 'Half Day', val: salaryData?.totalHalfDay, color: 'text-amber-500', icon: Clock },
                  { label: 'Absent', val: salaryData?.totalAbsent, color: 'text-rose-500', icon: XCircle },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex flex-col items-center text-center group hover:bg-white/10 transition-all duration-500">
                    <stat.icon size={20} className={`${stat.color} mb-4 group-hover:scale-110 transition-transform`} />
                    <p className="text-2xl font-black tracking-tighter mb-1">{stat.val}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Filter & Logs Matrix */}
        <div className="space-y-6">
          <SlideIn delay={0.2} direction="up">
            <div className="flex flex-col md:flex-row gap-4 items-center px-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Filter matrix logs..."
                  className="w-full pl-12 pr-6 py-4 bg-white/40 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-400">
                  <Filter size={18} />
                </div>
                <div className="px-5 py-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                  History Nodes: {filteredAttendance.length}
                </div>
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.3} direction="up">
            <div className="bg-white/40 dark:bg-zinc-950/20 backdrop-blur-md rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                      <th className="px-8 py-5 border-b border-zinc-100 dark:border-zinc-800">Operational Date</th>
                      <th className="px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 text-center">Status Protocol</th>
                      <th className="px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 text-right">Matrix Sync Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {filteredAttendance.map((log, idx) => (
                      <tr key={idx} className="group hover:bg-amber-500/[0.02] transition-colors duration-300">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
                              <Calendar size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                                {new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-0.5">Cycle Verification Active</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            log.status === 'present' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            log.status === 'half-day' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                            'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-xs font-black text-zinc-700 dark:text-zinc-300 tracking-tight">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter mt-1 flex items-center gap-1.5">
                              <Activity size={8} /> Matrix Logged
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center opacity-30">
                            <TrendingUp size={40} className="mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Personnel Nodes Detected</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SlideIn>
        </div>
      </div>
    </PageTransition>
  );
}
