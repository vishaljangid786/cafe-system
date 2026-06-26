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
import toast from 'react-hot-toast';

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [clocking, setClocking] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ fromDate: '', toDate: '', type: 'paid', reason: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  useEffect(() => {
    api.get('/leave-requests?mine=true').then((r) => setLeaves(r.data.data || [])).catch(() => {});
  }, [reloadKey]);

  const submitLeave = async () => {
    if (!leaveForm.fromDate || !leaveForm.toDate) return toast.error('Please pick both dates');
    if (leaveForm.toDate < leaveForm.fromDate) return toast.error('End date is before start date');
    setSubmittingLeave(true);
    try {
      await api.post('/leave-requests', leaveForm);
      toast.success('Leave request sent for approval');
      setLeaveForm({ fromDate: '', toDate: '', type: 'paid', reason: '' });
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not send request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const cancelLeave = async (id) => {
    try {
      await api.delete(`/leave-requests/${id}`);
      toast.success('Request cancelled');
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not cancel');
    }
  };

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
  }, [user, month, reloadKey]);

  // Today's record (IST) drives the clock-in/out button state.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayRec = attendance.find((a) => a.date === todayStr);
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const handleClock = async (action) => {
    setClocking(true);
    try {
      const res = await api.post(`/attendance/${action}`);
      if (action === 'check-in') {
        toast.success(res.data?.late ? 'Clocked in (marked late)' : 'Clocked in');
      } else {
        toast.success('Clocked out');
      }
      setReloadKey((k) => k + 1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update attendance');
    } finally {
      setClocking(false);
    }
  };

  const filteredAttendance = attendance.filter(log =>
    new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
      .toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-3 text-(--color-text-primary)">
              <CalendarDays className="text-primary" size={24} strokeWidth={2.5} />
              Attendance & <span className="text-primary">Salary</span>
            </h1>
            <p className="text-(--color-text-secondary) font-medium mt-1">Track your daily attendance and monthly salary.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Clock in / out for today */}
            {!todayRec?.checkIn ? (
              <button
                onClick={() => handleClock('check-in')}
                disabled={clocking}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-(--color-on-primary) text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                <Clock size={14} /> Clock In
              </button>
            ) : !todayRec?.checkOut ? (
              <button
                onClick={() => handleClock('check-out')}
                disabled={clocking}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-danger text-white text-xs font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                <Clock size={14} /> Clock Out · in {fmtTime(todayRec.checkIn)}{todayRec.isLate ? ' (late)' : ''}
              </button>
            ) : (
              <span className="flex items-center gap-2 px-5 py-3 rounded-xl bg-success/10 text-success border border-success/20 text-[11px] font-medium">
                <CheckCircle size={14} /> Done · {fmtTime(todayRec.checkIn)}–{fmtTime(todayRec.checkOut)}
              </span>
            )}

            <div className="flex items-center gap-3 bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border) shadow-sm ">
              <div className="flex items-center gap-2 px-4 py-2 bg-(--color-surface) rounded-xl border border-(--color-border)">
                <Calendar size={14} className="text-primary" />
                <input
                  type="month"
                  className="bg-transparent outline-none text-[11px] font-medium text-(--color-text-primary)"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Leave requests */}
        <SlideIn delay={0.05}>
          <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-primary" />
              <h2 className="text-sm font-semibold text-(--color-text-primary)">Request leave</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-medium text-(--color-text-muted)">From</label>
                <input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-(--color-text-muted)">To</label>
                <input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-(--color-text-muted)">Type</label>
                <div className="mt-1">
                  <PremiumSelect
                    value={leaveForm.type}
                    onChange={(v) => setLeaveForm({ ...leaveForm, type: v })}
                    options={[{ label: 'Paid', value: 'paid' }, { label: 'Sick', value: 'sick' }, { label: 'Casual', value: 'casual' }, { label: 'Unpaid', value: 'unpaid' }]}
                    placeholder="Leave type"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-medium text-(--color-text-muted)">Reason (optional)</label>
                <input type="text" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="e.g. family function"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none" />
              </div>
            </div>
            <button onClick={submitLeave} disabled={submittingLeave}
              className="px-6 py-3 bg-primary text-(--color-on-primary) text-[11px] font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
              {submittingLeave ? 'Sending…' : 'Send request'}
            </button>

            {leaves.length > 0 && (
              <div className="divide-y divide-(--color-border) pt-2">
                {leaves.slice(0, 6).map((l) => (
                  <div key={l._id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-xs font-medium text-(--color-text-primary)">{l.fromDate} → {l.toDate} <span className="text-(--color-text-muted) uppercase text-[9px]">· {l.type}</span></p>
                      {l.reason && <p className="text-[10px] text-(--color-text-muted)">{l.reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-medium uppercase tracking-normal px-2.5 py-1 rounded-lg ${l.status === 'approved' ? 'bg-success/10 text-success' : l.status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-amber-500/10 text-amber-500'}`}>{l.status}</span>
                      {l.status === 'pending' && (
                        <button onClick={() => cancelLeave(l._id)} className="text-[11px] font-medium text-(--color-text-muted) hover:text-danger">Cancel</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SlideIn>

        {/* Salary High-Yield Card */}
        <SlideIn delay={0.1}>
          <div className="relative overflow-hidden rounded-xl bg-(--color-surface-dark) p-6 lg:p-8 text-white shadow-sm shadow-black/30 border border-(--color-border)">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 h-80 w-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">
              <div className="flex-1 space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Wallet className="text-primary" size={16} />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-normal text-primary/80">Salary for this month</span>
                  </div>
                  <h2 className="text-3xl font-semibold tracking-tight mb-2">
                    ₹{Math.round(salaryData?.calculatedSalary || 0).toLocaleString()}
                  </h2>
                  <p className="text-(--color-text-muted) font-medium text-sm">Estimated payout for <span className="text-white font-medium">{new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>.</p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="px-5 py-3 rounded-xl bg-white/5 border border-(--color-border) ">
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Basic Salary</p>
                    <p className="text-sm font-semibold tracking-tight">₹{user.monthlySalary?.toLocaleString()}</p>
                  </div>
                  <div className="px-5 py-3 rounded-xl bg-white/5 border border-(--color-border) ">
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Paid Days</p>
                    <p className="text-sm font-semibold tracking-tight text-primary">{salaryData?.payableDays} Days</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
                {[
                  { label: 'Present', val: salaryData?.totalPresent, color: 'text-success', icon: CheckCircle },
                  { label: 'Half Day', val: salaryData?.totalHalfDay, color: 'text-primary', icon: Clock },
                  { label: 'Absent', val: salaryData?.totalAbsent, color: 'text-danger', icon: XCircle },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 p-5 rounded-xl border border-(--color-border) flex flex-col items-center text-center group hover:bg-white/10 transition-all duration-500">
                    <stat.icon size={20} className={`${stat.color} mb-4 transition-transform`} />
                    <p className="text-2xl font-semibold tracking-tight mb-1">{stat.val}</p>
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">{stat.label}</p>
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
              <div className="relative flex-1 min-w-0 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                <input
                  type="text"
                  placeholder="Search by date or status..."
                  className="w-full pl-12 pr-6 py-2.5 bg-(--color-surface)/40 border border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-sm text-(--color-text-primary) shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:shrink-0">
                <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) border border-(--color-border) flex items-center justify-center text-(--color-text-muted)">
                  <Filter size={18} />
                </div>
                <div className="px-5 py-2.5 bg-(--color-surface-soft) text-(--color-text-primary) border border-(--color-border) rounded-xl text-[11px] font-medium uppercase tracking-normal">
                  Total Records: {filteredAttendance.length}
                </div>
              </div>
            </div>
          </SlideIn>

          {refetching ? <TableSkeleton rows={6} cols={3} /> : (
          <SlideIn delay={0.3} direction="up">
            <div className="bg-(--color-surface)/40  rounded-xl border border-(--color-border) overflow-hidden shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-(--color-surface-soft)/50 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                      <th className="px-5 py-4 border-b border-(--color-border)">Date</th>
                      <th className="px-5 py-4 border-b border-(--color-border) text-center">Status</th>
                      <th className="px-5 py-4 border-b border-(--color-border) text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border)">
                    {filteredAttendance.map((log, idx) => (
                      <tr key={idx} className="group hover:bg-primary/[0.02] transition-colors duration-300">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) flex items-center justify-center text-(--color-text-muted) border border-(--color-border)">
                              <Calendar size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-(--color-text-primary) tracking-tight">
                                {new Date(log.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-0.5">Marked</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-normal border ${
                            log.status === 'present' ? 'bg-success/10 text-success border-success/20' :
                            log.status === 'half-day' ? 'bg-primary/10 text-primary border-primary/20' :
                            'bg-danger/10 text-danger border-danger/20'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <p className="text-xs font-medium text-(--color-text-primary) tracking-tight">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                            <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-tight mt-1 flex items-center gap-1.5">
                              <Activity size={8} /> Attendance marked
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-5 py-20 text-center">
                          <div className="flex flex-col items-center opacity-30">
                            <TrendingUp size={40} className="mb-4" />
                            <p className="text-[11px] font-medium uppercase tracking-normal">No attendance records found</p>
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
