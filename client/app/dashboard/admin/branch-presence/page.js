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

export default function BranchPresencePage() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingLoading, setMarkingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const dateInputRef = useRef(null);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load branches');
    }
  };

  const fetchBranchData = async () => {
    try {
      setLoading(true);
      const [staffRes, attRes] = await Promise.all([
        api.get(`/users?locationId=${selectedLocation._id}`),
        api.get(`/attendance/location?locationId=${selectedLocation._id}&date=${date}`)
      ]);
      setStaff(staffRes.data.data.filter(u => u.role === 'staff' || u.role === 'chef'));
      setAttendance(attRes.data.data);
    } catch (err) {
      toast.error('Failed to load branch records');
    } finally {
      setLoading(false);
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
      toast.error(error.response?.data?.message || 'Failed to update status', { id: loadToast });
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

  if (loading && locations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="animate-spin text-[var(--color-primary)]" size={40} />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-10 max-w-[1600px] mx-auto">
        
        {/* Header */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden rounded-[3rem] bg-[var(--color-surface)] p-10 lg:p-14 border border-[var(--color-border)] shadow-2xl">
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6">
                {selectedLocation ? (
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="p-4 rounded-2xl bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all border border-[var(--color-border)]"
                  >
                    <ArrowLeft size={24} />
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                    <CalendarCheck size={32} />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl lg:text-5xl font-black text-[var(--color-text-primary)] tracking-tighter leading-none uppercase italic">
                    Branch <span className="text-[var(--color-primary)]">Presence</span>
                  </h1>
                  <p className="text-[var(--color-text-muted)] font-bold mt-2 tracking-widest uppercase text-[10px]">
                    {selectedLocation ? `Managing ${selectedLocation.name} Operations` : 'Select a branch to control staff attendance'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div 
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="px-6 py-4 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] flex items-center gap-3 cursor-pointer hover:border-[var(--color-primary)]/40 transition-all"
                >
                  <Clock className="text-[var(--color-primary)]" size={18} />
                  <input 
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent outline-none text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)] cursor-pointer"
                  />
                </div>
              </div>
            </div>
            
            {/* Decoration */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[var(--color-primary)]/5 to-transparent pointer-events-none" />
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
                    className="group relative bg-[var(--color-surface)] rounded-[2.5rem] p-10 border border-[var(--color-border)] cursor-pointer overflow-hidden transition-all hover:shadow-2xl hover:shadow-[var(--color-primary)]/10"
                  >
                    <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                      <div className="flex justify-between items-start">
                        <div className="p-4 rounded-2xl bg-[var(--color-bg-soft)] text-[var(--color-primary)] border border-[var(--color-border)]">
                          <MapPin size={24} />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Control ID</span>
                          <p className="text-xs font-bold text-[var(--color-text-primary)]">#{loc._id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-3xl font-black text-[var(--color-text-primary)] tracking-tight italic uppercase">{loc.name}</h3>
                        <p className="text-xs font-medium text-[var(--color-text-muted)] mt-1">{loc.city}, {loc.state}</p>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-[var(--color-primary)] opacity-40" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">View Staff</span>
                        </div>
                        <ChevronRight size={20} className="text-[var(--color-primary)] group-hover:translate-x-2 transition-transform" />
                      </div>
                    </div>
                    
                    {/* Hover Glow */}
                    <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[var(--color-primary)]/10 rounded-full blur-[80px] group-hover:bg-[var(--color-primary)]/20 transition-all" />
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
                <div className="bg-[var(--color-surface)] rounded-[2.5rem] p-8 border border-[var(--color-border)] h-full">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <TrendingUp size={14} /> Branch Overview
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20">
                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Present</p>
                      <p className="text-3xl font-black text-green-600 mt-1">{attendance.filter(a => a.status === 'present').length}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Absent</p>
                      <p className="text-3xl font-black text-red-600 mt-1">{attendance.filter(a => a.status === 'absent').length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8">
                <div className="bg-[var(--color-surface)] rounded-[2.5rem] p-8 border border-[var(--color-border)] flex items-center gap-6 h-full">
                  <div className="flex-1 relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={20} />
                    <input 
                      type="text"
                      placeholder="Filter staff by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-16 pr-6 py-6 rounded-[2rem] bg-[var(--color-bg-soft)] border-2 border-transparent focus:border-[var(--color-primary)]/30 outline-none text-sm font-bold transition-all"
                    />
                  </div>
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Total Staff</span>
                    <p className="text-2xl font-black text-[var(--color-text-primary)]">{staff.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Staff List */}
            <SlideIn direction="up">
              <div className="bg-[var(--color-surface)] rounded-[3rem] border border-[var(--color-border)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[var(--color-surface-soft)] text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                        <th className="px-10 py-7">Staff Member</th>
                        <th className="px-10 py-7 text-center">Marking Status</th>
                        <th className="px-10 py-7 text-right">Command Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {loading ? (
                        [1,2,3].map(i => (
                          <tr key={i} className="animate-pulse">
                            <td colSpan="3" className="px-10 py-10"><div className="h-10 bg-[var(--color-bg-soft)] rounded-2xl w-full" /></td>
                          </tr>
                        ))
                      ) : filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-10 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-30">
                              <Users size={48} />
                              <p className="text-xs font-black uppercase tracking-widest">No staff found for this branch</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((user) => {
                          const status = getAttendanceStatus(user._id);
                          return (
                            <tr key={user._id} className="hover:bg-[var(--color-primary)]/[0.02] transition-colors group">
                              <td className="px-10 py-8">
                                <div className="flex items-center">
                                  <div className="h-14 w-14 rounded-[1.2rem] bg-[var(--color-bg-soft)] flex items-center justify-center font-black text-xl text-[var(--color-primary)] border border-[var(--color-border)] group-hover:scale-105 transition-transform">
                                    {user.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="ml-5">
                                    <p className="text-lg font-black text-[var(--color-text-primary)] tracking-tight leading-none">{user.name}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[8px] font-black uppercase tracking-widest rounded border border-[var(--color-primary)]/20">
                                        {user.role}
                                      </span>
                                      <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{user.email}</span>
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
                                      className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border shadow-sm ${
                                        status === 'present' ? 'bg-green-50 text-green-600 border-green-200' :
                                        status === 'absent' ? 'bg-red-50 text-red-600 border-red-200' :
                                        status === 'half-day' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        'bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]'
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
                                    { id: 'present', icon: CheckCircle2, label: 'Present', color: 'bg-green-600' },
                                    { id: 'half-day', icon: Clock, label: 'Half', color: 'bg-blue-500' },
                                    { id: 'absent', icon: XCircle, label: 'Absent', color: 'bg-red-600' }
                                  ].map(btn => (
                                    <motion.button
                                      key={btn.id}
                                      whileHover={{ y: -2 }}
                                      whileTap={{ scale: 0.95 }}
                                      disabled={markingLoading}
                                      onClick={() => handleMarkAttendance(user._id, btn.id)}
                                      className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                                        status === btn.id 
                                          ? `${btn.color} text-white border-transparent shadow-xl` 
                                          : 'bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
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
