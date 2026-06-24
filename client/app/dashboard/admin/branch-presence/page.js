'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { 
  CalendarCheck, MapPin, CheckCircle2, XCircle, 
  Activity, Search, Users, ChevronRight, 
  ArrowLeft, Clock, TrendingUp
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';

export default function BranchPresencePage() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const dateInputRef = useRef(null);
  const didInitRef = useRef(false);

  const fetchLocations = async () => {
    progress.start();
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (err) {
      toast.error('Could not load branches. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      progress.done();
    }
  };

  const fetchBranchData = async () => {
    setRefetching(true);
    progress.start();
    try {
      const [staffRes, attRes] = await Promise.all([
        api.get(`/users?locationId=${selectedLocation._id}`),
        api.get(`/attendance/location?locationId=${selectedLocation._id}&date=${date}`)
      ]);
      setStaff(staffRes.data.data.filter(u => u.role === 'staff' || u.role === 'chef'));
      setAttendance(attRes.data.data);
    } catch (err) {
      toast.error('Could not load branch details. Please try again.');
    } finally {
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchBranchData();
    }
  }, [selectedLocation, date]);

  const handleMarkAttendance = async (userId, status) => {
    const loadToast = toast.loading(`Recording ${status}...`);
    try {
      setMarkingLoading(true);
      await api.post('/attendance/mark', { 
        userId, 
        date, 
        status,
        locationId: selectedLocation._id 
      });
      
      // Re-fetch attendance
      const attRes = await api.get(`/attendance/location?locationId=${selectedLocation._id}&date=${date}`);
      setAttendance(attRes.data.data);
      
      toast.success('Attendance recorded', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update attendance. Please try again.', { id: loadToast });
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
      <div className="space-y-10 max-w-400 mx-auto">
        
        {/* Header */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden rounded-xl bg-(--color-surface) p-10 lg:p-14 border border-(--color-border) shadow-sm">
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                {selectedLocation ? (
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="p-4 rounded-xl bg-(--color-bg-soft) text-(--color-text-muted) hover:text-primary transition-all border border-(--color-border)"
                  >
                    <ArrowLeft size={24} />
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <CalendarCheck size={32} />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-(--color-text-primary) tracking-tight leading-none uppercase italic">
                    Branch <span className="text-primary">Presence</span>
                  </h1>
                  <p className="text-(--color-text-muted) font-bold mt-2 tracking-normal uppercase text-[10px]">
                    {selectedLocation ? `Managing ${selectedLocation.name}` : 'Select a branch to mark staff attendance'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div 
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="px-6 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-all"
                >
                  <Clock className="text-primary" size={18} />
                  <input 
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent outline-none text-xs font-bold uppercase tracking-normal text-(--color-text-primary) cursor-pointer"
                  />
                </div>
              </div>
            </div>
            
            {/* Decoration */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
          </div>
        </SlideIn>

        {!selectedLocation ? (
          /* Branch Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {locations.map((loc, idx) => (
              <SlideIn key={loc._id} delay={idx * 0.1}>
                <CardHover>
                  <div 
                    onClick={() => setSelectedLocation(loc)}
                    className="group relative bg-(--color-surface) rounded-xl p-10 border border-(--color-border) cursor-pointer overflow-hidden transition-all hover:shadow-sm"
                  >
                    <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                      <div className="flex justify-between items-start">
                        <div className="p-4 rounded-xl bg-(--color-bg-soft) text-primary border border-(--color-border)">
                          <MapPin size={24} />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Branch ID</span>
                          <p className="text-xs font-bold text-(--color-text-primary)">#{loc._id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>

                      <div>
                        {loc.cafe?.name && (
                          <span className="inline-block text-[9px] font-bold uppercase tracking-normal text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full mb-1">{loc.cafe.name}</span>
                        )}
                        <h3 className="text-3xl font-bold text-(--color-text-primary) tracking-tight italic uppercase">{loc.name}</h3>
                        <p className="text-xs font-medium text-(--color-text-muted) mt-1">{loc.city}, {loc.state}</p>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-(--color-border)">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-primary opacity-40" />
                          <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">View Staff</span>
                        </div>
                        <ChevronRight size={20} className="text-primary group-hover:translate-x-2 transition-transform" />
                      </div>
                    </div>
                    
                    {/* Hover Glow */}
                    <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-[80px] group-hover:bg-primary/20 transition-all" />
                  </div>
                </CardHover>
              </SlideIn>
            ))}
          </div>
        ) : (
          /* Staff Marking Section */
          <div className="space-y-10">
            {/* Quick Filter & Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4">
                <div className="bg-(--color-surface) rounded-xl p-8 border border-(--color-border) h-full">
                  <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <TrendingUp size={14} /> Branch Overview
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 rounded-xl bg-success/10 border border-success/20">
                      <p className="text-[10px] font-bold text-success uppercase tracking-normal">Present</p>
                      <p className="text-3xl font-bold text-success mt-1">{attendance.filter(a => a.status === 'present').length}</p>
                    </div>
                    <div className="p-6 rounded-xl bg-danger/10 border border-danger/20">
                      <p className="text-[10px] font-bold text-danger uppercase tracking-normal">Absent</p>
                      <p className="text-3xl font-bold text-danger mt-1">{attendance.filter(a => a.status === 'absent').length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="bg-(--color-surface) rounded-xl p-8 border border-(--color-border) flex items-center gap-6 h-full">
                  <div className="flex-1 relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={20} />
                    <input 
                      type="text"
                      placeholder="Filter staff by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-16 pr-6 py-6 rounded-xl bg-(--color-bg-soft) border-2 border-transparent focus:border-primary/30 outline-none text-sm font-bold transition-all"
                    />
                  </div>
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total Staff</span>
                    <p className="text-2xl font-bold text-(--color-text-primary)">{staff.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Staff List */}
            <SlideIn direction="up">
              <div className="bg-(--color-surface) rounded-xl border border-(--color-border) overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-(--color-surface-soft) text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) border-b border-(--color-border)">
                        <th className="px-10 py-7">Staff Member</th>
                        <th className="px-10 py-7 text-center">Status</th>
                        <th className="px-10 py-7 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--color-border)">
                      {refetching ? (
                        <tr>
                          <td colSpan="3" className="px-10 py-8">
                            <TableSkeleton rows={6} cols={3} />
                          </td>
                        </tr>
                      ) : filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-10 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-30">
                              <Users size={48} />
                              <p className="text-xs font-bold uppercase tracking-normal">No staff found for this branch</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((user) => {
                          const status = getAttendanceStatus(user._id);
                          return (
                            <tr key={user._id} className="hover:bg-primary/[0.02] transition-colors group">
                              <td className="px-10 py-8">
                                <div className="flex items-center">
                                  <div className="h-14 w-14 rounded-[1.2rem] bg-(--color-bg-soft) flex items-center justify-center font-bold text-xl text-primary border border-(--color-border) transition-transform">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="ml-5">
                                    <p className="text-lg font-bold text-(--color-text-primary) tracking-tight leading-none">{user.name}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-bold uppercase tracking-normal rounded border border-primary/20">
                                        {user.role}
                                      </span>
                                      <span className="text-[10px] font-bold text-(--color-text-muted)">{user.email}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-10 py-8">
                                <div className="flex justify-center">
                                  <AnimatePresence mode="wait">
                                    <motion.span
                                      key={status}
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-normal rounded-xl border shadow-sm ${
                                        status === 'present' ? 'bg-[rgba(var(--color-success-rgb),0.12)] text-success border-success' :
                                        status === 'absent' ? 'bg-[rgba(var(--color-danger-rgb),0.12)] text-danger border-danger' :
                                        status === 'half-day' ? 'bg-(--color-primary-soft) text-primary border-primary' :
                                        'bg-(--color-bg-soft) text-(--color-text-muted) border-(--color-border)'
                                      }`}
                                    >
                                      {status}
                                    </motion.span>
                                  </AnimatePresence>
                                </div>
                              </td>
                              <td className="px-10 py-8">
                                <div className="flex justify-end gap-3">
                                  {[
                                    { id: 'present', icon: CheckCircle2, label: 'Present', color: 'bg-success' },
                                    { id: 'half-day', icon: Clock, label: 'Half', color: 'bg-primary' },
                                    { id: 'absent', icon: XCircle, label: 'Absent', color: 'bg-danger' }
                                  ].map(btn => (
                                    <motion.button
                                      key={btn.id}
                                      whileHover={{ y: -2 }}
                                      whileTap={{ scale: 0.95 }}
                                      disabled={markingLoading}
                                      onClick={() => handleMarkAttendance(user._id, btn.id)}
                                      className={`px-6 py-4 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all border flex items-center gap-2 ${
                                        status === btn.id 
                                          ? `${btn.color} text-white border-transparent shadow-sm` 
                                          : 'bg-(--color-bg-soft) text-(--color-text-muted) border-(--color-border) hover:border-primary'
                                      }`}
                                    >
                                      <btn.icon size={16} />
                                      <span className="hidden xl:inline">{btn.label}</span>
                                    </motion.button>
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
          </div>
        )}
      </div>
    </PageTransition>
  );
}
