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
import { toneText, toneBg, toneSoft, toneBorder } from '../../../components/ui/tone';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';

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
  const [staff, setStaff] = useState([]);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
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
      const isInitial = !didInitRef.current;
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
      try {
        const [attRes, summaryRes, locRes] = await Promise.all([
          api.get(`/attendance/all?date=${filters.date}&locationId=${filters.locationId}&page=${currentPage}&limit=${itemsPerPage}`),
          api.get(`/attendance/monthly-summary?month=${filters.date.slice(0, 7)}&locationId=${filters.locationId}`),
          api.get('/locations')
        ]);
        setAttendance(attRes.data.data);
        setTotalPages(attRes.data.pagination?.pages || 1);
        setSummary(summaryRes.data.data);
        setLocations(locRes.data.data);

        // Fetch staff if a specific location is selected
        if (filters.locationId !== 'All') {
          const staffRes = await api.get(`/users?locationId=${filters.locationId}`);
          setStaff(staffRes.data.data.filter(u => u.role === 'staff' || u.role === 'chef'));
        } else {
          setStaff([]);
        }
      } catch (err) {
        console.error('Failed to fetch attendance list:', err.response?.data || err.message);
        toast.error(err.response?.data?.message || 'Failed to fetch attendance data stream');
      } finally {
        didInitRef.current = true;
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    };
    fetchData();
  }, [filters, currentPage]);

  const handleMarkAttendance = async (userId, status) => {
    const loadToast = toast.loading(`Marking ${status}...`);
    try {
      setMarkingLoading(true);
      await api.post('/attendance/mark', { 
        userId, 
        date: filters.date, 
        status,
        locationId: filters.locationId === 'All' ? undefined : filters.locationId 
      });
      
      // Re-fetch attendance logs for the table
      const attRes = await api.get(`/attendance/all?date=${filters.date}&locationId=${filters.locationId}&page=${currentPage}&limit=${itemsPerPage}`);
      setAttendance(attRes.data.data);
      
      toast.success('Attendance updated', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark attendance', { id: loadToast });
    } finally {
      setMarkingLoading(false);
    }
  };

  const getAttendanceStatus = (userId) => {
    const record = attendance.find(a => (a.user?._id || a.user) === userId);
    return record ? record.status : 'unmarked';
  };

  const filteredStaff = staff.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header & Controls */}
<SlideIn direction="down">
  <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60  p-5 md:p-7 shadow-[var(--shadow-premium)] transition-all">

    {/* subtle gradient glow */}
    <div className="absolute inset-0 opacity-30 pointer-events-none bg-[var(--gradient-primary)] hidden" />

    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">

      {/* LEFT: Title Section */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center">
          <div className="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] mr-3">
            <CalendarCheck size={22} />
          </div>

          <span className="text-[var(--color-text-primary)]">
            Staff
          </span>

          <span className="ml-2 text-[var(--color-primary)]">
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


        {/* Date Picker */}
        <div
          onClick={() => dateInputRef.current?.showPicker()}
          className="group flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] hover:border-[var(--color-primary)]/40 transition-all cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] group- transition-transform">
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
            <div className="bg-[var(--color-surface)]/40  p-6 rounded-xl shadow-sm border border-[var(--color-border)] border-l-4 border-l-[var(--color-success)] transition-colors">
              <p className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Present Today</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-1">{attendance.filter(a => a.status === 'present').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.2}>
            <div className="bg-[var(--color-surface)]/40  p-6 rounded-xl shadow-sm border border-[var(--color-border)] border-l-4 border-l-[var(--color-danger)] transition-colors">
              <p className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Absent Today</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-1">{attendance.filter(a => a.status === 'absent').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.3}>
            <div className="bg-[var(--color-surface)]/40  p-6 rounded-xl shadow-sm border border-[var(--color-border)] transition-colors">
              <p className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Total Presents (Month)</p>
              <p className="text-3xl font-bold text-[var(--color-success)] mt-1">
                {Array.isArray(summary)
                  ? summary.reduce((acc, s) => acc + (Number(s.totalPresentDays) || 0), 0)
                  : 0}
              </p>
            </div>
          </SlideIn>
          <SlideIn delay={0.4}>
            <div className="bg-[var(--color-surface)]/40  p-6 rounded-xl shadow-sm border border-[var(--color-border)] transition-colors">
              <p className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Total Absents (Month)</p>
              <p className="text-3xl font-bold text-[var(--color-danger)] mt-1">
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
            <div className="bg-[var(--color-surface)]/40  p-8 rounded-xl border border-[var(--color-border)] shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">Daily Distribution</h2>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-1">Real-time status breakdown</p>
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
                  <span className="text-3xl font-bold text-[var(--color-text-primary)] italic">{attendance.length}</span>
                  <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Staff Members</span>
                </div>
              </div>
            </div>
          </SlideIn>

          {/* Monthly Historical Trends */}
          <SlideIn delay={0.6}>
            <div className="bg-[var(--color-surface)]/40  p-8 rounded-xl border border-[var(--color-border)] shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">Historical Trends</h2>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-1">Monthly presence vs absence</p>
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

        {/* Attendance Marking Section (Only when location is selected) */}
        {filters.locationId !== 'All' && (
          <SlideIn direction="up">
            <div className="bg-[var(--color-surface)]/60  rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[var(--shadow-premium)]">
              <div className="px-8 py-6 border-b border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">Mark Attendance</h2>
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-1">
                    Manage presence for {locations.find(l => l._id === filters.locationId)?.name}
                  </p>
                </div>
                
                <div className="relative w-full md:w-64">
                  <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input 
                    type="text"
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none text-xs font-bold transition-all"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[var(--color-surface-soft)]/50 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                      <th className="px-8 py-5">Staff Member</th>
                      <th className="px-8 py-5 text-center">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-8 py-10 text-center text-[var(--color-text-muted)] text-sm font-medium italic">
                          No staff members found for this branch.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((user) => {
                        const status = getAttendanceStatus(user._id);
                        return (
                          <tr key={user._id} className="hover:bg-[var(--color-primary)]/[0.02] transition-colors group">
                            <td className="px-8 py-5">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-soft)] flex items-center justify-center font-bold text-[var(--color-primary)] border border-[var(--color-border)] group- transition-transform">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{user.name}</p>
                                  <p className="text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider uppercase">{user.role}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex justify-center">
                                <span className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-normal rounded-lg border shadow-sm ${
                                  status === 'present' ? 'bg-[rgba(var(--color-success-rgb),0.12)] text-[var(--color-success)] border-[var(--color-success)]' :
                                  status === 'absent' ? 'bg-[rgba(var(--color-danger-rgb),0.12)] text-[var(--color-danger)] border-[var(--color-danger)]' :
                                  status === 'half-day' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-primary)]' :
                                  'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                                }`}>
                                  {status}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex justify-end gap-2">
                                {[
                                  { id: 'present', icon: CheckCircle2, label: 'Present', color: 'green' },
                                  { id: 'half-day', icon: Activity, label: 'Half', color: 'blue' },
                                  { id: 'absent', icon: XCircle, label: 'Absent', color: 'red' }
                                ].map(btn => (
                                  <button
                                    key={btn.id}
                                    disabled={markingLoading}
                                    onClick={() => handleMarkAttendance(user._id, btn.id)}
                                    className={`p-2.5 rounded-xl border transition-all ${
                                      status === btn.id 
                                        ? `${toneBg(btn.color)} text-[var(--color-on-primary)] border-transparent`
                                        : `${toneText(btn.color)} ${toneSoft(btn.color)} hover:${toneBg(btn.color)} hover:text-[var(--color-on-primary)] border-[var(--color-border)]`
                                    }`}
                                    title={btn.label}
                                  >
                                    <btn.icon size={14} />
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SlideIn>
        )}

        {/* Attendance Table */}
        <SlideIn direction="up" delay={0.5}>
          <div className="bg-[var(--color-surface)]/40  rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-[var(--color-text-primary)]">Daily Logs</h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-[var(--color-surface-soft)]/50 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                    <th className="px-6 py-4">Staff Member</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {refetching ? (
                    <tr>
                      <td colSpan="4" className="p-0">
                        <TableSkeleton rows={6} cols={4} />
                      </td>
                    </tr>
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
                            <div className="flex items-center text-[var(--color-success)] font-bold text-xs uppercase tracking-tight">
                              <CheckCircle2 size={14} className="mr-1" /> Present
                            </div>
                          ) : (
                            <div className="flex items-center text-[var(--color-danger)] font-bold text-xs uppercase tracking-tight">
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
          <div className="flex items-center justify-between px-8 py-6 bg-[var(--color-surface)]/40  border border-[var(--color-border)] rounded-xl mt-10 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
              List Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]"
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
