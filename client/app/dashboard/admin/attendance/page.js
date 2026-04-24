'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { CalendarCheck, Calendar, Filter, MapPin, CheckCircle2, XCircle, PieChart as PieIcon, Activity } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [attRes, summaryRes, locRes] = await Promise.all([
          api.get(`/attendance/all?date=${filters.date}&locationId=${filters.locationId}`),
          api.get(`/attendance/monthly-summary?month=${filters.date.slice(0, 7)}&locationId=${filters.locationId}`),
          api.get('/locations')
        ]);
        setAttendance(attRes.data.data);
        setSummary(summaryRes.data.data);
        setLocations(locRes.data.data);
      } catch (err) {
        console.error('Failed to fetch attendance matrix');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header & Controls */}
        <SlideIn direction="down">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-4 md:p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-colors">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight">
                <CalendarCheck className="mr-3 text-amber-600" size={28} /> Staff <span className="ml-2 text-amber-600">Attendance</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Track daily attendance for all branches.</p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-gray-200 dark:border-zinc-700 cursor-pointer hover:border-amber-500/50 transition-colors"
              >
                <div className="p-2 text-gray-400"><Calendar size={18} /></div>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 pr-3 cursor-pointer"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2 bg-gray-50 dark:bg-zinc-800 p-1.5 rounded-xl border border-gray-200 dark:border-zinc-700">
                <div className="p-2 text-gray-400"><MapPin size={18} /></div>
                <select
                  className="bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 pr-8 appearance-none"
                  value={filters.locationId}
                  onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}
                >
                  <option value="All">All Locations</option>
                  {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-green-500 transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Present Today</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{attendance.filter(a => a.status === 'present').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.2}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 border-l-4 border-l-red-500 transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Absent Today</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{attendance.filter(a => a.status === 'absent').length}</p>
            </div>
          </SlideIn>
          <SlideIn delay={0.3}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Total Presents (Month)</p>
              <p className="text-3xl font-black text-green-600 mt-1">
                {Array.isArray(summary)
                  ? summary.reduce((acc, s) => acc + (Number(s.totalPresentDays) || 0), 0)
                  : 0}
              </p>
            </div>
          </SlideIn>
          <SlideIn delay={0.4}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Total Absents (Month)</p>
              <p className="text-3xl font-black text-red-600 mt-1">
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
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Daily Distribution</h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Real-time status breakdown</p>
                </div>
                <PieIcon size={20} className="text-amber-500" />
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
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100 italic">{attendance.length}</span>
                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Staff Members</span>
                </div>
              </div>
            </div>
          </SlideIn>

          {/* Monthly Historical Trends */}
          <SlideIn delay={0.6}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Historical Trends</h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Monthly presence vs absence</p>
                </div>
                <Activity size={20} className="text-blue-500" />
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
                    <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="absent" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>
        </div>

        {/* Attendance Table */}
        <SlideIn direction="up" delay={0.5}>
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Daily Logs</h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <th className="px-6 py-4">Staff Member</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="4" className="px-6 py-8"><div className="h-4 bg-gray-100 dark:bg-zinc-800 rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : attendance.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">No attendance records found for this date.</td>
                    </tr>
                  ) : (
                    attendance.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-zinc-300 mr-3 uppercase">
                              {record.user?.name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{record.user?.name || 'Unknown'}</p>
                              <p className="text-[10px] font-medium text-gray-500">
                                {record.user?.role === 'location_admin' || record.user?.role === 'branch_admin' ? 'Branch Admin' : record.user?.role?.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-600 dark:text-zinc-400">{record.locationName}</span>
                        </td>
                        <td className="px-6 py-4">
                          {record.status === 'present' ? (
                            <div className="flex items-center text-green-600 font-bold text-xs uppercase tracking-tighter">
                              <CheckCircle2 size={14} className="mr-1" /> Present
                            </div>
                          ) : (
                            <div className="flex items-center text-red-600 font-bold text-xs uppercase tracking-tighter">
                              <XCircle size={14} className="mr-1" /> Absent
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-gray-500 dark:text-zinc-500">{record.markedBy?.name || 'Auto'}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
