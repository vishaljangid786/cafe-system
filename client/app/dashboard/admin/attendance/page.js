'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LeaveApprovals from '../../../components/attendance/LeaveApprovals';
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
        toast.error(err.response?.data?.message || 'Could not load attendance data. Please try again.');
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
      toast.error(error.response?.data?.message || 'Could not mark attendance. Please try again.', { id: loadToast });
    } finally {
      setMarkingLoading(false);
    }
  };

  const getAttendanceStatus = (userId) => {
    const record = attendance.find(a => (a.user?._id || a.user) === userId);
    return record ? record.status : 'unmarked';
  };

  const filteredStaff = staff.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6">
        <LeaveApprovals />
        {/* Header & Controls */}
<SlideIn direction="down">
  <div className="relative overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface)/60  p-5 md:p-6 shadow-sm transition-all">

    {/* subtle gradient glow */}
    <div className="absolute inset-0 opacity-30 pointer-events-none bg-[var(--gradient-primary)] hidden" />

    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">

      {/* LEFT: Title Section */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center">
          <div className="p-2 rounded-xl bg-primary/10 text-primary mr-3">
            <CalendarCheck size={22} />
          </div>

          <span className="text-(--color-text-primary)">
            Staff
          </span>

          <span className="ml-2 text-primary">
            Attendance
          </span>
        </h1>

        <p className="text-xs md:text-sm text-(--color-text-muted) font-medium">
          Track staff attendance across all branches.
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
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-(--color-border) bg-(--color-bg-soft) hover:border-primary/40 transition-all cursor-pointer"
        >
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary transition-transform">
            <Calendar size={16} />
          </div>

          <input
            ref={dateInputRef}
            type="date"
            className="bg-transparent outline-none text-sm font-semibold text-(--color-text-primary) cursor-pointer"
            value={filters.date}
            onChange={(e) =>
              setFilters({ ...filters, date: e.target.value })
            }
          />
        </div>

        {/* Branch Select */}
        <div className="min-w-45">
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
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) border-l-4 border-l-success transition-colors">
              <p className="text-[11px] font-medium text-(--color-text-muted)">Present Today</p>
              <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">{attendance.filter(a => a.status === 'present').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.2}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) border-l-4 border-l-danger transition-colors">
              <p className="text-[11px] font-medium text-(--color-text-muted)">Absent Today</p>
              <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">{attendance.filter(a => a.status === 'absent').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.3}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) transition-colors">
              <p className="text-[11px] font-medium text-(--color-text-muted)">Total Presents (Month)</p>
              <p className="text-2xl font-semibold text-success mt-1">
                {Array.isArray(summary)
                  ? summary.reduce((acc, s) => acc + (Number(s.totalPresentDays) || 0), 0)
                  : 0}
              </p>
            </div>
          </SlideIn>
          <SlideIn delay={0.4}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) transition-colors">
              <p className="text-[11px] font-medium text-(--color-text-muted)">Total Absents (Month)</p>
              <p className="text-2xl font-semibold text-danger mt-1">
                {Array.isArray(summary)
                  ? summary.reduce((acc, s) => acc + (Number(s.totalAbsentDays) || 0), 0)
                  : 0}
              </p>
            </div>
          </SlideIn>
        </div>

        {/* Visual Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Daily Distribution */}
          <SlideIn delay={0.5}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl border border-(--color-border) shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-(--color-text-primary) tracking-tight">Daily Distribution</h2>
                  <p className="text-[11px] font-medium text-(--color-text-muted) mt-1">Today&apos;s status breakdown</p>
                </div>
                <PieIcon size={20} className="text-primary" />
              </div>
              <div className="h-75 w-full relative">
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
                  <span className="text-2xl font-semibold text-(--color-text-primary)">{attendance.length}</span>
                  <span className="text-[11px] font-medium text-(--color-text-muted)">Staff Members</span>
                </div>
              </div>
            </div>
          </SlideIn>

          {/* Monthly Historical Trends */}
          <SlideIn delay={0.6}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl border border-(--color-border) shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-(--color-text-primary) tracking-tight">Historical Trends</h2>
                  <p className="text-[11px] font-medium text-(--color-text-muted) mt-1">Monthly presence vs absence</p>
                </div>
                <Activity size={20} className="text-secondary" />
              </div>
              <div className="h-75 w-full">
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
            <div className="bg-(--color-surface)/60  rounded-xl border border-(--color-border) overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-(--color-border) flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-(--color-text-primary) tracking-tight">Mark Attendance</h2>
                  <p className="text-[11px] font-medium text-(--color-text-muted) mt-1">
                    Manage presence for {locations.find(l => l._id === filters.locationId)?.name}
                  </p>
                </div>

                <div className="relative w-full md:w-64">
                  <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:border-primary outline-none text-xs font-medium transition-all"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-(--color-surface-soft)/50 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) border-b border-(--color-border)">
                      <th className="px-5 py-4">Staff Member</th>
                      <th className="px-5 py-4 text-center">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border)">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-5 py-10 text-center text-(--color-text-muted) text-sm font-medium">
                          No staff members found for this branch.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((user) => {
                        const status = getAttendanceStatus(user._id);
                        return (
                          <tr key={user._id} className="hover:bg-primary/[0.02] transition-colors group">
                            <td className="px-5 py-4">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) flex items-center justify-center font-semibold text-primary border border-(--color-border) transition-transform">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-(--color-text-primary)">{user.name}</p>
                                  <p className="text-[11px] font-medium text-(--color-text-muted) tracking-wider uppercase">{user.role}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-center">
                                <span className={`px-2.5 py-1 text-[11px] font-medium uppercase tracking-normal rounded-lg border ${
                                  status === 'present' ? 'bg-[rgba(var(--color-success-rgb),0.12)] text-success border-success' :
                                  status === 'absent' ? 'bg-[rgba(var(--color-danger-rgb),0.12)] text-danger border-danger' :
                                  status === 'half-day' ? 'bg-(--color-primary-soft) text-primary border-primary' :
                                  'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)'
                                }`}>
                                  {status}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
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
                                        ? `${toneBg(btn.color)} text-(--color-on-primary) border-transparent`
                                        : `${toneText(btn.color)} ${toneSoft(btn.color)} hover:${toneBg(btn.color)} hover:text-(--color-on-primary) border-(--color-border)`
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
          <div className="bg-(--color-surface)/40  rounded-xl shadow-sm border border-(--color-border) overflow-hidden transition-colors">
            <div className="px-5 py-4 border-b border-(--color-border)">
              <h2 className="font-semibold text-(--color-text-primary)">Daily Logs</h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-200">
                <thead>
                  <tr className="bg-(--color-surface-soft)/50 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                    <th className="px-5 py-4">Staff Member</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border)">
                  {refetching ? (
                    <tr>
                      <td colSpan="4" className="p-0">
                        <TableSkeleton rows={6} cols={4} />
                      </td>
                    </tr>
                  ) : attendance.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-12 text-center text-(--color-text-muted) font-medium">No attendance records found for this date.</td>
                    </tr>
                  ) : (
                    attendance.map((record) => (
                      <tr key={record._id} className="hover:bg-primary/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-lg bg-(--color-surface-soft) flex items-center justify-center text-xs font-medium text-(--color-text-muted) mr-3 uppercase">
                              {record.user?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-(--color-text-primary)">{record.user?.name || 'Unknown'}</p>
                              <p className="text-[11px] font-medium text-(--color-text-muted)">
                                {record.user?.role === 'location_admin' || record.user?.role === 'branch_admin' ? 'Branch Admin' : record.user?.role?.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-(--color-text-secondary)">{record.locationName}</span>
                        </td>
                        <td className="px-5 py-4">
                          {record.status === 'present' ? (
                            <div className="flex items-center text-success font-medium text-xs uppercase tracking-tight">
                              <CheckCircle2 size={14} className="mr-1" /> Present
                            </div>
                          ) : (
                            <div className="flex items-center text-danger font-medium text-xs uppercase tracking-tight">
                              <XCircle size={14} className="mr-1" /> Absent
                            </div>
                          )}
                        </td>
                         <td className="px-5 py-4">
                           <p className="text-xs text-(--color-text-muted)">{record.markedBy?.name || 'Auto'}</p>
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
          <div className="flex items-center justify-between px-5 py-4 bg-(--color-surface)/40  border border-(--color-border) rounded-xl mt-6 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft) text-(--color-text-primary)"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface) border border-(--color-border) text-[11px] font-medium uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-(--color-surface-soft) text-(--color-text-primary)"
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
