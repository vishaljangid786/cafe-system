'use client';

import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  TrendingDown, Search, Filter,
  ChevronRight, Calendar, MapPin,
  ArrowDownRight, Activity, Receipt,
  Plus, User, Info, ChevronDown,
  Sparkles, Download, Wallet, ArrowUpRight
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
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.append('type', 'expense');
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
      setLoading(false);
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
    const loadToast = toast.loading('Archiving expense...');
    try {
      const finalTitle = formData.title === "Other (Custom Title)" ? formData.customTitle : formData.title;
      if (!finalTitle) throw new Error("Title is required");

      const data = {
        ...formData,
        title: finalTitle,
        type: 'expense'
      };

      await api.post('/transactions', data);
      toast.success('Expense archived', { id: loadToast });
      setShowAddModal(false);
      setFormData({ title: '', customTitle: '', amount: '', category: 'Operational', date: new Date().toLocaleDateString('en-CA'), description: '' });
      fetchExpenses();
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'System Rule failure';
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

  return (
    <PageTransition>
      <div className="space-y-8 pb-24">
        {/* Cinematic Header */}
        <div className="relative group overflow-hidden bg-white dark:bg-zinc-900 rounded-[3rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-rose-500/5">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Activity size={200} className="text-rose-500" strokeWidth={1} />
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/10">
                  <TrendingDown size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white leading-none">
                    My <span className="text-rose-500">Expenses</span>
                  </h1>
                  <p className="text-zinc-500 font-bold mt-2 flex items-center gap-2 text-sm">
                    <Sparkles size={14} className="text-blue-500" />
                    Record and track your personal operational spend.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-inner">
                {['7d', '1m', 'all'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 ${timeRange === t ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 scale-105' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="!rounded-2xl !py-4 px-8 bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-600/20 scale-105 hover:scale-110 active:scale-95 transition-all"
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
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-rose-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Scan your records..."
                  className="w-full pl-14 pr-6 py-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl focus:ring-4 focus:ring-rose-500/10 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm"
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
                  filename="my_expense_vault"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {loading ? (
                [1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-[2rem]" />)
              ) : paginatedData.length === 0 ? (
                <div className="sm:col-span-2 py-32 text-center bg-zinc-50 dark:bg-zinc-950/40 rounded-[3rem] border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center">
                  <div className="h-20 w-20 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-300 mb-6">
                    <Receipt size={40} strokeWidth={1} />
                  </div>
                  <p className="text-zinc-500 font-bold text-lg tracking-tight">No personal expenditure nodes detected.</p>
                </div>
              ) : (
                paginatedData.map((t, idx) => (
                  <SlideIn key={t._id} delay={idx * 0.03}>
                    <CardHover>
                      <div
                        onClick={() => setSelectedExpense(t)}
                        className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between group hover:border-rose-500/40 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                            <ArrowDownRight size={24} strokeWidth={2.5} />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-zinc-900 dark:text-white tracking-tight text-base line-clamp-1">
                                {t.title}
                              </h4>
                              {t.status === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${t.status === 'approved' ? 'text-rose-500 bg-rose-500/5 border-rose-500/10' :
                                  t.status === 'rejected' ? 'text-zinc-500 bg-zinc-500/5 border-zinc-500/10' :
                                    'text-blue-500 bg-blue-500/5 border-blue-500/10 animate-pulse'
                                }`}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xl font-black tracking-tighter leading-none ${t.status === 'rejected' ? 'text-zinc-400 line-through' : 'text-rose-500'}`}>-₹{t.totalAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-2">Personal</p>
                        </div>
                      </div>
                    </CardHover>
                  </SlideIn>
                  ))
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-8 py-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] mt-10 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Vault Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-gray-100 dark:hover:bg-zinc-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <SlideIn direction="right" delay={0.2}>
              <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Wallet size={100} strokeWidth={1} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-6">Personal Speed</h3>
                <div className="space-y-6 relative z-10">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} fill="#f43f5e10" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Outflow</p>
                    <p className="text-2xl font-black tracking-tighter mt-1 text-rose-500">₹{totalExpenditure.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </SlideIn>
          </div>
        </div>

        {/* Modal components are shared and will be identical to Admin for UI consistency */}
        {/* Detail Modal */}
        <Modal isOpen={!!selectedExpense} onClose={() => setSelectedExpense(null)} title="Record Dossier" maxWidth="max-w-2xl">
          {selectedExpense && (
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
                    <Receipt size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{selectedExpense.title}</h3>
                      {selectedExpense.status === 'pending' && (
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-lg animate-pulse">Pending Review</span>
                      )}
                      {selectedExpense.status === 'rejected' && (
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 rounded-lg">Revoked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20">{selectedExpense.category}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 rounded-xl flex items-center gap-2">
                        <Calendar size={12} /> {new Date(selectedExpense.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right bg-zinc-50 dark:bg-zinc-950 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 min-w-[200px]">
                  <p className="text-4xl font-black text-rose-500 tracking-tighter">₹{selectedExpense.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-2">Personal Cost</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2">
                    <User size={12} className="text-rose-500" /> Origin Agent
                  </p>
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 overflow-hidden shadow-inner">
                      {selectedExpense.createdBy?.profileImageUrl ? (
                        <img src={selectedExpense.createdBy.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-black text-rose-500">{selectedExpense.createdBy?.name?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-black text-zinc-900 dark:text-white leading-none">{selectedExpense.createdBy?.name || 'System Rule User'}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mt-1 bg-rose-500/5 px-2 py-0.5 rounded-lg w-fit">{selectedExpense.createdBy?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2">
                    <MapPin size={12} className="text-rose-500" /> Station Center
                  </p>
                  <div className="space-y-1">
                    <p className="text-base font-black text-zinc-900 dark:text-white leading-none">{selectedExpense.locationId?.name || 'Central Command'}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">{selectedExpense.locationId?.city || 'Regional Sector'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2 ml-2">
                  <Info size={12} className="text-rose-500" /> Descriptive Information
                </p>
                <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 relative">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic relative z-10">
                    &ldquo;{selectedExpense.description || 'No descriptive info was archived for this particular resource outflow.'}&rdquo;
                  </p>
                </div>
              </div>

              {selectedExpense.billImage && (
                <div className="space-y-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2 ml-2">
                    <Sparkles size={12} className="text-rose-500" /> Archival Evidence
                  </p>
                  <div className="rounded-[3rem] overflow-hidden border-4 border-zinc-50 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-3 shadow-2xl relative group">
                    <img src={selectedExpense.billImage} alt="Evidence" className="w-full h-auto rounded-[2.5rem] transition-all duration-1000 group-hover:scale-[1.02]" />
                  </div>
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full !rounded-2xl !py-6 font-black uppercase tracking-[0.2em] text-xs border-none bg-zinc-100 dark:bg-zinc-800"
                onClick={() => setSelectedExpense(null)}
              >
                Exit
              </Button>
            </div>
          )}
        </Modal>

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="New Personal Outflow" maxWidth="max-w-xl">
          <form onSubmit={handleAddExpense} className="space-y-8 p-2">
            <div className="space-y-6">
                <PremiumSelect 
                  label="Archival Title"
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
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Specify Custom Title</label>
                    <input
                      required
                      className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                      placeholder="e.g. Special Equipment Repair"
                      value={formData.customTitle}
                      onChange={e => setFormData({ ...formData, customTitle: e.target.value })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Economic Volume (₹)</label>
                  <input required type="number" className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-black dark:text-white focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                </div>
                <PremiumSelect 
                  label="Category Vector"
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
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Temporal Stamp</label>
                <input required type="date" readOnly className="w-full rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-bold text-zinc-500 dark:text-zinc-400 cursor-not-allowed outline-none" value={formData.date} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Information Notes</label>
                <textarea className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-medium dark:text-white focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Provide specific context for this outflow..." />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !rounded-[2rem] bg-primary !py-6 shadow-2xl shadow-rose-600/30 font-black uppercase tracking-[0.4em] text-sm" icon={Sparkles}>Finalize Outflow</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
