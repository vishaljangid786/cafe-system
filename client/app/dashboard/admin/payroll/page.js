'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { blockNegative } from '@/app/utils/inputValidation';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { Wallet, Filter, MapPin, ChevronRight, Download, Receipt, PieChart as PieIcon, Activity, FileText, Target, X } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import ExportActions from '../../../components/ui/ExportActions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import useBranchScope from '../../../hooks/useBranchScope';
import { useCan } from '../../../hooks/usePermissions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { CardSkeleton, StatGridSkeleton, PageHeaderSkeleton } from '@/app/components/ui/Skeleton';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';

export default function PayrollRecordsPage() {
  const monthInputRef = useRef(null);
  const [salaries, setSalaries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [locations, setLocations] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [viewingSalary, setViewingSalary] = useState(null);
  const [adjustingSalary, setAdjustingSalary] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'deduction', amount: '', reason: '' });
  const [activeTab, setActiveTab] = useState('staff'); // 'staff', 'chef', 'branch_admin', 'admin'
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '', email: '', phone: '', monthlySalary: '', role: '', address1: ''
  });
  const router = useRouter();
  const { user: currentUser, selectedCafe, cafes } = useAuth();
  const { singleBranchId } = useBranchScope();
  const canDo = useCan();

  // Single-stage workflow: whoever holds salaries.add can generate the cycle,
  // salaries.modify lets them deduct/bonus a still-pending salary, and whoever
  // holds salaries.approve can finalize & pay.
  const canGenerate = canDo('salaries.add');
  const canApprove = canDo('salaries.approve');
  const canAdjust = canDo('salaries.modify');

  // Admins/super-admins read the cross-branch /salary/all dataset; branch and
  // location admins are not allowed on that endpoint, so they get this same page
  // fed from /salary/location (the server scopes rows to their own branches).
  const isAdminScope = ['admin', 'super_admin'].includes(currentUser?.role);
  // Server-side role/search/page filters only exist on the /salary/all path —
  // the /salary/location path filters client-side, so keep these params inert
  // there (and avoid refetching on every keystroke / tab switch).
  const serverRole = isAdminScope ? activeTab : '';
  const serverSearch = isAdminScope ? searchQuery : '';
  const serverPage = isAdminScope ? page : 1;

  // The focused branch is driven entirely by the global Navbar filter.
  // 'All' = all branches (a multi-branch / cafe subset also resolves to 'All'
  // here; the salary API still scopes it via cafeId and the user's allowed branches).
  const selectedLocation =
    singleBranchId === 'all'
      ? 'All'
      : (locations.find((l) => l._id === singleBranchId)?.name || 'All');
  const selectedCafeName =
    selectedCafe && selectedCafe !== 'all'
      ? (cafes?.find((c) => c._id === selectedCafe)?.name || 'Selected Cafe')
      : null;

  // Admin-level roles (or staff explicitly granted payroll/staff access) may
  // view salary records. Branch/location admins land here too — their old
  // salary pages are thin wrappers around this one, with data still scoped to
  // their own branches by the server. A dead `const { user } = api` previously
  // made this guard a no-op.
  useEffect(() => {
    if (currentUser && !['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(currentUser.role) && !currentUser.permissions?.manageStaff) {
      toast.error('Access denied. Admin permission required.');
      router.push('/dashboard');
    }
  }, [currentUser, router]);


  // Extracted so actions (approve / adjust / update / generate) can refresh the data
  // IN PLACE — after the first load this sets `refetching` (skeletons), never a full
  // window reload.
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      // Branch/location admins can't call /salary/all — they read the same rows
      // from /salary/location (month + optional locationId, exactly what that
      // API already receives). Payroll history is skipped for location_admin
      // (the server route excludes that role) and degrades quietly on 403 so a
      // missing permission never blanks the whole page.
      const [salRes, locRes, payRes] = await Promise.all([
        isAdminScope
          ? api.get(`/salary/all?month=${month}&locationId=${singleBranchId === 'all' ? '' : singleBranchId}&cafeId=${selectedCafe && selectedCafe !== 'all' ? selectedCafe : ''}&role=${serverRole}&search=${serverSearch}&page=${serverPage}&limit=10`)
          : api.get(`/salary/location?${new URLSearchParams(
              singleBranchId === 'all' ? { month } : { month, locationId: singleBranchId }
            ).toString()}`),
        api.get('/locations'),
        currentUser.role === 'location_admin'
          ? Promise.resolve(null)
          : api.get(`/salary/payroll/history?month=${month}`).catch(() => null)
      ]);

      const rows = Array.isArray(salRes.data.data) ? salRes.data.data : [];
      const mergedSalaries = rows.map(s => {
        const payroll = payRes?.data?.data?.find(p => p.user?._id === s._id);
        return { ...s, payrollRecord: payroll };
      });

      setSalaries(mergedSalaries);
      if (isAdminScope) {
        setStats({
          totalPayroll: salRes.data.totalPayrollCost,
          locationTotals: salRes.data.locationTotals
        });
        if (salRes.data.pagination) setPagination(salRes.data.pagination);
      } else {
        // /salary/location has no totals — derive the same shapes client-side
        // so the stat cards and charts keep working for branch-scoped admins.
        setStats({
          totalPayroll: rows.reduce((acc, r) => acc + (r.calculatedSalary || 0), 0),
          locationTotals: rows.reduce((acc, r) => {
            const locName = r.locationName || 'Unassigned';
            acc[locName] = (acc[locName] || 0) + (r.calculatedSalary || 0);
            return acc;
          }, {})
        });
        setPagination({ total: rows.length, pages: 1 });
      }
      setLocations(locRes.data.data);
    } catch (err) {
      console.error('Failed to fetch records');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  }, [month, singleBranchId, serverRole, serverSearch, serverPage, selectedCafe, currentUser, isAdminScope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to the first page whenever the global Navbar scope (cafe/branch) changes.
  useEffect(() => {
    setPage(1);
  }, [selectedCafe, singleBranchId]);

  // /salary/all rows arrive already filtered/paginated by the backend; the
  // /salary/location rows are the whole branch, so apply the tab + search here.
  const filteredSalaries = isAdminScope
    ? salaries
    : salaries.filter(s =>
        s.role === activeTab &&
        (s?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );

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

  const submitAdjustment = async () => {
    const amt = Number(adjustForm.amount);
    if (!['deduction', 'bonus'].includes(adjustForm.type)) return toast.error('Choose deduction or bonus');
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    if (!adjustForm.reason.trim()) return toast.error('A reason is required');
    const loadToast = toast.loading('Applying adjustment...');
    try {
      await api.patch(`/salary/payroll/${adjustingSalary.payrollRecord._id}/adjust`, {
        type: adjustForm.type,
        amount: amt,
        reason: adjustForm.reason.trim(),
      });
      toast.success('Adjustment applied', { id: loadToast });
      setAdjustingSalary(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
    }
  };

  if (loading) return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <StatGridSkeleton count={4} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    </PageTransition>
  );

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
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-normal text-primary-dark dark:text-primary">
                    <span className="h-2 w-2 rounded-full bg-primary " />
                    Salary Management
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-(--color-surface-soft) text-primary shadow-sm  border border-(--color-border)">
                      <Wallet size={16} strokeWidth={2.5} />
                    </div>

                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold leading-tight tracking-tight text-(--color-text-primary) sm:text-3xl">
                        Salary <span className="text-primary-dark dark:text-primary">History</span>
                      </h1>
                      <p className="mt-2 flex items-start gap-2 text-sm font-medium text-(--color-text-secondary)">
                        <Target size={15} className="mt-0.5 shrink-0 text-primary-dark dark:text-primary" />
                        <span>Manage payouts, staff compensation, and branch-wise salary history for the selected cycle.</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 2xl:w-auto 2xl:min-w-165">
                  {/* Search */}
                  <div className="relative group">
                    <label className="mb-2 ml-1 block text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                      Search
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) transition-colors group-focus-within:text-primary">
                        <Activity size={17} />
                      </div>
                      <input
                          type="text"
                          placeholder="Search staff..."
                          className="h-[54px] w-full rounded-xl border border-(--color-border) bg-(--color-bg-soft)/80 py-2.5 pl-12 pr-4 text-sm font-medium text-(--color-text-primary) outline-none transition-all placeholder:text-(--color-text-muted) focus:border-primary focus:bg-(--color-surface) focus:ring-2 focus:ring-primary/10"
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
                    <label className="mb-2 ml-1 block text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                      Month
                    </label>
                    <div
                        onClick={() => monthInputRef.current?.showPicker()}
                        className="flex h-[54px] cursor-pointer items-center rounded-xl border border-(--color-border) bg-(--color-bg-soft)/80 px-4 transition-all hover:border-primary/50 focus-within:border-primary focus-within:bg-(--color-surface) focus-within:ring-2 focus-within:ring-primary/10"
                    >
                      <input
                          ref={monthInputRef}
                          type="month"
                          className="w-full cursor-pointer border-none bg-transparent text-sm font-medium text-(--color-text-primary) outline-none"
                          value={month}
                          onChange={(e) => {
                            setMonth(e.target.value);
                            setPage(1);
                          }}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* Role Tabs Integrated for Alignment */}
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-(--color-border) pt-6">
                {[
                  { id: 'staff', label: 'Staff' },
                  { id: 'chef', label: 'Chefs' },
                  // Branch-level admins only ever see their own staff/chefs
                  // (server hierarchy), so the admin-only tabs are hidden.
                  ...(isAdminScope ? [
                    { id: 'branch_admin', label: 'Branch Admins' },
                    { id: 'admin', label: 'Main Admins' }
                  ] : [])
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setPage(1);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-[11px] font-medium uppercase tracking-normal transition-all border ${
                      activeTab === tab.id
                        ? `bg-(--color-text-primary) text-(--color-bg-base) border-transparent shadow-sm`
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
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Salary History</p>
                    <p className="mt-1 text-sm font-medium text-(--color-text-primary)">
                      {filteredSalaries.length} Staff
                    </p>
                  </div>

                  <div className="rounded-xl border border-(--color-border) bg-(--color-surface)/70 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Cycle</p>
                    <p className="mt-1 text-sm font-medium text-(--color-text-primary)">
                      {month}
                    </p>
                  </div>

                   <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-normal text-primary-dark dark:text-primary">
                      Scope
                    </p>
                    <p className="mt-1 text-sm font-medium text-primary-dark dark:text-primary">
                      {selectedLocation === 'All'
                        ? (selectedCafeName ? `${selectedCafeName} · All Branches` : 'All Branches')
                        : selectedLocation}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  {canGenerate && (
                    <button
                      onClick={async () => {
                        const loadToast = toast.loading("Calculating salaries...");
                        try {
                          const locObj = locations.find(l => l.name === selectedLocation);
                          await api.post('/salary/generate', {
                            month,
                            locationId: locObj?._id || 'all',
                            cafeId: selectedCafe && selectedCafe !== 'all' ? selectedCafe : 'all',
                          });
                          toast.success("Salary details saved successfully", { id: loadToast });
                          fetchData();
                        } catch (e) {
                          toast.error("Something went wrong. Please try again.", { id: loadToast });
                        }
                      }}
                      className="h-[54px] px-5 py-3 bg-(--color-text-primary) text-(--color-bg-base) font-semibold text-xs uppercase tracking-normal rounded-xl transition-all  shadow-sm "
                    >
                      Calculate Monthly Salary
                    </button>
                  )}

                  <ExportActions
                      data={filteredSalaries}
                      columns={[
                        { header: 'Employee', key: 'name' },
                        { header: 'Email', key: 'email' },
                        { header: 'Location', key: 'locationName' },
                        { header: 'Role', key: 'role' },
                        { header: 'Present', key: 'totalPresent' },
                        { header: 'Half Days', key: 'totalHalfDay' },
                        { header: 'Absent', key: 'totalAbsent' },
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-primary p-5 rounded-xl shadow-sm  text-(--color-bg-base) h-full">
              <p className="text-xs font-medium uppercase tracking-normal opacity-80">Total Salary Payout</p>
              <p className="text-2xl font-semibold mt-1"><Money value={filteredSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0)} /></p>
              <div className="mt-4 flex items-center text-xs font-medium opacity-90">
                <Receipt size={14} className="mr-1" /> {selectedLocation === 'All' ? 'All Branches Total' : `${selectedLocation} Total`}
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) h-full transition-colors">
              <p className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted)">Avg Salary / Employee</p>
              <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">
                <Money value={filteredSalaries.length > 0 ? (filteredSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0) / filteredSalaries.length) : 0} decimals={0} />
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.25}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) h-full transition-colors">
              <p className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted)">Average Attendance</p>
              <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">
                {filteredSalaries.length > 0 ? (filteredSalaries.reduce((acc, curr) => acc + (Number(curr?.payableDays) || 0), 0) / (filteredSalaries.length * 30) * 100).toFixed(1) : 0}%
              </p>
              <div className="mt-4 h-1.5 w-full bg-(--color-surface-soft) rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${filteredSalaries.length > 0 ? (filteredSalaries.reduce((acc, curr) => acc + (Number(curr?.payableDays) || 0), 0) / (filteredSalaries.length * 30) * 100) : 0}%` }}
                  className="h-full bg-success rounded-full"
                />
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-(--color-surface)/40  p-5 rounded-xl shadow-sm border border-(--color-border) h-full transition-colors">
              <p className="text-xs font-medium uppercase tracking-normal text-(--color-text-muted)">Staff Count</p>
              <p className="text-2xl font-semibold text-(--color-text-primary) mt-1">{filteredSalaries.length}</p>
            </div>
          </SlideIn>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SlideIn delay={0.4}>
            <div className="export-chart bg-(--color-surface)/40  p-5 rounded-xl border border-(--color-border) shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-(--color-text-primary) tracking-tight">
                    {selectedLocation === 'All' ? 'Branch Breakdown' : 'Staff Breakdown'}
                  </h2>
                  <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal mt-1">
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
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }} formatter={(v) => formatIndianCompact(v, { currency: true })} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.5}>
            <div className="export-chart bg-(--color-surface)/40  p-5 rounded-xl border border-(--color-border) shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-(--color-text-primary) tracking-tight">
                    {selectedLocation === 'All' ? 'Comparative Cost' : 'Individual Payouts'}
                  </h2>
                  <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal mt-1">
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
                    <YAxis axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatIndianCompact(v, { currency: true })} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'var(--color-text-muted)' }} />
                    <Tooltip cursor={{ fill: 'var(--color-surface-soft)' }} formatter={(v) => formatIndianCompact(v, { currency: true })} />
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
                <p className="text-(--color-text-muted) font-medium text-lg tracking-tight">No salary history found.</p>
                <p className="text-(--color-text-muted) text-xs mt-2 font-medium">Try adjusting your filters or time range.</p>
              </div>
            ) : (
              filteredSalaries.map((s, idx) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  key={s._id}
                  className="bg-(--color-surface)/40  p-5 rounded-xl border border-(--color-border) flex flex-col justify-between group hover:border-primary/40 transition-all shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl overflow-hidden bg-primary/10 text-primary-dark dark:text-primary flex items-center justify-center text-xl font-semibold border border-primary/20 shadow-inner">
                          {s.profileImageUrl ? (
                            <img src={s.profileImageUrl} alt={s.name} className="h-full w-full object-cover" />
                          ) : (
                            s.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-(--color-text-primary) text-base leading-tight">{s.name}</p>
                          <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted) mt-1">{s.email}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-normal px-2.5 py-1 bg-primary/10 text-primary-dark dark:text-primary rounded-lg">
                        {(s.role === 'location_admin' || s.role === 'branch_admin') ? 'Branch Admin' : s.role?.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-y border-(--color-border) py-4 my-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Location</p>
                        <p className="text-sm font-medium text-(--color-text-secondary)">{s.locationName || 'Unassigned'}</p>
                      </div>
                      {['staff', 'chef'].includes(activeTab) && (
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Working Days</p>
                          <p className="text-sm font-medium text-(--color-text-secondary)">
                            <span className="text-primary-dark dark:text-primary">{s.payableDays}</span> / {s.daysInMonth || 30}
                          </p>
                        </div>
                      )}
                    </div>

                    {['staff', 'chef'].includes(activeTab) && s.totalPresent !== undefined && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="rounded-lg bg-success/10 border border-success/20 px-2 py-1.5 text-center">
                          <p className="text-[10px] font-medium uppercase tracking-normal text-success">Present</p>
                          <p className="text-sm font-semibold text-success">{s.totalPresent}</p>
                        </div>
                        <div className="rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5 text-center">
                          <p className="text-[10px] font-medium uppercase tracking-normal text-primary-dark dark:text-primary">Half Days</p>
                          <p className="text-sm font-semibold text-primary-dark dark:text-primary">{s.totalHalfDay}</p>
                        </div>
                        <div className="rounded-lg bg-danger/10 border border-danger/20 px-2 py-1.5 text-center">
                          <p className="text-[10px] font-medium uppercase tracking-normal text-danger">Absent</p>
                          <p className="text-sm font-semibold text-danger">{s.totalAbsent}</p>
                        </div>
                      </div>
                    )}
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
                      className="flex-1 py-3 text-[11px] font-medium uppercase tracking-normal bg-(--color-surface-soft) hover:bg-primary hover:text-(--color-bg-base) text-(--color-text-muted) rounded-xl transition-colors"
                    >
                      Edit Salary
                    </button>

                    {['staff', 'chef'].includes(activeTab) ? (
                      <div className="flex flex-wrap gap-2 flex-1">
                         {s.payrollRecord && s.payrollRecord.status === 'PAID' ? (
                            <span className="flex-1 py-3 text-[11px] font-medium uppercase tracking-normal bg-success/15 text-success rounded-xl text-center">
                              Paid
                            </span>
                         ) : s.payrollRecord ? (
                            <>
                              {canAdjust && (
                                <button
                                  onClick={() => {
                                    setAdjustingSalary(s);
                                    setAdjustForm({ type: 'deduction', amount: '', reason: '' });
                                  }}
                                  className="flex-1 py-3 text-[11px] font-medium uppercase tracking-normal bg-(--color-surface-soft) text-(--color-text-secondary) hover:bg-primary hover:text-(--color-bg-base) rounded-xl transition-colors text-center"
                                >
                                  Adjust
                                </button>
                              )}
                              {canApprove && (
                                <button
                                  onClick={async () => {
                                    const loadToast = toast.loading("Approving salary...");
                                    try {
                                      await api.patch(`/salary/payroll/${s.payrollRecord._id}/approve`);
                                      toast.success("Salary approved & paid", { id: loadToast });
                                      fetchData();
                                    } catch (e) {
                                      toast.error(e.response?.data?.message || "Something went wrong. Please try again.", { id: loadToast });
                                    }
                                  }}
                                  className="flex-1 py-3 text-[11px] font-semibold uppercase tracking-normal bg-success text-(--color-bg-base) hover:bg-success/90 rounded-xl transition-all text-center"
                                >
                                  Approve
                                </button>
                              )}
                            </>
                         ) : null}
                        <button
                          onClick={() => setViewingSalary(s)}
                          className="flex-1 py-3 text-[11px] font-medium uppercase tracking-normal bg-(--color-text-primary) text-(--color-bg-base) hover:bg-primary hover:text-(--color-bg-base) rounded-xl transition-colors text-center"
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
                        className="flex-1 py-3 text-[11px] font-medium uppercase tracking-normal bg-(--color-text-primary) text-(--color-bg-base) hover:bg-primary hover:text-(--color-bg-base) rounded-xl transition-colors"
                      >
                        Edit Salary
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
                  className={`h-10 w-10 rounded-xl font-semibold text-xs transition-all ${page === p
                      ? 'bg-primary text-(--color-bg-base) shadow-sm'
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
              <div className="p-5 border-b border-(--color-border) flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold text-(--color-text-primary)">Payroll <span className="text-primary">Breakdown</span></h3>
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-1">{month} Cycle</p>
                </div>
                <button onClick={() => setViewingSalary(null)} className="h-10 w-10 rounded-full bg-(--color-surface-soft) flex items-center justify-center text-(--color-text-muted) hover:text-danger transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-(--color-surface-soft)/50 rounded-xl border border-(--color-border)">
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-primary text-(--color-bg-base) flex items-center justify-center text-xl font-semibold">
                    {viewingSalary.profileImageUrl ? (
                      <img src={viewingSalary.profileImageUrl} alt={viewingSalary.name} className="h-full w-full object-cover" />
                    ) : (
                      viewingSalary.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-(--color-text-primary)">{viewingSalary.name}</p>
                    <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">
                      {viewingSalary.role === 'location_admin' || viewingSalary.role === 'branch_admin' ? 'Branch Admin' : viewingSalary.role?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Fixed Salary</p>
                    <p className="text-xl font-semibold text-(--color-text-primary)"><Money value={viewingSalary.monthlySalary} /></p>
                  </div>
                  <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-1">Payable Days</p>
                    <p className="text-xl font-semibold text-(--color-text-primary)">{viewingSalary.payableDays} <span className="text-[10px] text-(--color-text-muted)">/ {viewingSalary.daysInMonth}</span></p>
                  </div>
                </div>

                {viewingSalary.totalPresent !== undefined && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success">
                      <p className="text-[11px] font-medium uppercase tracking-normal mb-1 opacity-80">Present</p>
                      <p className="text-xl font-semibold">{viewingSalary.totalPresent}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary-dark dark:text-primary">
                      <p className="text-[11px] font-medium uppercase tracking-normal mb-1 opacity-80">Half Days</p>
                      <p className="text-xl font-semibold">{viewingSalary.totalHalfDay}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger">
                      <p className="text-[11px] font-medium uppercase tracking-normal mb-1 opacity-80">Absent</p>
                      <p className="text-xl font-semibold">{viewingSalary.totalAbsent}</p>
                    </div>
                  </div>
                )}

                {viewingSalary.payrollRecord && (() => {
                  const pr = viewingSalary.payrollRecord;
                  const adjBonus = (pr.adjustments || []).filter(a => a.type === 'bonus').reduce((s, a) => s + (a.amount || 0), 0);
                  const adjDeduct = (pr.adjustments || []).filter(a => a.type === 'deduction').reduce((s, a) => s + (a.amount || 0), 0);
                  const totalBonus = (pr.bonuses?.topSeller || 0) + (pr.bonuses?.performance || 0) + (pr.bonuses?.extraShifts || 0) + adjBonus;
                  const totalPenalty = (pr.penalties?.lateMark || 0) + (pr.penalties?.absent || 0) + (pr.penalties?.leave || 0) + adjDeduct;
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-success">
                          <p className="text-[11px] font-medium uppercase tracking-normal mb-1 opacity-80">Total Bonuses</p>
                          <p className="text-xl font-semibold"><Money value={totalBonus} prefix="+ " /></p>
                        </div>
                        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger">
                          <p className="text-[11px] font-medium uppercase tracking-normal mb-1 opacity-80">Total Penalties</p>
                          <p className="text-xl font-semibold"><Money value={totalPenalty} prefix="- " /></p>
                        </div>
                      </div>

                      {(pr.adjustments || []).length > 0 && (
                        <div className="rounded-xl border border-(--color-border) bg-(--color-surface-soft)/40 p-4">
                          <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-3">Manual Adjustments</p>
                          <div className="space-y-2">
                            {pr.adjustments.map((a, i) => (
                              <div key={i} className="flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0">
                                  <span className={`font-medium ${a.type === 'bonus' ? 'text-success' : 'text-danger'}`}>
                                    {a.type === 'bonus' ? 'Bonus' : 'Deduction'}
                                  </span>
                                  <span className="text-(--color-text-secondary)"> — {a.reason}</span>
                                  {a.byName && <span className="text-(--color-text-muted)"> ({a.byName})</span>}
                                </div>
                                <span className={`shrink-0 font-medium ${a.type === 'bonus' ? 'text-success' : 'text-danger'}`}>
                                  <Money value={a.amount || 0} prefix={a.type === 'bonus' ? '+ ' : '- '} />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="p-5 rounded-xl bg-primary text-(--color-bg-base) shadow-sm ">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-normal opacity-80">Final Net Payout</span>
                    <span className="px-2 py-0.5 bg-(--color-bg-base)/20 rounded-md text-[8px] font-medium uppercase">{viewingSalary.payrollRecord?.status?.replace(/_/g, ' ') || 'Calculated'}</span>
                  </div>
                  <p className="text-2xl font-semibold tracking-tight">
                    <Money value={viewingSalary.payrollRecord?.netSalary || viewingSalary.calculatedSalary || 0} decimals={0} />
                  </p>
                </div>
              </div>

              <div className="p-5 bg-(--color-surface-soft)/30 border-t border-(--color-border) flex flex-col sm:flex-row gap-4">
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
                  className="flex-1 py-4 rounded-xl bg-(--color-surface) text-(--color-text-primary) text-xs font-medium uppercase tracking-normal border border-(--color-border) shadow-sm transition-all hover:bg-(--color-surface-soft)"
                >
                  Print Payslip
                </button>

                <button
                  onClick={() => downloadCsv([viewingSalary], `salary-slip-${(viewingSalary.name || 'staff').replace(/\s+/g, '-')}-${month}.csv`)}
                  className="flex-1 py-4 rounded-xl bg-(--color-surface) text-(--color-text-primary) text-xs font-medium uppercase tracking-normal border border-(--color-border) shadow-sm transition-all hover:bg-(--color-surface-soft)"
                >
                  Download Slip
                </button>

                <button
                  onClick={() => setViewingSalary(null)}
                  className="flex-1 py-4 rounded-xl bg-(--color-text-primary) text-(--color-bg-base) text-xs font-semibold uppercase tracking-normal transition-all  shadow-sm "
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
              className="relative w-full max-w-lg bg-(--color-surface) rounded-xl p-6 border border-(--color-border) shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-primary flex items-center justify-center text-2xl font-semibold text-(--color-bg-base) shadow-sm">
                      {editingUser.profileImageUrl ? (
                        <img src={editingUser.profileImageUrl} alt={editingUser.name} className="h-full w-full object-cover" />
                      ) : (
                        editingUser.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-(--color-text-primary) tracking-tight leading-none">{editingUser.name}</h2>
                      <p className="text-[11px] font-medium uppercase text-primary-dark dark:text-primary tracking-normal mt-2">Update Salary</p>
                    </div>
                 </div>
                 <button onClick={() => setEditingUser(null)} className="p-2 rounded-full hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-colors">
                   <X size={24} />
                 </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                // Payroll only edits the salary — sending the full profile here failed
                // validation (required phone / empty salary cast), so we PATCH just the
                // monthly salary as a proper Number.
                const salary = Number(editFormData.monthlySalary);
                if (editFormData.monthlySalary === '' || !Number.isFinite(salary) || salary < 0) {
                  toast.error('Enter a valid salary amount');
                  return;
                }
                const loadToast = toast.loading("Updating salary...");
                try {
                  await api.put(`/users/${editingUser._id || editingUser.userId}`, { monthlySalary: salary });
                  toast.success("Salary updated successfully", { id: loadToast });
                  setEditingUser(null);
                  fetchData();
                } catch (error) {
                  toast.error(error.response?.data?.message || "Update failed", { id: loadToast });
                }
              }} className="space-y-6">
                 <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Monthly Salary (₹)</label>
                      <input
                        type="number"
                        min="0"
                        autoFocus
                        onKeyDown={blockNegative}
                        placeholder="e.g. 28000"
                        className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20"
                        value={editFormData.monthlySalary}
                        onChange={e => setEditFormData({...editFormData, monthlySalary: e.target.value})}
                      />
                      <p className="text-[11px] font-medium text-(--color-text-muted) mt-2 ml-1">Only the monthly salary is edited here. To change name, contact or role, use the Staff page.</p>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 rounded-xl bg-(--color-surface-soft) text-xs font-medium uppercase tracking-normal text-(--color-text-muted)">Cancel</button>
                    <button type="submit" className="flex-1 py-4 rounded-xl bg-(--color-text-primary) text-(--color-bg-base) text-xs font-semibold uppercase tracking-normal shadow-sm ">Update Salary</button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}

        {adjustingSalary && (
          <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-(--color-bg-deep)/60">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-md bg-(--color-surface) rounded-xl p-6 border border-(--color-border) shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-(--color-text-primary) tracking-tight">Adjust <span className="text-primary">Salary</span></h2>
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-1">
                    {adjustingSalary.name} · {month}
                  </p>
                </div>
                <button onClick={() => setAdjustingSalary(null)} className="p-2 rounded-full hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-colors">
                  <X size={22} />
                </button>
              </div>

              <div className="mb-5 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) p-4 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Current Net Payout</span>
                <span className="text-lg font-semibold text-(--color-text-primary)">
                  <Money value={adjustingSalary.payrollRecord?.netSalary || 0} decimals={0} />
                </span>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'deduction', label: 'Deduct (−)' },
                      { id: 'bonus', label: 'Bonus (+)' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAdjustForm({ ...adjustForm, type: opt.id })}
                        className={`py-3 rounded-xl text-[11px] font-medium uppercase tracking-normal border transition-all ${
                          adjustForm.type === opt.id
                            ? (opt.id === 'bonus' ? 'bg-success text-(--color-bg-base) border-transparent' : 'bg-danger text-(--color-bg-base) border-transparent')
                            : 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border) hover:border-primary/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    onKeyDown={blockNegative}
                    value={adjustForm.amount}
                    onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-2 ml-1">Reason</label>
                  <textarea
                    rows={2}
                    value={adjustForm.reason}
                    onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                    placeholder={adjustForm.type === 'bonus' ? 'e.g. Overtime / great work' : 'e.g. Damaged equipment'}
                    className="w-full px-5 py-4 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setAdjustingSalary(null)} className="flex-1 py-4 rounded-xl bg-(--color-surface-soft) text-xs font-medium uppercase tracking-normal text-(--color-text-muted)">Cancel</button>
                <button type="button" onClick={submitAdjustment} className="flex-1 py-4 rounded-xl bg-(--color-text-primary) text-(--color-bg-base) text-xs font-semibold uppercase tracking-normal shadow-sm">Apply</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
