'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { CalendarCheck, UserCheck, UserX, CheckCircle2, XCircle, Clock, Calendar, Search, Mail, Phone, MapPin, CreditCard, Hash, Globe, Info, Award, ShieldAlert } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { TableSkeleton } from '@/app/components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';

export default function AttendancePage() {
  const dateInputRef = useRef(null);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingStaff, setViewingStaff] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const isInitial = !didInitRef.current;
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
      try {
        const [staffRes, attRes] = await Promise.all([
          api.get('/users'),
          api.get(`/attendance/location?date=${date}`)
        ]);
        setStaff(staffRes.data.data.filter(u => u.role === 'staff'));
        setAttendance(attRes.data.data);
      } catch (error) {
        toast.error('Could not load staff. Please try again.');
      } finally {
        didInitRef.current = true;
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    };
    fetchData();
  }, [date]);

  const getAttendanceStatus = (userId) => {
    const record = attendance.find(a => (a.user?._id || a.user) === userId);
    return record ? record.status : 'unmarked';
  };

  const handleMarkAttendance = async (userId, status) => {
    const loadToast = toast.loading(`Marking as ${status}...`);
    try {
      await api.post('/attendance/mark', { userId, date, status });
      const attRes = await api.get(`/attendance/location?date=${date}`);
      setAttendance(attRes.data.data);
      toast.success('Attendance updated', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
    }
  };

  const filteredStaff = staff.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-8 rounded-xl shadow-sm border border-[var(--color-border)] dark:border-[var(--color-border)] gap-6">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] flex items-center tracking-tight leading-none">
                <CalendarCheck className="mr-4 text-[var(--color-primary)]" size={36} /> Staff <span className="ml-3 text-[var(--color-primary)]">Attendance</span>
              </h1>
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] text-sm mt-2 font-medium">Track staff presence and availability.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
                <input
                  type="text"
                  placeholder="Search staff..."
                  className="w-full pl-11 pr-4 py-4 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 border-none focus:ring-2 focus:ring-[var(--color-primary)] text-xs font-bold dark:text-[var(--color-text-primary)] outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center space-x-3 bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-primary-hover)] transition-all w-full sm:w-auto"
              >
                <Calendar className="text-[var(--color-primary)]" size={20} />
                <input
                  ref={dateInputRef}
                  type="date"
                  className="bg-transparent outline-none text-xs font-bold text-[var(--color-text-primary)] pr-4 cursor-pointer"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] shadow-sm rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--color-surface-soft)]/50 dark:bg-[var(--color-surface)]/50 border-b border-[var(--color-border)] dark:border-[var(--color-border)]">
                  <th className="px-8 py-6 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Staff Details</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal text-center">Status</th>
                  <th className="px-8 py-6 text-right text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] dark:divide-[var(--color-border)]">
                {refetching ? (
                  <tr>
                    <td colSpan="3" className="px-8 py-8">
                      <TableSkeleton rows={6} cols={3} />
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <UserX size={48} className="mb-4" />
                        <p className="font-bold text-xs uppercase tracking-normal">No staff found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((user, idx) => {
                    const status = getAttendanceStatus(user._id);
                    return (
                      <tr
                        key={user._id}
                        onClick={() => setViewingStaff(user)}
                        className="hover:bg-[var(--color-surface-soft)]/50 dark:hover:bg-[var(--color-surface)]/30 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center">
                            <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center font-bold text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                              {user.name.charAt(0)}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight">{user.name}</div>
                              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={status}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`px-5 py-2 inline-flex text-[10px] font-bold uppercase tracking-normal rounded-xl border shadow-sm ${status === 'present' ? 'bg-[rgba(var(--color-success-rgb),0.12)] text-[var(--color-success)] border-[var(--color-success)] dark:bg-[var(--color-success)]/10 dark:border-[var(--color-success)]/20' :
                                  status === 'absent' ? 'bg-[rgba(var(--color-danger-rgb),0.12)] text-[var(--color-danger)] border-[var(--color-danger)] dark:bg-[var(--color-danger)]/10 dark:border-[var(--color-danger)]/20' :
                                    status === 'half-day' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-primary)] dark:bg-[var(--color-primary)]/10 dark:border-[var(--color-primary)]/20' :
                                      'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)] dark:bg-[var(--color-surface)] dark:border-[var(--color-border)]'
                                  }`}
                              >
                                {status}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end space-x-3">
                            {[
                              { id: 'present', icon: CheckCircle2, label: 'Present', active: 'bg-[var(--color-success)] text-white border-[var(--color-success)]', inactive: 'text-[var(--color-success)] bg-[rgba(var(--color-success-rgb),0.12)] hover:bg-[var(--color-success)] hover:text-white' },
                              { id: 'half-day', icon: Clock, label: 'Half', active: 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]', inactive: 'text-[var(--color-primary)] bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary)] hover:text-white' },
                              { id: 'absent', icon: XCircle, label: 'Absent', active: 'bg-[var(--color-danger)] text-white border-[var(--color-danger)]', inactive: 'text-[var(--color-danger)] bg-[rgba(var(--color-danger-rgb),0.12)] hover:bg-[var(--color-danger)] hover:text-white' },
                            ].map(btn => (
                              <motion.button
                                key={btn.id}
                                whileHover={{ y: -2 }}
                                whileTap={{ y: 0 }}
                                onClick={(e) => { e.stopPropagation(); handleMarkAttendance(user._id, btn.id); }}
                                className={`flex items-center px-5 py-3 rounded-xl text-[9px] font-bold uppercase tracking-normal border transition-all shadow-sm ${status === btn.id ? btn.active : btn.inactive}`}
                              >
                                <btn.icon size={14} className="mr-2" />
                                <span className="hidden lg:inline">{btn.label}</span>
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
      </div>

      {/* Detailed Staff Details Modal */}
      <Modal
        isOpen={!!viewingStaff}
        onClose={() => setViewingStaff(null)}
        title="Staff Details"
        maxWidth="max-w-3xl"
      >
        {viewingStaff && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 pb-8 border-b border-[var(--color-border)] dark:border-[var(--color-border)]">
              <div className="relative group">
                <div className="h-32 w-32 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)] text-white flex items-center justify-center text-5xl font-bold shadow-sm  transition-transform">
                  {viewingStaff.name.charAt(0)}
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-[var(--color-success)] border-4 border-[var(--color-border)] dark:border-[var(--color-border)] rounded-full flex items-center justify-center text-white">
                  <UserCheck size={14} />
                </div>
              </div>

              <div className="text-center md:text-left flex-1">
                <h2 className="text-4xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight leading-none">{viewingStaff.name}</h2>
                <p className="text-sm font-bold text-[var(--color-text-muted)] mt-2 flex items-center justify-center md:justify-start gap-2">
                  <Mail size={14} className="text-[var(--color-primary)]" /> {viewingStaff.email}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                  <span className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal rounded-full border border-[var(--color-primary)]/20">
                    {viewingStaff.role}
                  </span>
                  <span className="px-3 py-1 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-normal rounded-full">
                    ID: {viewingStaff._id.slice(-6).toUpperCase()}
                  </span>
                  <span className="px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-[10px] font-bold uppercase tracking-normal rounded-full">
                    Active
                  </span>
                </div>
              </div>

              <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-6 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] text-right min-w-[180px]">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-1">Monthly Salary</p>
                <p className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight">₹{viewingStaff.monthlySalary?.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <CreditCard size={14} className="text-[var(--color-primary)]" /> Staff Details
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex items-center gap-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <Hash className="text-[var(--color-primary)]" size={20} />
                      <div>
                        <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal">Aadhar Number</p>
                        <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{viewingStaff.aadharNumber || 'Not Provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <Phone className="text-[var(--color-primary)]" size={20} />
                      <div>
                        <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal">Primary Contact</p>
                        <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{viewingStaff.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <Award className="text-[var(--color-primary)]" size={20} />
                      <div>
                        <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal">Highest Qualification</p>
                        <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{viewingStaff.highestQualification}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <Globe size={14} className="text-[var(--color-primary)]" /> Staff Information
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal mb-1">Age</p>
                      <p className="text-lg font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{viewingStaff.age} Years</p>
                    </div>
                    <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <p className="text-[8px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal mb-1">Gender</p>
                      <p className="text-lg font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{viewingStaff.gender}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <MapPin size={14} className="text-[var(--color-primary)]" /> Address
                  </h3>
                  <div className="bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-6 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                    <p className="text-sm font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] leading-relaxed">
                      {viewingStaff.address1}<br />
                      {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                      {viewingStaff.city}, {viewingStaff.state}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <Info size={14} className="text-[var(--color-primary)]" /> Aadhar Card
                  </h3>
                  {viewingStaff.aadharImage ? (
                    <div className="group relative rounded-xl overflow-hidden border border-[var(--color-border)] dark:border-[var(--color-border)] bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] aspect-video">
                      <img
                        src={viewingStaff.aadharImage}
                        alt="Aadhar Card"
                        className="w-full h-full object-cover transition-transform duration-700"
                      />
                      <a
                        href={viewingStaff.aadharImage}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 "
                      >
                        <Globe size={24} className="text-[var(--color-primary)]" />
                        <span className="font-bold text-[10px] uppercase tracking-normal">View Full Image</span>
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] dark:border-[var(--color-border)] p-10 flex flex-col items-center justify-center text-[var(--color-text-muted)] aspect-video">
                      <ShieldAlert size={32} className="mb-2 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-normal text-center">Aadhar Scan Missing</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-[var(--color-border)] dark:border-[var(--color-border)] flex gap-4">
              <Button
                variant="outline"
                className="flex-1 py-5 !rounded-xl font-bold text-xs uppercase tracking-normal"
                onClick={() => setViewingStaff(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageTransition>
  );
}
