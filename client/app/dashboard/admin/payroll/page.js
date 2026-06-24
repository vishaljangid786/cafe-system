'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { Wallet, Filter, MapPin, ChevronRight, Download, Receipt, PieChart as PieIcon, Activity, FileText, Target, X } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import ExportActions from '../../../components/ui/ExportActions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { CardSkeleton } from '@/app/components/ui/Skeleton';

export default function PayrollRecordsPage() {
  const monthInputRef = useRef(null);
  const [salaries, setSalaries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [locations, setLocations] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [viewingSalary, setViewingSalary] = useState(null);
  const [activeTab, setActiveTab] = useState('staff'); // 'staff', 'chef', 'branch_admin', 'admin'
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '', email: '', phone: '', monthlySalary: '', role: '', address1: ''
  });
  const router = useRouter();
  const { user: currentUser } = useAuth();

  // Only admins/super-admins (or staff explicitly granted payroll/staff access)
  // may view payroll records. A dead `const { user } = api` previously made this
  // guard a no-op.
  useEffect(() => {
    if (currentUser && !['super_admin', 'admin'].includes(currentUser.role) && !currentUser.permissions?.manageStaff) {
      toast.error('Access denied. Admin permission required.');
      router.push('/dashboard');
    }
  }, [currentUser, router]);


  useEffect(() => {
    const fetchData = async () => {
      const isInitial = !didInitRef.current;
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
      try {
        const [salRes, locRes, payRes] = await Promise.all([
          api.get(`/salary/all?month=${month}&locationId=${selectedLocation === 'All' ? '' : locations.find(l => l.name === selectedLocation)?._id || ''}&role=${activeTab}&search=${searchQuery}&page=${page}&limit=10`),
          api.get('/locations'),
          api.get(`/salary/payroll/history?month=${month}`)
        ]);
        
        const mergedSalaries = salRes.data.data.map(s => {
          const payroll = payRes.data.data?.find(p => p.user?._id === s._id);
          return { ...s, payrollRecord: payroll };
        });

        setSalaries(mergedSalaries);
        setStats({
          totalPayroll: salRes.data.totalPayrollCost,
          locationTotals: salRes.data.locationTotals
        });
        if (salRes.data.pagination) setPagination(salRes.data.pagination);
        setLocations(locRes.data.data);
      } catch (err) {
        console.error('Failed to fetch records');
      } finally {
        didInitRef.current = true;
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    };
    fetchData();
  }, [month, selectedLocation, activeTab, searchQuery, page]);

  const filteredSalaries = salaries; // Now filtered by backend

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface)/60  shadow-sm transition-colors">
            <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-primary/20 hidden" />
            <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-secondary/10 hidden" />

            <div className="relative p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-end 2xl:justify-between">
                <div className="min-w-0 2xl:flex-1">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-normal text-primary-dark dark:text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary " />
                    Salary Management
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-(--color-surface-soft) text-primary shadow-sm  border border-(--color-border)">
                      <Wallet size={28} strokeWidth={2.5} />
                    </div>

                    <div className="min-w-0">
                      <h1 className="text-3xl font-bold leading-tight tracking-tight text-(--color-text-primary) sm:text-4xl">
                        Salary <span className="text-primary-dark dark:text-primary">History</span>
                      </h1>
                      <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-(--color-text-secondary)">
                        <Target size={15} className="mt-0.5 shrink-0 text-primary-dark dark:text-primary" />
                        <span>Manage payouts, staff compensation, and branch-wise salary history for the selected cycle.</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 2xl:w-auto 2xl:min-w-165">
                  {/* Search */}
                  <div className="relative group">
                    <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                      Search
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) transition-colors group-focus-within:text-primary">
                        <Activity size={17} />
                      </div>
                      <input
                          type="text"
                          placeholder="Search staff..."
                          className="h-[54px] w-full rounded-xl border border-(--color-border) bg-(--color-bg-soft)/80 py-4 pl-12 pr-4 text-sm font-bold text-(--color-text-primary) outline-none transition-all placeholder:text-(--color-text-muted) focus:border-primary focus:bg-(--color-surface) focus:ring-4 focus:ring-primary/10"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                          }}
                      />
                    </div>
                  </div>

                  {/* Month Picker */}
                  <div>
                    <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                      Month
                    </label>
                    <div
                        onClick={() => monthInputRef.current?.showPicker()}
                        className="flex h-[54px] cursor-pointer items-center rounded-xl border border-(--color-border) bg-(--color-bg-soft)/80 px-4 transition-all hover:border-primary/50 focus-within:border-primary focus-within:bg-(--color-surface) focus-within:ring-4 focus-within:ring-primary/10"
                    >
                      <input
                          ref={monthInputRef}
                          type="month"
                          className="w-full cursor-pointer border-none bg-transparent text-sm font-bold text-(--color-text-primary) outline-none"
                          value={month}
                          onChange={(e) => {
                            setMonth(e.target.value);
                            setPage(1);
                          }}
                      />
                    </div>
                  </div>

                  <PremiumSelect
                      label="Location"
                      value={selectedLocation}
                      onChange={(val) => {
                        setSelectedLocation(val);
                        setPage(1);
                      }}
                      options={[
                        { label: 'All Locations', value: 'All' },
                        ...locations.map(l => ({ label: l.name, value: l.name }))
                      ]}
                  />
                </div>
              </div>

              {/* Role Tabs Integrated for Alignment */}
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-(--color-border) pt-8">
                {[
                  { id: 'staff', label: 'Staff' },
                  { id: 'chef', label: 'Chefs' },
                  { id: 'branch_admin', label: 'Branch Admins' },
                  { id: 'admin', label: 'Main Admins' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPage(1);
                    }}
                    className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all border ${
                      activeTab === tab.id 
                        ? `bg-(--color-text-primary) text-(--color-bg-base) border-transparent shadow-sm  scale-105` 
                        : `bg-(--color-surface)/50 text-(--color-text-muted) border-(--color-border) hover:border-primary/30`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

             
              <div className="mt-6 flex flex-col gap-4 border-t border-(--color-border) pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-(--color-border) bg-(--color-surface)/70 px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">Salary History</p>
                    <p className="mt-1 text-sm font-bold text-(--color-text-primary)">
                      {filteredSalaries.length} Staff
                    </p>
                  </div>

                  <div className="rounded-xl border border-(--color-border) bg-(--color-surface)/70 px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">Cycle</p>
                    <p className="mt-1 text-sm font-bold text-(--color-text-primary)">
                      {month}
                    </p>
                  </div>

                   <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-normal text-primary-dark dark:text-primary">
                      Scope
                    </p>
                    <p className="mt-1 text-sm font-bold text-primary-dark dark:text-primary">
                      {selectedLocation === 'All' ? 'All Branches' : selectedLocation}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <button
                    onClick={async () => {
                      const loadToast = toast.loading("Calculating salaries...");
                      try {
                        const locObj = locations.find(l => l.name === selectedLocation);
                        await api.post('/salary/generate', { month, locationId: locObj?._id || 'all' });
                        toast.success("Salary details saved successfully", { id: loadToast });
                        setTimeout(() => window.location.reload(), 1000);
                      } catch (e) {
                        toast.error("Something went wrong. Please try again.", { id: loadToast });
                      }
                    }}
                    className="h-[54px] px-6 py-3 bg-(--color-text-primary) text-(--color-bg-base) font-bold text-xs uppercase tracking-normal rounded-xl transition-all  shadow-md "
                  >
                    Calculate Monthly Salary
                  </button>

                  <ExportActions
                      data={filteredSalaries}
                      columns={[
                        { header: 'Employee', key: 'name' },
                        { header: 'Email', key: 'email' },
                        { header: 'Location', key: 'locationName' },
                        { header: 'Role', key: 'role' },
                        { header: 'Monthly Salary', key: 'monthlySalary' },
                        { header: 'Payable Days', key: 'payableDays' },
                        { header: 'Calculated Payout', key: 'calculatedSalary' }
                      ]}
                      filename={`payroll_${month}`}
                      hasCharts={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-primary p-6 rounded-xl shadow-lg  text-(--color-bg-base) h-full">
              <p className="text-xs font-bold uppercase tracking-normal opacity-80">Total Salary Payout</p>
              <p className="text-3xl font-bold mt-1">₹{filteredSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0).toLocaleString()}</p>
              <div className="mt-4 flex items-center text-xs font-medium opacity-90">
                <Receipt size={14} className="mr-1" /> {selectedLocation === 'All' ? 'All Branches Total' : `${selectedLocation} Total`}
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-(--color-surface)/40  p-6 rounded-xl shadow-sm border border-(--color-border) h-full transition-colors">
              <p className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Avg Salary / Employee</p>
              <p className="text-3xl font-bold text-(--color-text-primary) mt-1">
                ₹{filteredSalaries.length > 0 ? (filteredSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0) / filteredSalaries.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-(--color-surface)/40  p-6 rounded-xl shadow-sm border border-(--color-border) h-full transition-colors">
              <p className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Staff Count</p>
              <p className="text-3xl font-bold text-(--color-text-primary) mt-1">{filteredSalaries.length}</p>
            </div>
          </SlideIn>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SlideIn delay={0.4}>
            <div className="export-chart bg-(--color-surface)/40  p-8 rounded-xl border border-(--color-border) shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-(--color-text-primary) tracking-tight">
                    {selectedLocation === 'All' ? 'Branch Breakdown' : 'Staff Breakdown'}
                  </h2>
                  <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-1">
                    {selectedLocation === 'All' ? 'Payroll weight by location' : `Salary weights in ${selectedLocation}`}
                  </p>
                </div>
                <PieIcon size={20} className="text-primary" />
              </div>
              <div className="h-75 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={selectedLocation === 'All'
                        ? (stats?.locationTotals ? Object.entries(stats.locationTotals).map(([name, total]) => ({ name, value: total })) : [])
                        : filteredSalaries.map(s => ({ name: s.name, value: s.calculatedSalary }))
                      }
                      cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value"
                    >
                      {filteredSalaries.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-danger)', 'var(--color-primary-dark)'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.5}>
            <div className="export-chart bg-(--color-surface)/40  p-8 rounded-xl border border-(--color-border) shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-(--color-text-primary) tracking-tight">
                    {selectedLocation === 'All' ? 'Comparative Cost' : 'Individual Payouts'}
                  </h2>
                  <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-1">
                    {selectedLocation === 'All' ? 'Direct salary payout comparison' : `Top earners in ${selectedLocation}`}
                  </p>
                </div>
                <Activity size={20} className="text-primary" />
              </div>
              <div className="h-75 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedLocation === 'All'
                    ? (stats?.locationTotals ? Object.entries(stats.locationTotals).map(([name, total]) => ({ name, value: total })) : [])
                    : filteredSalaries.slice(0, 8).map(s => ({ name: s.name.split(' ')[0], value: s.calculatedSalary }))
                  }>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--color-text-muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--color-text-muted)' }} />
                    <Tooltip cursor={{ fill: 'var(--color-surface-soft)' }} />
                    <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={selectedLocation === 'All' ? 40 : 20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>
        </div>

        <SlideIn direction="up" delay={0.4}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {refetching ? (
              [1, 2, 3, 4, 5, 6].map(i => (
                <CardSkeleton key={i} />
              ))
            ) : filteredSalaries.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3 py-20 text-center bg-(--color-surface-soft)/40 rounded-xl border border-dashed border-(--color-border) flex flex-col items-center justify-center">
                <div className="h-20 w-20 rounded-xl bg-(--color-surface-soft) flex items-center justify-center text-(--color-text-muted) mb-6">
                  <Receipt size={40} strokeWidth={1} />
                </div>
                <p className="text-(--color-text-muted) font-bold text-lg tracking-tight">No salary history found.</p>
                <p className="text-(--color-text-muted) text-xs mt-2 font-medium">Try adjusting your filters or time range.</p>
              </div>
            ) : (
              filteredSalaries.map((s, idx) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  key={s._id}
                  className="bg-(--color-surface)/40  p-6 rounded-xl border border-(--color-border) flex flex-col justify-between group hover:border-primary/40 transition-all shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary-dark dark:text-primary flex items-center justify-center text-xl font-bold border border-primary/20 shadow-inner transition-transform">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-(--color-text-primary) text-base leading-tight">{s.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">{s.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-normal px-2.5 py-1 bg-primary/10 text-primary-dark dark:text-primary rounded-lg">
                        {(s.role === 'location_admin' || s.role === 'branch_admin') ? 'Branch Admin' : s.role?.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-y border-(--color-border) py-4 my-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Location</p>
                        <p className="text-sm font-bold text-(--color-text-secondary)">{s.locationName || 'Unassigned'}</p>
                      </div>
                      {['staff', 'chef'].includes(activeTab) && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Working Days</p>
                          <p className="text-sm font-bold text-(--color-text-secondary)">
                            <span className="text-primary-dark dark:text-primary">{s.payableDays}</span> / {s.daysInMonth || 30}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <button
                      onClick={() => {
                        setEditingUser(s);
                        setEditFormData({
                          name: s.name, email: s.email, phone: s.phone || '',
                          monthlySalary: s.monthlySalary || '', role: s.role, address1: s.address1 || ''
                        });
                      }}
                      className="flex-1 py-3 text-[10px] font-bold uppercase tracking-normal bg-(--color-surface-soft) hover:bg-primary hover:text-(--color-bg-base) text-(--color-text-muted) rounded-xl transition-colors"
                    >
                      {['staff', 'chef'].includes(activeTab) ? 'Edit Profile' : 'Update'}
                    </button>

                    {['staff', 'chef'].includes(activeTab) ? (
                      <div className="flex gap-2 flex-1">
                         {s.payrollRecord && (
                            <button
                              onClick={async () => {
                                const loadToast = toast.loading("Approving salary...");
                                try {
                                  await api.patch(`/salary/payroll/${s.payrollRecord._id}/approve`);
                                  toast.success("Salary approved", { id: loadToast });
                                  setTimeout(() => window.location.reload(), 1000);
                                } catch (e) {
                                  toast.error(e.response?.data?.message || "Something went wrong. Please try again.", { id: loadToast });
                                }
                              }}
                              className="flex-1 py-3 text-[10px] font-bold uppercase tracking-normal bg-success text-(--color-bg-base) hover:bg-success/90 rounded-xl transition-all text-center"
                            >
                              Approve
                            </button>
                         )}
                        <button
                          onClick={() => setViewingSalary(s)}
                          className="flex-1 py-3 text-[10px] font-bold uppercase tracking-normal bg-(--color-text-primary) text-(--color-bg-base) hover:bg-primary hover:text-(--color-bg-base) rounded-xl transition-colors text-center"
                        >
                          View
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUser(s);
                          setEditFormData({
                            name: s.name, email: s.email, phone: s.phone || '',
                            monthlySalary: s.monthlySalary || '', role: s.role, address1: s.address1 || ''
                          });
                        }}
                        className="flex-1 py-3 text-[10px] font-bold uppercase tracking-normal bg-(--color-text-primary) text-(--color-bg-base) hover:bg-primary hover:text-(--color-bg-base) rounded-xl transition-colors"
                      >
                        View Profile
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </SlideIn>

        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-4 py-6">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-3 rounded-xl bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) disabled:opacity-30 hover:text-primary transition-all shadow-sm"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-10 w-10 rounded-xl font-bold text-xs transition-all ${page === p
                      ? 'bg-primary text-(--color-bg-base) shadow-lg  scale-105'
                      : 'bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) hover:text-primary'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              className="p-3 rounded-xl bg-(--color-surface) border border-(--color-border) text-(--color-text-muted) disabled:opacity-30 hover:text-primary transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {viewingSalary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-(--color-bg-deep)/60 ">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-(--color-surface) w-full max-w-lg rounded-xl shadow-sm overflow-hidden border border-(--color-border)"
            >
              <div className="p-8 border-b border-(--color-border) flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-(--color-text-primary)">Payroll <span className="text-primary">Breakdown</span></h3>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">{month} Cycle</p>
                </div>
                <button onClick={() => setViewingSalary(null)} className="h-10 w-10 rounded-full bg-(--color-surface-soft) flex items-center justify-center text-(--color-text-muted) hover:text-danger transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border)">
                  <div className="h-12 w-12 rounded-xl bg-primary text-(--color-bg-base) flex items-center justify-center text-xl font-bold">
                    {viewingSalary.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-(--color-text-primary)">{viewingSalary.name}</p>
                    <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">
                      {viewingSalary.role === 'location_admin' || viewingSalary.role === 'branch_admin' ? 'Branch Admin' : viewingSalary.role?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                    <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Fixed Salary</p>
                    <p className="text-xl font-bold text-(--color-text-primary)">₹{viewingSalary.monthlySalary?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                    <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Payable Days</p>
                    <p className="text-xl font-bold text-(--color-text-primary)">{viewingSalary.payableDays} <span className="text-[10px] text-(--color-text-muted)">/ {viewingSalary.daysInMonth}</span></p>
                  </div>
                </div>

                {viewingSalary.payrollRecord && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success">
                      <p className="text-[10px] font-bold uppercase tracking-normal mb-1 opacity-80">Total Bonuses</p>
                      <p className="text-xl font-bold">
                        + ₹{((viewingSalary.payrollRecord.bonuses?.topSeller || 0) + (viewingSalary.payrollRecord.bonuses?.performance || 0)).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger">
                      <p className="text-[10px] font-bold uppercase tracking-normal mb-1 opacity-80">Total Penalties</p>
                      <p className="text-xl font-bold">
                        - ₹{((viewingSalary.payrollRecord.penalties?.lateMark || 0) + (viewingSalary.payrollRecord.penalties?.absent || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-6 rounded-xl bg-primary text-(--color-bg-base) shadow-sm ">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-normal opacity-80">Final Net Payout</span>
                    <span className="px-2 py-0.5 bg-(--color-bg-base)/20 rounded-md text-[8px] font-bold uppercase">{viewingSalary.payrollRecord?.status?.replace(/_/g, ' ') || 'Calculated'}</span>
                  </div>
                  <p className="text-4xl font-bold tracking-tight">
                    ₹{(viewingSalary.payrollRecord?.netSalary || viewingSalary.calculatedSalary || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              <div className="p-8 bg-(--color-surface-soft)/30 border-t border-(--color-border) flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    const s = viewingSalary;
                    const pr = s.payrollRecord;
                    const bonus = pr ? ((pr.bonuses?.topSeller || 0) + (pr.bonuses?.performance || 0)) : 0;
                    const penalty = pr ? ((pr.penalties?.lateMark || 0) + (pr.penalties?.absent || 0)) : 0;
                    const net = (s.monthlySalary || 0) + bonus - penalty;
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(`<html><head><title>Payslip - ${s.name}</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:600px;margin:auto}h2{margin:0 0 4px}p{margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}.total{font-weight:bold;font-size:1.1em}</style></head><body><h2>Payslip</h2><p><b>Employee:</b> ${s.name}</p><p><b>Role:</b> ${s.role}</p><p><b>Month:</b> ${s.month || ''}</p><p><b>Days:</b> ${s.payableDays || 0} / ${s.daysInMonth || 30}</p><table><tr><th>Component</th><th>Amount</th></tr><tr><td>Base Salary</td><td>₹${(s.monthlySalary || 0).toLocaleString()}</td></tr>${bonus ? `<tr><td>Bonus</td><td>+₹${bonus.toLocaleString()}</td></tr>` : ''}${penalty ? `<tr><td>Deductions</td><td>-₹${penalty.toLocaleString()}</td></tr>` : ''}<tr class="total"><td>Net Payable</td><td>₹${net.toLocaleString()}</td></tr></table></body></html>`);
                    printWindow.document.close();
                    setTimeout(() => printWindow.print(), 500);
                  }}
                  className="flex-1 py-4 rounded-xl bg-(--color-surface) text-(--color-text-primary) text-xs font-bold uppercase tracking-normal border border-(--color-border) shadow-sm transition-all hover:bg-(--color-surface-soft)"
                >
                  Print Payslip
                </button>

                <button
                  onClick={() => setViewingSalary(null)}
                  className="flex-1 py-4 rounded-xl bg-(--color-text-primary) text-(--color-bg-base) text-xs font-bold uppercase tracking-normal transition-all  shadow-sm "
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-(--color-bg-deep)/60 ">
             <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-lg bg-(--color-surface) rounded-xl p-10 border border-(--color-border) shadow-sm"
            >
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center text-2xl font-bold text-(--color-bg-base) shadow-lg ">
                      {editingUser.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-(--color-text-primary) tracking-tight leading-none">{editingUser.name}</h2>
                      <p className="text-[10px] font-bold uppercase text-primary-dark dark:text-primary tracking-normal mt-2">Edit Details</p>
                    </div>
                 </div>
                 <button onClick={() => setEditingUser(null)} className="p-2 rounded-full hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-colors">
                   <X size={24} />
                 </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const loadToast = toast.loading("Updating user profile...");
                try {
                  await api.put(`/users/${editingUser._id || editingUser.userId}`, editFormData);
                  toast.success("Profile updated successfully", { id: loadToast });
                  setEditingUser(null);
                  window.location.reload();
                } catch (error) {
                  toast.error("Update failed", { id: loadToast });
                }
              }} className="space-y-6">
                 <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Full Name</label>
                      <input className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Monthly Salary (₹)</label>
                      <input type="number" className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" value={editFormData.monthlySalary} onChange={e => setEditFormData({...editFormData, monthlySalary: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Contact</label>
                        <input className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Role</label>
                        <input disabled className="w-full px-5 py-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-bold text-(--color-text-muted) outline-none opacity-60" value={editFormData.role} />
                      </div>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 rounded-xl bg-(--color-surface-soft) text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Cancel</button>
                    <button type="submit" className="flex-1 py-4 rounded-xl bg-(--color-text-primary) text-(--color-bg-base) text-xs font-bold uppercase tracking-normal shadow-sm ">Update Profile</button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
