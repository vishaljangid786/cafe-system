"use client"
import { useState, useEffect, useRef } from 'react';
import api from '@/app/services/api';
import { Calendar, Wallet, CheckCircle, XCircle, Clock, Search, Filter, TrendingUp, CalendarDays, Activity } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '@/app/components/ui/AnimatedContainer';
import { LoaderBlock } from '@/app/components/ui/Spinner';
import { useAuth } from '@/app/context/AuthContext';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const isInitial = !didInitRef.current;
      if (isInitial) setLoading(true); else setRefetching(true);
      progress.start();
      try {
        const [attRes, salRes] = await Promise.all([
          api.get(`/attendance/my?month=${month}`),
          api.get(`/salary/my?month=${month}`)
        ]);
        setAttendance(attRes.data.data);
        setSalaryData(salRes.data.data);
      } catch (error) {
        console.error('Failed to load attendance');
      } finally {
        didInitRef.current = true;
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    };
    if (user) fetchData();
  }, [user, month]);

  const filteredAttendance = attendance.filter(log => 
    new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
      .toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-4 text-[var(--color-text-primary)]">
              <CalendarDays className="text-[var(--color-primary)]" size={36} strokeWidth={2.5} />
              Attendance & <span className="text-[var(--color-primary)]">Salary</span>
            </h1>
            <p className="text-[var(--color-text-secondary)] font-medium mt-1">Track your daily attendance and monthly salary.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-[var(--color-surface-soft)] p-1.5 rounded-xl border border-[var(--color-border)] shadow-sm ">
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)]">
              <Calendar size={14} className="text-[var(--color-primary)]" />
              <input
                type="month"
                className="bg-transparent outline-none text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-primary)]"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Salary High-Yield Card */}
        <SlideIn delay={0.1}>
          <div className="relative overflow-hidden rounded-xl bg-[var(--color-surface-dark)] p-10 lg:p-14 text-white shadow-sm shadow-black/30 border border-[var(--color-border)]">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[var(--color-primary)]/10 to-transparent pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 h-80 w-80 bg-[var(--color-primary)]/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
              <div className="flex-1 space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center border border-[var(--color-primary)]/30">
                      <Wallet className="text-[var(--color-primary)]" size={16} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)]/80">Salary for this month</span>
                  </div>
                  <h2 className="text-6xl font-bold tracking-tight mb-2">
                    ₹{Math.round(salaryData?.calculatedSalary || 0).toLocaleString()}
                  </h2>
                  <p className="text-[var(--color-text-muted)] font-medium text-sm">Estimated payout for <span className="text-white font-bold">{new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>.</p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="px-5 py-3 rounded-xl bg-white/5 border border-[var(--color-border)] ">
                    <p className="text-[8px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">Basic Salary</p>
                    <p className="text-sm font-bold tracking-tight">₹{user.monthlySalary?.toLocaleString()}</p>
                  </div>
                  <div className="px-5 py-3 rounded-xl bg-white/5 border border-[var(--color-border)] ">
                    <p className="text-[8px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">Paid Days</p>
                    <p className="text-sm font-bold tracking-tight text-[var(--color-primary)]">{salaryData?.payableDays} Days</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
                {[
                  { label: 'Present', val: salaryData?.totalPresent, color: 'text-[var(--color-success)]', icon: CheckCircle },
                  { label: 'Half Day', val: salaryData?.totalHalfDay, color: 'text-[var(--color-primary)]', icon: Clock },
                  { label: 'Absent', val: salaryData?.totalAbsent, color: 'text-[var(--color-danger)]', icon: XCircle },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 p-6 rounded-xl border border-[var(--color-border)] flex flex-col items-center text-center group hover:bg-white/10 transition-all duration-500">
                    <stat.icon size={20} className={`${stat.color} mb-4 group- transition-transform`} />
                    <p className="text-2xl font-bold tracking-tight mb-1">{stat.val}</p>
                    <p className="text-[8px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Attendance Logs */}
        <div className="space-y-6">
          <SlideIn delay={0.2} direction="up">
            <div className="flex flex-col md:flex-row gap-4 items-center px-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by date or status..."
                  className="w-full pl-12 pr-6 py-4 bg-[var(--color-surface)]/40 border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none transition-all font-bold text-sm text-[var(--color-text-primary)] shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                  <Filter size={18} />
                </div>
                <div className="px-5 py-3.5 bg-[var(--color-surface-soft)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl text-[10px] font-bold uppercase tracking-normal shadow-lg">
                  Total Records: {filteredAttendance.length}
                </div>
              </div>
            </div>
          </SlideIn>

          {refetching ? <TableSkeleton rows={6} cols={3} /> : (
          <SlideIn delay={0.3} direction="up">
            <div className="bg-[var(--color-surface)]/40  rounded-xl border border-[var(--color-border)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-[var(--color-surface-soft)]/50 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                      <th className="px-8 py-5 border-b border-[var(--color-border)]">Date</th>
                      <th className="px-8 py-5 border-b border-[var(--color-border)] text-center">Status</th>
                      <th className="px-8 py-5 border-b border-[var(--color-border)] text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredAttendance.map((log, idx) => (
                      <tr key={idx} className="group hover:bg-[var(--color-primary)]/[0.02] transition-colors duration-300">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] border border-[var(--color-border)]">
                              <Calendar size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text-primary)] tracking-tight">
                                {new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <p className="text-[8px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-0.5">Marked</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-normal border ${
                            log.status === 'present' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' :
                            log.status === 'half-day' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 
                            'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-xs font-bold text-[var(--color-text-primary)] tracking-tight">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                            <p className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight mt-1 flex items-center gap-1.5">
                              <Activity size={8} /> Attendance marked
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
                            <p className="text-[10px] font-bold uppercase tracking-normal">No attendance records found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SlideIn>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
