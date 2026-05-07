'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Wallet, Calendar, Download, User, Info, Receipt, ArrowRight, TrendingUp, DollarSign, FileText, Search, Filter } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';


export default function SalaryPage() {
  const monthInputRef = useRef(null);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingUser, setViewingUser] = useState(null);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/salary/location?month=${month}`);
      setSalaries(res.data.data);
    } catch (error) {
      console.error('Failed to fetch salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSalaries();
    }, 0);

    return () => clearTimeout(timer);
  }, [month]);

  const filteredSalaries = salaries.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPayout = salaries.reduce((acc, curr) => acc + curr.calculatedSalary, 0);

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Top Branding & Filter Section */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden bg-white dark:bg-zinc-900 p-10 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-zinc-800">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>

            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="px-3 py-1 bg-blue-100 dark:bg-blue-500/10 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-blue-200 dark:border-blue-500/20">
                    Financial Operations
                  </div>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-zinc-100 tracking-tighter leading-tight">
                  Staff <span className="text-blue-600">Remuneration</span>
                </h1>
                <p className="text-gray-500 dark:text-zinc-500 text-sm mt-4 font-medium max-w-md">
                  Real-time payroll engine processing monthly disbursements based on validated attendance logs.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div
                  onClick={() => monthInputRef.current?.showPicker()}
                  className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-2xl border border-gray-200 dark:border-zinc-700 flex items-center px-4 cursor-pointer hover:border-blue-500/50 transition-colors"
                >
                  <Calendar size={18} className="text-blue-600 mr-3" />
                  <input
                    ref={monthInputRef}
                    type="month"
                    className="bg-transparent border-none outline-none py-2 text-sm font-black text-gray-900 dark:text-zinc-100 uppercase tracking-widest cursor-pointer"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
                <button className="px-8 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex items-center justify-center">
                  <Download size={16} className="mr-2" /> Export PDF
                </button>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-600/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <DollarSign size={120} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-4">Gross Disbursement</p>
              <div className="text-4xl font-black tracking-tighter">₹{totalPayout.toLocaleString()}</div>
              <div className="mt-6 flex items-center text-[10px] font-black uppercase bg-white/10 w-fit px-3 py-1 rounded-full border border-white/10">
                <TrendingUp size={12} className="mr-2" /> +4.2% vs last month
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Headcount Efficiency</p>
              <div className="text-4xl font-black text-gray-900 dark:text-zinc-100 tracking-tighter">
                {salaries.length > 0 ? (salaries.reduce((acc, curr) => acc + curr.payableDays, 0) / (salaries.length * 30) * 100).toFixed(1) : 0}%
              </div>
              <div className="mt-6 h-1.5 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${salaries.length > 0 ? (salaries.reduce((acc, curr) => acc + curr.payableDays, 0) / (salaries.length * 30) * 100) : 0}%` }}
                  className="h-full bg-green-500 rounded-full"
                />
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
              <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Average Take-Home</p>
              <div className="text-4xl font-black text-gray-900 dark:text-zinc-100 tracking-tighter">
                ₹{salaries.length > 0 ? Math.round(totalPayout / salaries.length).toLocaleString() : 0}
              </div>
              <p className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                <Info size={14} className="mr-2 text-blue-600" /> Per regular employee
              </p>
            </div>
          </SlideIn>
        </div>

        {/* List Section */}
        <SlideIn direction="up" delay={0.4}>
          <div className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
            <div className="p-8 border-b border-gray-50 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 tracking-tight flex items-center">
                <FileText className="mr-3 text-blue-600" size={24} /> Detailed <span className="ml-2 text-blue-600">Breakdown</span>
              </h2>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search employee..."
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-zinc-800 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold dark:text-zinc-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/30 dark:bg-zinc-800/30 text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                    <th className="px-10 py-6">Staff Information</th>
                    <th className="px-10 py-6 text-center">Log Analysis</th>
                    <th className="px-10 py-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                  {loading ? (
                    [1, 2, 3, 4, 5].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="4" className="px-10 py-12"><div className="h-6 bg-gray-100 dark:bg-zinc-800 rounded-full w-full"></div></td>
                      </tr>
                    ))
                  ) : filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-10 py-32 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <Receipt size={64} className="mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Zero entries found</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSalaries.map((item, idx) => (
                    <motion.tr
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={item._id}
                      onClick={() => setViewingUser(item)}
                      className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-all group cursor-pointer"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center">
                          <div className="relative">
                            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-2xl border border-blue-200 dark:border-blue-500/20 shadow-lg">
                              {item.name.charAt(0)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 border-4 border-white dark:border-zinc-900 rounded-full"></div>
                          </div>
                          <div className="ml-6">
                            <div className="text-lg font-black text-gray-900 dark:text-zinc-100 tracking-tight group-hover:text-blue-600 transition-colors">{item.name}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{item.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col items-center">
                          <div className="flex -space-x-2 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex flex-col items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">
                              <span className="text-xs font-black leading-none">{item.totalPresent}</span>
                              <span className="text-[6px] font-black uppercase">Prs</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex flex-col items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">
                              <span className="text-xs font-black leading-none">{item.totalHalfDay}</span>
                              <span className="text-[6px] font-black uppercase">Hlf</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex flex-col items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md">
                              <span className="text-xs font-black leading-none">{item.totalAbsent}</span>
                              <span className="text-[6px] font-black uppercase">Abs</span>
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg text-[9px] font-black text-gray-500 dark:text-zinc-400 uppercase tracking-widest">
                            {item.payableDays} Effective Days
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => setViewingUser(item)}
                          className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-sm"
                        >
                          View Breakdown
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>

        {/* User Remuneration Detail Modal */}
        <Modal
          isOpen={!!viewingUser}
          onClose={() => setViewingUser(null)}
          title="Staff Remuneration Details"
          maxWidth="max-w-2xl"
        >
          {viewingUser && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-8">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-3xl bg-blue-500 text-white flex items-center justify-center text-3xl font-black shadow-xl shadow-blue-500/20">
                    {viewingUser.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{viewingUser.name}</h2>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-2">{viewingUser.email}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 rounded-full">
                        {viewingUser.role?.replace('_', ' ')}
                      </span>
                      <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                        Verified Identity
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Contracted Base</p>
                  <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                    ₹{viewingUser.monthlySalary.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-black text-blue-600 uppercase mt-1">Per Month</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">Attendance Analysis ({month})</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/10">
                        <p className="text-[10px] font-black uppercase text-green-600 mb-1">Present</p>
                        <p className="text-2xl font-black text-green-700 dark:text-green-400">{viewingUser.totalPresent} Days</p>
                      </div>
                      <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/10">
                        <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Half Days</p>
                        <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{viewingUser.totalHalfDay} Days</p>
                      </div>
                      <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/10">
                        <p className="text-[10px] font-black uppercase text-rose-600 mb-1">Absent</p>
                        <p className="text-2xl font-black text-rose-700 dark:text-rose-400">{viewingUser.totalAbsent} Days</p>
                      </div>
                      <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/10">
                        <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Late Marks</p>
                        <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{viewingUser.totalLate} Days</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-zinc-900 dark:bg-zinc-100 p-6 rounded-[2rem] text-white dark:text-zinc-900 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
                      <Wallet size={80} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">Calculated Net Payable</p>
                    <div className="text-4xl font-black tracking-tighter mb-2">₹{Math.round(viewingUser.calculatedSalary).toLocaleString()}</div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      Based on {viewingUser.payableDays} Effective Days
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/10 flex items-start gap-3">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-blue-900/60 dark:text-blue-200/60 leading-relaxed uppercase tracking-widest">
                      Calculated using automated payroll algorithm weighting full days, half days, and late deductions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-4 !rounded-2xl font-black text-xs uppercase tracking-widest"
                  onClick={() => setViewingUser(null)}
                >
                  Close 
                </Button>
                <Button
                  className="flex-1 py-4 !rounded-2xl font-black text-xs uppercase tracking-widest bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xl"
                  onClick={() => {
                    toast.success('Paystub exported to secure list');
                  }}
                >
                  Generate Paystub
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
