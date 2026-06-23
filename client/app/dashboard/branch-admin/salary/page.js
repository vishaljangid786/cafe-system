'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Wallet, Calendar, Download, User, Info, Receipt, ArrowRight, TrendingUp, DollarSign, FileText, Search, Filter } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { AlertCircle } from 'lucide-react';
import { TableSkeleton } from '@/app/components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import toast from 'react-hot-toast';


export default function SalaryPage() {
  const { selectedLocation } = useAuth();
  const monthInputRef = useRef(null);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const [error, setError] = useState('');

  const fetchSalaries = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      // Scope to the branch chosen in the global Navbar switcher. When "all
      // assigned branches" is active (selectedLocation null) we omit locationId
      // and the backend aggregates across every branch this admin manages.
      const params = new URLSearchParams({ month });
      const branchId = selectedLocation?._id || selectedLocation;
      if (branchId && branchId !== 'all') params.append('locationId', branchId);
      const res = await api.get(`/salary/location?${params.toString()}`);
      setSalaries(Array.isArray(res.data.data) ? res.data.data : []);
      setError('');
    } catch (error) {
      console.error('Failed to fetch salaries:', error);
      setSalaries([]);
      setError('Could not load salary records. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSalaries();
    }, 0);

    return () => clearTimeout(timer);
  }, [month, selectedLocation]);

  const filteredSalaries = salaries.filter(s =>
    (s?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPayout = salaries.reduce((acc, curr) => acc + (Number(curr?.calculatedSalary) || 0), 0);

  // Real client-side CSV export (no backend salary-export endpoint exists).
  const downloadCsv = (rows, filename) => {
    if (!rows || rows.length === 0) { toast.error('Nothing to export'); return; }
    const headers = ['Name', 'Email', 'Role', 'Present', 'Half Days', 'Absent', 'Payable Days', 'Monthly Salary', 'Calculated Salary'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    rows.forEach((r) => lines.push([
      r.name, r.email, r.role, r.totalPresent, r.totalHalfDay, r.totalAbsent,
      r.payableDays, r.monthlySalary, Math.round(Number(r.calculatedSalary) || 0),
    ].map(esc).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Top Branding & Filter Section */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden bg-(--color-surface) dark:bg-(--color-surface) p-10 rounded-xl shadow-sm border border-(--color-border) dark:border-(--color-border)">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>

            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="px-3 py-1 bg-(--color-primary-soft) text-primary rounded-full text-[10px] font-bold uppercase tracking-normal border border-[rgba(var(--color-primary-rgb),0.2)]">
                    Salary
                  </div>
                </div>
                <h1 className="text-4xl lg:text-5xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight leading-tight">
                  Staff <span className="text-primary">Salary</span>
                </h1>
                <p className="text-(--color-text-muted) dark:text-(--color-text-muted) text-sm mt-4 font-medium max-w-md">
                  Monthly salary worked out from each staff member&apos;s attendance.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div
                  onClick={() => monthInputRef.current?.showPicker()}
                  className="bg-(--color-surface-soft) dark:bg-(--color-surface) p-2 rounded-xl border border-(--color-border) dark:border-(--color-border) flex items-center px-4 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Calendar size={18} className="text-primary mr-3" />
                  <input
                    ref={monthInputRef}
                    type="month"
                    className="bg-transparent border-none outline-none py-2 text-sm font-bold text-(--color-text-primary) dark:text-(--color-text-primary) uppercase tracking-normal cursor-pointer"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => downloadCsv(filteredSalaries, `salary-${month}.csv`)}
                  className="px-8 py-4 bg-(--color-surface-soft) text-(--color-text-primary) border border-(--color-border) rounded-xl font-bold text-xs uppercase tracking-normal  transition-all shadow-sm flex items-center justify-center"
                >
                  <Download size={16} className="mr-2" /> Export CSV
                </button>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-primary p-8 rounded-xl text-white shadow-sm  relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform">
                <DollarSign size={120} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-normal opacity-70 mb-4">Total Salary Payout</p>
              <div className="text-4xl font-bold tracking-tight">₹{totalPayout.toLocaleString()}</div>
              <div className="mt-6 flex items-center text-[10px] font-bold uppercase bg-white/10 w-fit px-3 py-1 rounded-full border border-(--color-border)">
                <TrendingUp size={12} className="mr-2" /> {salaries.length} staff this month
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-(--color-surface) dark:bg-(--color-surface) p-8 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm relative overflow-hidden">
              <p className="text-[10px] font-bold text-(--color-text-muted) dark:text-(--color-text-muted) uppercase tracking-normal mb-4">Average Attendance</p>
              <div className="text-4xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">
                {salaries.length > 0 ? (salaries.reduce((acc, curr) => acc + (Number(curr?.payableDays) || 0), 0) / (salaries.length * 30) * 100).toFixed(1) : 0}%
              </div>
              <div className="mt-6 h-1.5 w-full bg-(--color-surface-soft) dark:bg-(--color-surface) rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${salaries.length > 0 ? (salaries.reduce((acc, curr) => acc + (Number(curr?.payableDays) || 0), 0) / (salaries.length * 30) * 100) : 0}%` }}
                  className="h-full bg-success rounded-full"
                />
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-(--color-surface) dark:bg-(--color-surface) p-8 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm relative overflow-hidden">
              <p className="text-[10px] font-bold text-(--color-text-muted) dark:text-(--color-text-muted) uppercase tracking-normal mb-4">Average Salary</p>
              <div className="text-4xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">
                ₹{salaries.length > 0 ? Math.round(totalPayout / salaries.length).toLocaleString() : 0}
              </div>
              <p className="mt-6 text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center">
                <Info size={14} className="mr-2 text-primary" /> Per staff member
              </p>
            </div>
          </SlideIn>
        </div>

        {/* List Section */}
        <SlideIn direction="up" delay={0.4}>
          <div className="bg-(--color-surface) dark:bg-(--color-surface) rounded-xl shadow-sm border border-(--color-border) dark:border-(--color-border) overflow-hidden">
            <div className="p-8 border-b border-(--color-border) dark:border-(--color-border) flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight flex items-center">
                <FileText className="mr-3 text-primary" size={24} /> Salary <span className="ml-2 text-primary">Details</span>
              </h2>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={16} />
                <input
                  type="text"
                  placeholder="Search staff..."
                  className="w-full pl-12 pr-4 py-3 bg-(--color-surface-soft) dark:bg-(--color-surface) rounded-xl border-none focus:ring-2 focus:ring-primary outline-none text-xs font-bold dark:text-(--color-text-muted)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-(--color-surface-soft)/30 dark:bg-(--color-surface)/30 text-[10px] font-bold text-(--color-text-muted) dark:text-(--color-text-muted) uppercase tracking-normal">
                    <th className="px-10 py-6">Staff Member</th>
                    <th className="px-10 py-6 text-center">Attendance</th>
                    <th className="px-10 py-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border) dark:divide-(--color-border)/50">
                  {refetching ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-6">
                        <TableSkeleton rows={6} cols={3} />
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan="4" className="px-10 py-32 text-center">
                        <div className="flex flex-col items-center text-danger">
                          <AlertCircle size={64} className="mb-4 opacity-60" />
                          <p className="text-sm font-bold uppercase tracking-normal">{error}</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-10 py-32 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <Receipt size={64} className="mb-4" />
                          <p className="text-sm font-bold uppercase tracking-normal">No staff found</p>
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
                      className="hover:bg-(--color-surface-soft)/50 dark:hover:bg-(--color-surface)/20 transition-all group cursor-pointer"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center">
                          <div className="relative">
                            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center text-primary dark:text-primary font-bold text-2xl border border-[rgba(var(--color-primary-rgb),0.2)] shadow-lg">
                              {item.name?.charAt(0) || '?'}
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-success border-4 border-(--color-border) dark:border-(--color-border) rounded-full"></div>
                          </div>
                          <div className="ml-6">
                            <div className="text-lg font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight group-hover:text-primary transition-colors">{item.name}</div>
                            <div className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-1">{item.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex flex-col items-center">
                          <div className="flex -space-x-2 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-success text-white flex flex-col items-center justify-center border-2 border-(--color-border) dark:border-(--color-border) shadow-md">
                              <span className="text-xs font-bold leading-none">{item.totalPresent}</span>
                              <span className="text-[6px] font-bold uppercase">Prs</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-primary text-white flex flex-col items-center justify-center border-2 border-(--color-border) dark:border-(--color-border) shadow-md">
                              <span className="text-xs font-bold leading-none">{item.totalHalfDay}</span>
                              <span className="text-[6px] font-bold uppercase">Hlf</span>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-danger text-white flex flex-col items-center justify-center border-2 border-(--color-border) dark:border-(--color-border) shadow-md">
                              <span className="text-xs font-bold leading-none">{item.totalAbsent}</span>
                              <span className="text-[6px] font-bold uppercase">Abs</span>
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-(--color-surface-soft) dark:bg-(--color-surface) rounded-lg text-[9px] font-bold text-(--color-text-muted) dark:text-(--color-text-muted) uppercase tracking-normal">
                            {item.payableDays} Payable Days
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button 
                          onClick={() => setViewingUser(item)}
                          className="px-6 py-3 bg-(--color-surface-soft) text-(--color-text-primary) border border-(--color-border) rounded-xl text-[10px] font-bold uppercase tracking-normal hover:bg-primary transition-all shadow-sm"
                        >
                          View Details
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
          title="Staff Salary Details"
          maxWidth="max-w-2xl"
        >
          {viewingUser && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between gap-6 border-b border-(--color-border) dark:border-(--color-border) pb-8">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-xl bg-primary text-white flex items-center justify-center text-3xl font-bold shadow-sm ">
                    {viewingUser.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight leading-none">{viewingUser.name}</h2>
                    <p className="text-xs font-bold text-(--color-text-muted) uppercase tracking-normal mt-2">{viewingUser.email}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-3 py-1 bg-(--color-surface-soft) dark:bg-(--color-surface) text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) rounded-full">
                        {viewingUser.role?.replace('_', ' ')}
                      </span>
                      <span className="px-3 py-1 bg-success/10 text-success text-[10px] font-bold uppercase tracking-normal rounded-full">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Base Salary</p>
                  <p className="text-3xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">
                    ₹{(Number(viewingUser.monthlySalary) || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] font-bold text-primary uppercase mt-1">Per Month</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-4">Attendance ({month})</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-success/10 p-4 rounded-xl border border-success/10">
                        <p className="text-[10px] font-bold uppercase text-success mb-1">Present</p>
                        <p className="text-2xl font-bold text-success dark:text-success">{viewingUser.totalPresent} Days</p>
                      </div>
                      <div className="bg-primary/10 p-4 rounded-xl border border-primary/10">
                        <p className="text-[10px] font-bold uppercase text-primary mb-1">Half Days</p>
                        <p className="text-2xl font-bold text-primary dark:text-primary">{viewingUser.totalHalfDay} Days</p>
                      </div>
                      <div className="bg-danger/10 p-4 rounded-xl border border-danger/10">
                        <p className="text-[10px] font-bold uppercase text-danger mb-1">Absent</p>
                        <p className="text-2xl font-bold text-danger dark:text-danger">{viewingUser.totalAbsent} Days</p>
                      </div>
                      <div className="bg-primary/10 p-4 rounded-xl border border-primary/10">
                        <p className="text-[10px] font-bold uppercase text-primary mb-1">Payable Days</p>
                        <p className="text-2xl font-bold text-primary dark:text-primary">{viewingUser.payableDays ?? 0} Days</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-(--color-surface) dark:bg-(--color-surface-soft) p-6 rounded-xl text-(--color-text-primary) shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform">
                      <Wallet size={80} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-normal opacity-60 mb-4">Net Salary Payable</p>
                    <div className="text-4xl font-bold tracking-tight mb-2">₹{Math.round(Number(viewingUser.calculatedSalary) || 0).toLocaleString()}</div>
                    <p className="text-[10px] font-bold uppercase tracking-normal opacity-60">
                      Based on {viewingUser.payableDays} Payable Days
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-(--color-primary-soft) border border-primary/50 dark:border-primary/10 flex items-start gap-3">
                    <Info size={16} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-primary/60 dark:text-primary/60 leading-relaxed uppercase tracking-normal">
                      Worked out from full days, half days, and late deductions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-(--color-border) dark:border-(--color-border) flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 py-4 !rounded-xl font-bold text-xs uppercase tracking-normal"
                  onClick={() => setViewingUser(null)}
                >
                  Close 
                </Button>
                <Button
                  className="flex-1 py-4 !rounded-xl font-bold text-xs uppercase tracking-normal bg-(--color-surface-soft) text-(--color-text-primary) border border-(--color-border) shadow-sm"
                  onClick={() => downloadCsv([viewingUser], `salary-slip-${(viewingUser.name || 'staff').replace(/\s+/g, '-')}-${month}.csv`)}
                >
                  Download Salary Slip
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
