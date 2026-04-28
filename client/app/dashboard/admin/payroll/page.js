'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Wallet, Filter, MapPin, ChevronRight, Download, Receipt, PieChart as PieIcon, Activity, FileText, Target, X } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import ExportActions from '../../../components/ui/ExportActions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function PayrollRecordsPage() {
  const monthInputRef = useRef(null);
  const [salaries, setSalaries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
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
  const { user: currentUser } = api; 


  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [salRes, locRes] = await Promise.all([
          api.get(`/salary/all?month=${month}&locationId=${selectedLocation === 'All' ? '' : locations.find(l => l.name === selectedLocation)?._id || ''}&role=${activeTab}&search=${searchQuery}&page=${page}&limit=10`),
          api.get('/locations')
        ]);
        setSalaries(salRes.data.data);
        setStats({
          totalPayroll: salRes.data.totalPayrollCost,
          locationTotals: salRes.data.locationTotals
        });
        if (salRes.data.pagination) setPagination(salRes.data.pagination);
        setLocations(locRes.data.data);
      } catch (err) {
        console.error('Failed to fetch records');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month, selectedLocation, activeTab, searchQuery, page]);

  const filteredSalaries = salaries; // Now filtered by backend


  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-2xl shadow-sm transition-colors">
            <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />

            <div className="relative p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex-1">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                    Payroll Control Center
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-amber-400 shadow-xl shadow-zinc-900/10 dark:bg-amber-500 dark:text-black dark:shadow-amber-500/20">
                      <Wallet size={28} strokeWidth={2.5} />
                    </div>

                    <div>
                      <h1 className="text-3xl font-black leading-none tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
                        Salary <span className="text-amber-600 dark:text-amber-400">Management</span>
                      </h1>
                      <p className="mt-3 flex max-w-2xl items-center text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                        <Target size={15} className="mr-2 shrink-0 text-amber-600 dark:text-amber-400" />
                        Manage payouts, staff compensation, and branch-wise salary records for the selected cycle.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:w-auto xl:min-w-[820px]">
                  {/* Search */}
                  <div className="relative group sm:col-span-2 lg:col-span-1">
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                      Search
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-amber-600">
                        <Activity size={17} />
                      </div>
                      <input
                          type="text"
                          placeholder="Search staff..."
                          className="h-[54px] w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 py-4 pl-12 pr-4 text-sm font-bold text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:focus:bg-zinc-900"
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
                    <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                      Month
                    </label>
                    <div
                        onClick={() => monthInputRef.current?.showPicker()}
                        className="flex h-[54px] cursor-pointer items-center rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 transition-all hover:border-amber-500/50 focus-within:border-amber-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10 dark:border-zinc-800 dark:bg-zinc-900/70 dark:focus:bg-zinc-900"
                    >
                      <input
                          ref={monthInputRef}
                          type="month"
                          className="w-full cursor-pointer border-none bg-transparent text-sm font-bold text-zinc-800 outline-none dark:text-zinc-100"
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
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800/50 pt-8">
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
                    className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                      activeTab === tab.id 
                        ? `bg-zinc-900 dark:bg-amber-600 text-white border-transparent shadow-xl shadow-amber-600/20 scale-105` 
                        : `bg-white/50 dark:bg-zinc-900/50 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-amber-500/30`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

             
              <div className="mt-6 flex flex-col gap-4 border-t border-zinc-200/70 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Records</p>
                    <p className="mt-1 text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {filteredSalaries.length} Staff
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Cycle</p>
                    <p className="mt-1 text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {month}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
                      Scope
                    </p>
                    <p className="mt-1 text-sm font-black text-amber-700 dark:text-amber-300">
                      {selectedLocation === 'All' ? 'All Branches' : selectedLocation}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-amber-600 p-6 rounded-2xl shadow-lg shadow-amber-600/20 text-white h-full">
              <p className="text-xs font-black uppercase tracking-widest opacity-80">Total Salary Payout</p>
              <p className="text-3xl font-black mt-1">₹{filteredSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0).toLocaleString()}</p>
              <div className="mt-4 flex items-center text-xs font-medium opacity-90">
                <Receipt size={14} className="mr-1" /> {selectedLocation === 'All' ? 'Total Network Cost' : `${selectedLocation} Total`}
              </div>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-full transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Avg Salary / Employee</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mt-1">
                ₹{filteredSalaries.length > 0 ? (filteredSalaries.reduce((acc, curr) => acc + (curr.calculatedSalary || 0), 0) / filteredSalaries.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 h-full transition-colors">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Staff Count</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{filteredSalaries.length}</p>
            </div>
          </SlideIn>
        </div>

        {/* Payroll Visual Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Distribution Graph */}
          <SlideIn delay={0.4}>
            <div className="export-chart bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {selectedLocation === 'All' ? 'Branch Breakdown' : 'Staff Breakdown'}
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                    {selectedLocation === 'All' ? 'Payroll weight by location' : `Salary weights in ${selectedLocation}`}
                  </p>
                </div>
                <PieIcon size={20} className="text-amber-500" />
              </div>
              <div className="h-[300px] w-full relative">
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
                        <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid #27272a' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 italic">Salary</span>
                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Weights</span>
                </div>
              </div>
            </div>
          </SlideIn>

          

          {/* Comparative Cost Graph */}
          <SlideIn delay={0.5}>
            <div className="export-chart bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {selectedLocation === 'All' ? 'Comparative Cost' : 'Individual Payouts'}
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                    {selectedLocation === 'All' ? 'Direct salary payout comparison' : `Top earners in ${selectedLocation}`}
                  </p>
                </div>
                <Activity size={20} className="text-blue-500" />
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={selectedLocation === 'All'
                    ? (stats?.locationTotals ? Object.entries(stats.locationTotals).map(([name, total]) => ({ name, value: total })) : [])
                    : filteredSalaries.slice(0, 8).map(s => ({ name: s.name.split(' ')[0], value: s.calculatedSalary }))
                  }>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: '#88888810' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={selectedLocation === 'All' ? 40 : 20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SlideIn>
        </div>



        {/* Salary Table */}
        <SlideIn direction="up" delay={0.4}>
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Branch</th>
                    {['staff', 'chef'].includes(activeTab) && (
                      <th className="px-6 py-4 text-center">Working Days</th>
                    )}
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {loading ? (
                    [1, 2, 3, 4].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="5" className="px-6 py-6"><div className="h-4 bg-gray-100 dark:bg-zinc-800 rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">No payroll records found for this period.</td>
                    </tr>
                  ) : (
                    filteredSalaries.map((s, idx) => (
                      <motion.tr
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + idx * 0.03 }}
                        key={s._id}
                        className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{s.name}</p>
                            <p className="text-[10px] font-medium text-zinc-500">{s.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-amber-500/10 text-amber-600 rounded-md">
                            {(s.role === 'location_admin' || s.role === 'branch_admin') ? 'Branch Admin' : s.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded-md">
                            {s.locationName || 'Unassigned'}
                          </span>
                        </td>
                        {['staff', 'chef'].includes(activeTab) && (
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-black text-amber-600">{s.payableDays}</span>
                            <span className="text-[10px] text-gray-400 ml-1">/ {s.daysInMonth || 30}</span>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {['staff', 'chef'].includes(activeTab) ? (
                              <button
                                onClick={() => setViewingSalary(s)}
                                className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-amber-600 transition-all shadow-sm"
                              >
                                View Breakdown
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingUser(s);
                                  setEditFormData({
                                    name: s.name,
                                    email: s.email,
                                    phone: s.phone || '',
                                    monthlySalary: s.monthlySalary || '',
                                    role: s.role,
                                    address1: s.address1 || ''
                                  });
                                }}
                                className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-purple-600 transition-all shadow-sm"
                              >
                                View Profile
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingUser(s);
                                setEditFormData({
                                  name: s.name,
                                  email: s.email,
                                  phone: s.phone || '',
                                  monthlySalary: s.monthlySalary || '',
                                  role: s.role,
                                  address1: s.address1 || ''
                                });
                              }}
                              className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-amber-500 text-black rounded-xl hover:bg-amber-600 transition-all shadow-sm"
                            >
                              Update
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-4 py-6">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 disabled:opacity-30 hover:text-amber-600 transition-all shadow-sm"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-10 w-10 rounded-xl font-black text-xs transition-all ${page === p
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20 scale-105'
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-amber-600'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 disabled:opacity-30 hover:text-amber-600 transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Detailed Breakdown Modal */}
        {viewingSalary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Payroll <span className="text-amber-600">Breakdown</span></h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">{month} Cycle</p>
                </div>
                <button onClick={() => setViewingSalary(null)} className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-500 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="h-12 w-12 rounded-xl bg-amber-500 text-black flex items-center justify-center text-xl font-black">
                    {viewingSalary.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-zinc-900 dark:text-zinc-100">{viewingSalary.name}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {viewingSalary.role === 'location_admin' || viewingSalary.role === 'branch_admin' ? 'Branch Admin' : viewingSalary.role?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Fixed Salary</p>
                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">₹{viewingSalary.monthlySalary?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Payable Days</p>
                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{viewingSalary.payableDays} <span className="text-[10px] text-zinc-400">/ {viewingSalary.daysInMonth}</span></p>
                  </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-amber-600 text-white shadow-xl shadow-amber-600/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Final Calculated Payout</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded-md text-[8px] font-black uppercase">Verified</span>
                  </div>
                  <p className="text-4xl font-black tracking-tighter">₹{viewingSalary.calculatedSalary?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-[9px] font-medium opacity-70 mt-3 flex items-center gap-1">
                    <Receipt size={10} /> Based on attendance matrix for {month}
                  </p>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => setViewingSalary(null)}
                  className="w-full py-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
                >
                  Close Records
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* User Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
             <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[2.5rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-amber-500 flex items-center justify-center text-2xl font-black text-black shadow-lg shadow-amber-500/20">
                      {editingUser.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">{editingUser.name}</h2>
                      <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mt-2">Update Credentials</p>
                    </div>
                 </div>
                 <button onClick={() => setEditingUser(null)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 transition-colors">
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
                  // Refresh current view
                  window.location.reload();
                } catch (error) {
                  toast.error("Update failed", { id: loadToast });
                }
              }} className="space-y-6">
                 <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Full Name</label>
                      <input className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Monthly Salary (₹)</label>
                      <input type="number" className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20" value={editFormData.monthlySalary} onChange={e => setEditFormData({...editFormData, monthlySalary: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Contact</label>
                        <input className="w-full px-5 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1">Role</label>
                        <input disabled className="w-full px-5 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-400 outline-none opacity-60" value={editFormData.role} />
                      </div>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-xs font-black uppercase tracking-widest text-zinc-500">Abort</button>
                    <button type="submit" className="flex-1 py-4 rounded-2xl bg-zinc-900 dark:bg-amber-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-amber-600/20">Update Profile</button>
                 </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
