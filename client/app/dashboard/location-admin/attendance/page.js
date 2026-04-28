'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { CalendarCheck, UserCheck, UserX, CheckCircle2, XCircle, Clock, Calendar, Search, Mail, Phone, MapPin, CreditCard, Hash, Globe, Info, Award, ShieldAlert } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

export default function AttendancePage() {
  const dateInputRef = useRef(null);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingStaff, setViewingStaff] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [staffRes, attRes] = await Promise.all([
          api.get('/users'),
          api.get(`/attendance/location?date=${date}`)
        ]);
        setStaff(staffRes.data.data.filter(u => u.role === 'staff'));
        setAttendance(attRes.data.data);
      } catch (error) {
        toast.error('Failed to load staff');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [date]);

  const getAttendanceStatus = (userId) => {
    const record = attendance.find(a => (a.user?._id || a.user) === userId);
    return record ? record.status : 'unmarked';
  };

  const handleMarkAttendance = async (userId, status) => {
    const loadToast = toast.loading(`Setting status: ${status}...`);
    try {
      await api.post('/attendance/mark', { userId, date, status });
      const attRes = await api.get(`/attendance/location?date=${date}`);
      setAttendance(attRes.data.data);
      toast.success('Attendance updated', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error', { id: loadToast });
    }
  };

  const filteredStaff = staff.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <CalendarCheck className="mr-4 text-amber-600" size={36} /> Staff <span className="ml-3 text-amber-600">Attendance</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Track staff presence and availability.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search Staff..."
                  className="w-full pl-11 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 text-xs font-bold dark:text-zinc-100 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div
                onClick={() => dateInputRef.current?.showPicker()}
                className="flex items-center space-x-3 bg-zinc-900 dark:bg-zinc-800 p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-black transition-all w-full sm:w-auto"
              >
                <Calendar className="text-amber-500" size={20} />
                <input
                  ref={dateInputRef}
                  type="date"
                  className="bg-transparent outline-none text-xs font-black text-white pr-4 cursor-pointer"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="bg-white dark:bg-zinc-900 shadow-sm rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-50 dark:border-zinc-800">
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Staff Details</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {loading && staff.length === 0 ? (
                  [1, 2, 3, 4].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="3" className="px-8 py-8"><div className="h-6 bg-gray-100 dark:bg-zinc-800 rounded-xl w-full"></div></td>
                    </tr>
                  ))
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <UserX size={48} className="mb-4" />
                        <p className="font-black text-xs uppercase tracking-widest">No staff found</p>
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
                        className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center">
                            <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center font-black text-amber-600 border border-amber-200/20">
                              {user.name.charAt(0)}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-black text-gray-900 dark:text-zinc-100 tracking-tight">{user.name}</div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.email}</div>
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
                                className={`px-5 py-2 inline-flex text-[10px] font-black uppercase tracking-[0.15em] rounded-xl border shadow-sm ${status === 'present' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:border-green-500/20' :
                                  status === 'absent' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' :
                                    status === 'half-day' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' :
                                      'bg-gray-100 text-gray-400 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700'
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
                              { id: 'present', icon: CheckCircle2, label: 'Present', active: 'bg-green-600 text-white border-green-600', inactive: 'text-green-600 bg-green-50 dark:bg-green-500/5 hover:bg-green-600 hover:text-white' },
                              { id: 'half-day', icon: Clock, label: 'Half', active: 'bg-amber-500 text-white border-amber-500', inactive: 'text-amber-600 bg-amber-50 dark:bg-amber-500/5 hover:bg-amber-500 hover:text-white' },
                              { id: 'absent', icon: XCircle, label: 'Absent', active: 'bg-red-600 text-white border-red-600', inactive: 'text-red-600 bg-red-50 dark:bg-red-500/5 hover:bg-red-600 hover:text-white' },
                            ].map(btn => (
                              <motion.button
                                key={btn.id}
                                whileHover={{ y: -2 }}
                                whileTap={{ y: 0 }}
                                onClick={(e) => { e.stopPropagation(); handleMarkAttendance(user._id, btn.id); }}
                                className={`flex items-center px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm ${status === btn.id ? btn.active : btn.inactive}`}
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

      {/* Detailed Personnel Details Modal */}
      <Modal
        isOpen={!!viewingStaff}
        onClose={() => setViewingStaff(null)}
        title="Staff Details"
        maxWidth="max-w-3xl"
      >
        {viewingStaff && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 pb-8 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative group">
                <div className="h-32 w-32 rounded-[2.5rem] bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center text-5xl font-black shadow-2xl shadow-amber-500/20 group-hover:scale-105 transition-transform">
                  {viewingStaff.name.charAt(0)}
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-green-500 border-4 border-white dark:border-zinc-950 rounded-full flex items-center justify-center text-white">
                  <UserCheck size={14} />
                </div>
              </div>

              <div className="text-center md:text-left flex-1">
                <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter leading-none">{viewingStaff.name}</h2>
                <p className="text-sm font-bold text-zinc-400 mt-2 flex items-center justify-center md:justify-start gap-2">
                  <Mail size={14} className="text-amber-600" /> {viewingStaff.email}
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/20">
                    {viewingStaff.role}
                  </span>
                  <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                    ID: {viewingStaff._id.slice(-6).toUpperCase()}
                  </span>
                  <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                    Active
                  </span>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 text-right min-w-[180px]">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Monthly Salary</p>
                <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">₹{viewingStaff.monthlySalary?.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                    <CreditCard size={14} className="text-amber-600" /> Identity Credentials
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <Hash className="text-amber-600" size={20} />
                      <div>
                        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Aadhar Number</p>
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.aadharNumber || 'Not Provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <Phone className="text-amber-600" size={20} />
                      <div>
                        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Primary Contact</p>
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <Award className="text-amber-600" size={20} />
                      <div>
                        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Highest Qualification</p>
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{viewingStaff.highestQualification}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                    <Globe size={14} className="text-amber-600" /> Staff Information
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest mb-1">Age</p>
                      <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{viewingStaff.age} Years</p>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                      <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest mb-1">Gender</p>
                      <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">{viewingStaff.gender}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                    <MapPin size={14} className="text-amber-600" /> Address
                  </h3>
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 leading-relaxed">
                      {viewingStaff.address1}<br />
                      {viewingStaff.address2 && <>{viewingStaff.address2}<br /></>}
                      {viewingStaff.city}, {viewingStaff.state}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                    <Info size={14} className="text-amber-600" /> Identity Proof (Aadhar)
                  </h3>
                  {viewingStaff.aadharImage ? (
                    <div className="group relative rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 aspect-video">
                      <img
                        src={viewingStaff.aadharImage}
                        alt="Identity Proof"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <a
                        href={viewingStaff.aadharImage}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-zinc-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-3 backdrop-blur-sm"
                      >
                        <Globe size={24} className="text-amber-500" />
                        <span className="font-black text-[10px] uppercase tracking-widest">View Full Image</span>
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-[2.5rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-10 flex flex-col items-center justify-center text-zinc-400 aspect-video">
                      <ShieldAlert size={32} className="mb-2 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">Identity Scan Missing</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800 flex gap-4">
              <Button
                variant="outline"
                className="flex-1 py-5 !rounded-2xl font-black text-xs uppercase tracking-widest"
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
