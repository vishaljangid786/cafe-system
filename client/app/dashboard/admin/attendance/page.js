'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { CalendarCheck, Calendar, Filter, MapPin, CheckCircle2, XCircle, PieChart as PieIcon, Activity } from 'lucide-react';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import ExportActions from '../../../components/ui/ExportActions';

export default function GlobalAttendancePage() {
  const dateInputRef = useRef(null);
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({
    date: new Date().toISOString()?.split('T')[0],
    locationId: 'All'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  
  const columns = [
    { header: 'Date', key: 'date' },
    { header: 'Employee', key: 'user.name' },
    { header: 'Role', key: 'user.role' },
    { header: 'Location', key: 'locationName' },
    { header: 'Status', key: 'status' },
    { header: 'Marked By', key: 'markedBy.name' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [attRes, summaryRes, locRes] = await Promise.all([
          api.get(`/attendance/all?date=${filters.date}&locationId=${filters.locationId}&page=${currentPage}&limit=${itemsPerPage}`),
          api.get(`/attendance/monthly-summary?month=${filters.date.slice(0, 7)}&locationId=${filters.locationId}`),
          api.get('/locations')
        ]);
        setAttendance(attRes.data.data);
        setTotalPages(attRes.data.pagination?.pages || 1);
        setSummary(summaryRes.data.data);
        setLocations(locRes.data.data);
      } catch (err) {
        console.error('Failed to fetch attendance list:', err.response?.data || err.message);
        toast.error(err.response?.data?.message || 'Failed to fetch attendance data stream');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters, currentPage]);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header & Controls */}
<SlideIn direction="down">
  <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-2xl p-5 md:p-7 shadow-[var(--shadow-premium)] transition-all">

    {/* subtle gradient glow */}
    <div className="absolute inset-0 opacity-30 pointer-events-none bg-[var(--gradient-primary)] blur-3xl" />

    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">

      {/* LEFT: Title Section */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center">
          <div className="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] mr-3">
            <CalendarCheck size={22} />
          </div>

          <span className="text-[var(--color-text-primary)]">
            Staff
          </span>

          <span className="ml-2 bg-clip-text text-transparent bg-[var(--gradient-primary)]">
            Attendance
          </span>
        </h1>

        <p className="text-xs md:text-sm text-[var(--color-text-muted)] font-medium">
          Real-time tracking across all branches with smart insights.
        </p>
      </div>

        <div className="flex flex-wrap items-center gap-3">
          <ExportActions 
            data={attendance} 
            columns={columns} 
            filename={`Attendance_${filters.date}`} 
            hasCharts={true}
          />

          {/* Seed Data Button (Development Only) */}
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await api.post('/seed/attendance');
                toast.success('Database seeded with 14 days of logs!');
                // Re-fetch data
                window.location.reload();
              } catch (err) {
                toast.error('Failed to seed data');
              } finally {
                setLoading(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--color-primary)]/20"
          >
            <Activity size={14} />
            Seed Sample Data
          </button>

        {/* Date Picker */}
        <div
          onClick={() => dateInputRef.current?.showPicker()}
          className="group flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] hover:border-[var(--color-primary)]/40 transition-all cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] group-hover:scale-105 transition-transform">
            <Calendar size={16} />
          </div>

          <input
            ref={dateInputRef}
            type="date"
            className="bg-transparent outline-none text-sm font-semibold text-[var(--color-text-primary)] cursor-pointer"
            value={filters.date}
            onChange={(e) =>
              setFilters({ ...filters, date: e.target.value })
            }
          />
        </div>

        {/* Branch Select */}
        <div className="min-w-[180px]">
          <PremiumSelect
            icon={MapPin}
            value={filters.locationId}
            onChange={(val) =>
              setFilters({ ...filters, locationId: val })
            }
            options={[
              { label: 'All Locations', value: 'All' },
              ...locations.map((l) => ({
                label: l.name,
                value: l._id,
              })),
            ]}
          />
        </div>
      </div>
    </div>
  </div>
</SlideIn>
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-[var(--color-border)] border-l-4 border-l-[var(--color-success)] transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Present Today</p>
              <p className="text-3xl font-black text-[var(--color-text-primary)] mt-1">{attendance.filter(a => a.status === 'present').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.2}>
            <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-[var(--color-border)] border-l-4 border-l-[var(--color-danger)] transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Absent Today</p>
              <p className="text-3xl font-black text-[var(--color-text-primary)] mt-1">{attendance.filter(a => a.status === 'absent').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.3}>
            <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-[var(--color-border)] transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Total Presents (Month)</p>
              <p className="text-3xl font-black text-[var(--color-success)] mt-1">
                {Array.isArray(summary)
                  ? summary.reduce((acc, s) => acc + (Number(s.totalPresentDays) || 0), 0)
                  : 0}
              </p>
            </div>
          </SlideIn>
          <SlideIn delay={0.4}>
            <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-[var(--color-border)] transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Total Absents (Month)</p>
              <p className="text-3xl font-black text-[var(--color-danger)] mt-1">
                {Array.isArray(summary)
                  ? summary.reduce((acc, s) => acc + (Number(s.totalAbsentDays) || 0), 0)
                  : 0}
              </p>
            </div>
          </SlideIn>
        </div>

        {/* Visual Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Daily Distribution */}
          <SlideIn delay={0.5}>
            <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-8 rounded-3xl border border-[var(--color-border)] shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)] tracking-tight">Daily Distribution</h2>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Real-time status breakdown</p>
                </div>
                <PieIcon size={20} className="text-[var(--color-primary)]" />
              </div>
              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Present', value: attendance.filter(a => a.status === 'present').length },
                        { name: 'Absent', value: attendance.filter(a => a.status === 'absent').length },
                        { name: 'Half-Day', value: attendance.filter(a => a.status === 'half-day').length }
                      ]}
                      cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value"
                    >
                      <Cell fill="var(--color-success)" />
                      <Cell fill="var(--color-danger)" />
                      <Cell fill="var(--color-primary)" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-[var(--color-text-primary)] italic">{attendance.length}</span>
                  <span className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Staff Members</span>
                </div>
              </div>
            </div>
          </SlideIn>

          {/* Monthly Historical Trends */}
          <SlideIn delay={0.6}>
            <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-8 rounded-3xl border border-[var(--color-border)] shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)] tracking-tight">Historical Trends</h2>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Monthly presence vs absence</p>
                </div>
                <Activity size={20} className="text-[var(--color-secondary)]" />
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Array.isArray(summary) ? summary.map(s => ({
                    name: s.locationName,
                    present: Number(s.totalPresentDays) || 0,
                    absent: Number(s.totalAbsentDays) || 0
                  })).slice(0, 10) : []}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip />
                    <Bar dataKey="present" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="absent" fill="var(--color-danger)" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>
        </div>

        {/* Attendance Table */}
        <SlideIn direction="up" delay={0.5}>
          <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl rounded-2xl shadow-sm border border-[var(--color-border)] overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-[var(--color-text-primary)]">Daily Logs</h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-[var(--color-surface-soft)]/50 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                    <th className="px-6 py-4">Staff Member</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="4" className="px-6 py-8"><div className="h-4 bg-[var(--color-surface-soft)] rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : attendance.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-[var(--color-text-muted)] font-medium">No attendance records found for this date.</td>
                    </tr>
                  ) : (
                    attendance.map((record) => (
                      <tr key={record._id} className="hover:bg-[var(--color-primary)]/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-lg bg-[var(--color-surface-soft)] flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] mr-3 uppercase">
                              {record.user?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--color-text-primary)]">{record.user?.name || 'Unknown'}</p>
                              <p className="text-[10px] font-medium text-[var(--color-text-muted)]">
                                {record.user?.role === 'location_admin' || record.user?.role === 'branch_admin' ? 'Branch Admin' : record.user?.role?.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-[var(--color-text-secondary)]">{record.locationName}</span>
                        </td>
                        <td className="px-6 py-4">
                          {record.status === 'present' ? (
                            <div className="flex items-center text-[var(--color-success)] font-bold text-xs uppercase tracking-tighter">
                              <CheckCircle2 size={14} className="mr-1" /> Present
                            </div>
                          ) : (
                            <div className="flex items-center text-[var(--color-danger)] font-bold text-xs uppercase tracking-tighter">
                              <XCircle size={14} className="mr-1" /> Absent
                            </div>
                          )}
                        </td>
                         <td className="px-6 py-4">
                           <p className="text-xs text-[var(--color-text-muted)]">{record.markedBy?.name || 'Auto'}</p>
                         </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-[var(--color-surface)]/40 backdrop-blur-2xl border border-[var(--color-border)] rounded-[2.5rem] mt-10 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              List Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
