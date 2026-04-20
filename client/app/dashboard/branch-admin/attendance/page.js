'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { CalendarCheck, UserCheck, UserX, CheckCircle2, XCircle, Clock, Calendar, Search } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function AttendancePage() {
  const dateInputRef = useRef(null);
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [staffRes, attRes] = await Promise.all([
          api.get('/users'),
          api.get(`/attendance/branch?date=${date}`)
        ]);
        setStaff(staffRes.data.data.filter(u => u.role === 'staff'));
        setAttendance(attRes.data.data);
      } catch (error) {
        toast.error('Failed to sync roster');
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
    const loadToast = toast.loading(`Authorizing status: ${status}...`);
    try {
      await api.post('/attendance/mark', { userId, date, status });
      const attRes = await api.get(`/attendance/branch?date=${date}`);
      setAttendance(attRes.data.data);
      toast.success('Roster synchronized', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
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
                <CalendarCheck className="mr-4 text-amber-600" size={36} /> Daily <span className="ml-3 text-amber-600">Roster</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Synchronize staff presence and operational availability.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter Roster..."
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
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Personnel Identity</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status Matrix</th>
                  <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Action Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                {loading && staff.length === 0 ? (
                  [1,2,3,4].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="3" className="px-8 py-8"><div className="h-6 bg-gray-100 dark:bg-zinc-800 rounded-xl w-full"></div></td>
                    </tr>
                  ))
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center justify-center opacity-30">
                        <UserX size={48} className="mb-4" />
                        <p className="font-black text-xs uppercase tracking-widest">No personnel matching search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((user, idx) => {
                    const status = getAttendanceStatus(user._id);
                    return (
                      <tr key={user._id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
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
                                className={`px-5 py-2 inline-flex text-[10px] font-black uppercase tracking-[0.15em] rounded-xl border shadow-sm ${
                                  status === 'present' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:border-green-500/20' :
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
                                onClick={() => handleMarkAttendance(user._id, btn.id)}
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
    </PageTransition>
  );
}
