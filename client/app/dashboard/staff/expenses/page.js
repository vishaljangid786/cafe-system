'use client';

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  TrendingDown, Search, Filter,
  ChevronRight, Calendar, MapPin,
  ArrowDownRight, Activity, Receipt,
  Plus, User, Info, ChevronDown,
  Sparkles, Download, Layers, Wallet, ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ExportActions from '../../../components/ui/ExportActions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { Skeleton } from '@/app/components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import toast from 'react-hot-toast';

const EXPENSE_TITLES = [
  "Electricity Bill",
  "Water Bill",
  "Rent / Lease",
  "Internet & Communications",
  "Cleaning & Sanitation",
  "Raw Materials / Ingredients",
  "Equipment Maintenance",
  "Marketing & Promotions",
  "Staff Welfare",
  "Other (Custom Title)"
];

export default function StaffExpensesPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    customTitle: '',
    amount: '',
    category: 'Operational',
    date: new Date().toLocaleDateString('en-CA'),
    description: ''
  });

  const fetchExpenses = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const query = new URLSearchParams();
      query.append('type', 'EXPENSE');
      query.append('page', currentPage);
      query.append('limit', itemsPerPage);
      if (searchTerm) query.append('search', searchTerm);

      const now = new Date();
      let start = '';
      if (timeRange !== 'all') {
        const d = new Date();
        if (timeRange === '7d') d.setDate(now.getDate() - 7);
        else if (timeRange === '1m') d.setMonth(now.getMonth() - 1);
        start = d.toISOString().split('T')[0];
      }
      if (start) query.append('startDate', start);

      const res = await api.get(`/transactions?${query.toString()}`);
      setTransactions(res.data.data);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Expenses sync failed');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
    }, 0);
    return () => clearTimeout(timer);
  }, [timeRange, currentPage, searchTerm]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Saving expense...');
    try {
      const finalTitle = formData.title === "Other (Custom Title)" ? formData.customTitle : formData.title;
      if (!finalTitle) throw new Error("Title is required");

      const data = {
        ...formData,
        title: finalTitle,
        type: 'EXPENSE'
      };

      await api.post('/transactions', data);
      toast.success('Expense saved', { id: loadToast });
      setShowAddModal(false);
      setFormData({ title: '', customTitle: '', amount: '', category: 'Operational', date: new Date().toLocaleDateString('en-CA'), description: '' });
      fetchExpenses();
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Something went wrong. Please try again.';
      toast.error(msg, { id: loadToast });
    }
  };

  const filteredData = transactions;
  const totalExpenditure = filteredData.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const paginatedData = transactions;

  const chartData = [...filteredData].reverse().slice(-30).map(t => ({
    date: new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    amount: t.totalAmount
  }));

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8 pb-24">
        {/* Header */}
        <div className="relative group overflow-hidden bg-[var(--color-surface)] dark:bg-[var(--color-surface)] rounded-xl p-10 border border-[var(--color-border)] dark:border-[var(--color-border)] shadow-sm ">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Activity size={200} className="text-[var(--color-danger)]" strokeWidth={1} />
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 flex items-center justify-center text-[var(--color-danger)] shadow-lg ">
                  <TrendingDown size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-text-primary)] dark:text-white leading-none">
                    My <span className="text-[var(--color-danger)]">Expenses</span>
                  </h1>
                  <p className="text-[var(--color-text-muted)] font-bold mt-2 flex items-center gap-2 text-sm">
                    <Sparkles size={14} className="text-[var(--color-primary)]" />
                    Add and track your own expenses.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] p-1.5 rounded-[1.5rem] border border-[var(--color-border)] dark:border-[var(--color-border)] shadow-inner">
                {['7d', '1m', 'all'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all duration-500 ${timeRange === t ? 'bg-[var(--color-danger)] text-white shadow-lg  scale-105' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] dark:hover:text-[var(--color-text-muted)]'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="!rounded-xl !py-4 px-8 bg-[var(--color-danger)] hover:bg-[var(--color-danger)] shadow-sm  scale-105  active:scale-95 transition-all"
              >
                New Entry
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-danger)] transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search your expenses..."
                  className="w-full pl-14 pr-6 py-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface)] border border-[var(--color-border)] dark:border-[var(--color-border)] rounded-xl focus:ring-4 focus:ring-[var(--color-danger)]/10 outline-none transition-all font-bold text-sm text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <ExportActions
                  data={filteredData}
                  columns={[
                    { header: 'Title', key: 'title' },
                    { header: 'Category', key: 'category' },
                    { header: 'Date', key: item => new Date(item.date).toLocaleDateString() },
                    { header: 'Amount', key: 'totalAmount' }
                  ]}
                  filename="my_expenses"
                />
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={fetchExpenses}
                  isLoading={loading}
                  className="!rounded-xl !py-4 px-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] border-none hover:bg-[var(--color-surface-soft)] dark:hover:bg-[var(--color-surface-soft)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {refetching ? (
                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
              ) : paginatedData.length === 0 ? (
                <div className="sm:col-span-2 py-32 text-center bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)]/40 rounded-xl border border-dashed border-[var(--color-border)] dark:border-[var(--color-border)] flex flex-col items-center justify-center">
                  <div className="h-20 w-20 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-muted)] mb-6">
                    <Receipt size={40} strokeWidth={1} />
                  </div>
                  <p className="text-[var(--color-text-muted)] font-bold text-lg tracking-tight">You have not added any expenses yet.</p>
                </div>
              ) : (
                paginatedData.map((t, idx) => (
                  <SlideIn key={t._id} delay={idx * 0.03}>
                    <CardHover>
                      <div
                        onClick={() => setSelectedExpense(t)}
                        className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-6 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] flex items-center justify-between group hover:border-[var(--color-danger)]/40 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 flex items-center justify-center text-[var(--color-danger)] shadow-inner transition-transform duration-500">
                            <ArrowDownRight size={24} strokeWidth={2.5} />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-[var(--color-text-primary)] dark:text-white tracking-tight text-base line-clamp-1">
                                {t.title}
                              </h4>
                              {t.status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                                {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                              </span>
                              <span className={`text-[9px] font-bold uppercase tracking-normal px-2.5 py-1 rounded-lg border ${t.status === 'approved' ? 'text-[var(--color-danger)] bg-[var(--color-danger)]/5 border-[var(--color-danger)]/10' :
                                  t.status === 'rejected' ? 'text-[var(--color-text-muted)] bg-[var(--color-surface-soft)]/5 border-[var(--color-border)]/10' :
                                    'text-[var(--color-primary)] bg-[var(--color-primary)]/5 border-[var(--color-primary)]/10 animate-pulse'
                                }`}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xl font-bold tracking-tight leading-none ${t.status === 'rejected' ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-danger)]'}`}>-₹{t.totalAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-2">Expense</p>
                        </div>
                      </div>
                    </CardHover>
                  </SlideIn>
                  ))
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-8 py-6 bg-[var(--color-surface)] dark:bg-[var(--color-surface)] border border-[var(--color-border)] dark:border-[var(--color-border)] rounded-xl mt-10 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-4 py-2 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] border border-[var(--color-border)] dark:border-[var(--color-border)] text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-[var(--color-surface-soft)] dark:hover:bg-[var(--color-surface-soft)]"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-4 py-2 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] border border-[var(--color-border)] dark:border-[var(--color-border)] text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:bg-[var(--color-surface-soft)] dark:hover:bg-[var(--color-surface-soft)]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <SlideIn direction="right" delay={0.2}>
              <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] rounded-xl p-8 border border-[var(--color-border)] dark:border-[var(--color-border)] shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform duration-700">
                  <Wallet size={100} strokeWidth={1} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6">Spending Trend</h3>
                <div className="space-y-6 relative z-10">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} fill="#f43f5e10" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="border-t border-[var(--color-border)] dark:border-[var(--color-border)] pt-6">
                    <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Total Spent</p>
                    <p className="text-2xl font-bold tracking-tight mt-1 text-[var(--color-danger)]">₹{totalExpenditure.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </SlideIn>
          </div>
        </div>

        {/* Modal components are shared and will be identical to Admin for UI consistency */}
        {/* Detail Modal */}
        <Modal isOpen={!!selectedExpense} onClose={() => setSelectedExpense(null)} title="Expense Details" maxWidth="max-w-2xl">
          {selectedExpense && (
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 flex items-center justify-center text-[var(--color-danger)] shadow-inner">
                    <Receipt size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-white tracking-tight leading-none">{selectedExpense.title}</h3>
                      {selectedExpense.status === 'pending' && (
                        <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-lg animate-pulse">Pending Review</span>
                      )}
                      {selectedExpense.status === 'rejected' && (
                        <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-1 bg-[var(--color-surface-soft)]/10 text-[var(--color-text-secondary)] border border-[var(--color-border)]/20 rounded-lg">Rejected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-normal px-4 py-1.5 bg-[var(--color-danger)] text-white rounded-xl shadow-lg ">{selectedExpense.category}</span>
                      <span className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] px-4 py-1.5 rounded-xl flex items-center gap-2">
                        <Calendar size={12} /> {new Date(selectedExpense.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] p-6 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] min-w-[200px]">
                  <p className="text-4xl font-bold text-[var(--color-danger)] tracking-tight">₹{selectedExpense.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-2">Total Amount</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-8 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] shadow-sm relative overflow-hidden group">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <User size={12} className="text-[var(--color-danger)]" /> Added By
                  </p>
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] border-2 border-[var(--color-border)] dark:border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] overflow-hidden shadow-inner">
                      {selectedExpense.createdBy?.profileImageUrl ? (
                        <img src={selectedExpense.createdBy.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-[var(--color-danger)]">{selectedExpense.createdBy?.name?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-[var(--color-text-primary)] dark:text-white leading-none">{selectedExpense.createdBy?.name || 'Unknown User'}</p>
                      <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)] mt-1 bg-[var(--color-danger)]/5 px-2 py-0.5 rounded-lg w-fit">{selectedExpense.createdBy?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-8 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] shadow-sm relative overflow-hidden group">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                    <MapPin size={12} className="text-[var(--color-danger)]" /> Branch
                  </p>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-[var(--color-text-primary)] dark:text-white leading-none">{selectedExpense.locationId?.name || 'Head Office'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-1">{selectedExpense.locationId?.city || 'Branch'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-2 ml-2">
                  <Info size={12} className="text-[var(--color-danger)]" /> Notes
                </p>
                <div className="p-8 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] relative">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] leading-relaxed italic relative z-10">
                    &ldquo;{selectedExpense.description || 'No notes were added for this expense.'}&rdquo;
                  </p>
                </div>
              </div>

              {selectedExpense.billImage && (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-2 ml-2">
                    <Sparkles size={12} className="text-[var(--color-danger)]" /> Bill Photo
                  </p>
                  <div className="rounded-xl overflow-hidden border-4 border-[var(--color-border)] dark:border-[var(--color-border)] bg-[var(--color-surface)] dark:bg-[var(--color-bg)] p-3 shadow-sm relative group">
                    <img src={selectedExpense.billImage} alt="Evidence" className="w-full h-auto rounded-xl transition-all duration-1000" />
                  </div>
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs border-none bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]"
                onClick={() => setSelectedExpense(null)}
              >
                Close
              </Button>
            </div>
          )}
        </Modal>

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Expense" maxWidth="max-w-xl">
          <form onSubmit={handleAddExpense} className="space-y-8 p-2">
            <div className="space-y-6">
                <PremiumSelect 
                  label="Expense Title"
                  value={formData.title}
                  onChange={val => {
                    setFormData({ ...formData, title: val });
                    setShowCustomTitle(val === "Other (Custom Title)");
                  }}
                  options={EXPENSE_TITLES.map(title => ({ label: title, value: title }))}
                />

              <AnimatePresence>
                {showCustomTitle && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)] ml-2">Enter Custom Title</label>
                    <input
                      required
                      className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-[var(--color-danger)]/10 transition-all outline-none"
                      placeholder="e.g. Equipment Repair"
                      value={formData.customTitle}
                      onChange={e => setFormData({ ...formData, customTitle: e.target.value })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)] ml-2">Amount (₹)</label>
                  <input required type="number" className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-[var(--color-danger)]/10 transition-all outline-none" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                </div>
                <PremiumSelect 
                  label="Category"
                  value={formData.category}
                  onChange={val => setFormData({ ...formData, category: val })}
                  options={[
                    { label: 'Operational', value: 'Operational' },
                    { label: 'Inventory', value: 'Inventory' },
                    { label: 'Utilities', value: 'Utilities' },
                    { label: 'Marketing', value: 'Marketing' },
                    { label: 'Staff Welfare', value: 'Welfare' },
                    { label: 'Other', value: 'Other' }
                  ]}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)] ml-2">Date</label>
                <input required type="date" readOnly className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] border border-[var(--color-border)] dark:border-[var(--color-border)] p-5 text-sm font-bold text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] cursor-not-allowed outline-none" value={formData.date} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)] ml-2">Notes</label>
                <textarea className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] p-5 text-sm font-medium dark:text-white focus:ring-4 focus:ring-[var(--color-danger)]/10 transition-all outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Add any details about this expense..." />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !rounded-xl bg-primary !py-6 shadow-sm  font-bold uppercase tracking-normal text-sm" icon={Sparkles}>Save Expense</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
