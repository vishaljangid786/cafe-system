'use client';

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { CardSkeleton } from '@/app/components/ui/Skeleton';
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

export default function BranchExpensesPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'mine', 'pending'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const itemsPerPage = 12;

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    customTitle: '',
    amount: '',
    category: 'Operational',
    date: new Date().toISOString().split('T')[0],
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
      
      if (activeTab === 'mine') {
        query.append('myExpenses', 'true');
      } else if (activeTab === 'pending') {
        query.append('status', 'pending');
      }
      
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
  }, [timeRange, activeTab]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Adding expense...');
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
      setFormData({ title: '', customTitle: '', amount: '', category: 'Operational', date: new Date().toISOString().split('T')[0], description: '' });
      fetchExpenses();
    } catch (error) {
      toast.error(error.message || 'Could not save expense. Please try again.', { id: loadToast });
    }
  };

  const handleApprove = async (id) => {
    const loadToast = toast.loading('Approving expense...');
    try {
      await api.patch(`/transactions/${id}/approve`);
      toast.success('Expense approved', { id: loadToast });
      setSelectedExpense(null);
      fetchExpenses();
    } catch (error) {
      const msg = error.response?.data?.message || 'Could not approve expense. Please try again.';
      toast.error(msg, { id: loadToast });
    }
  };

  const handleReject = async (id) => {
    const loadToast = toast.loading('Rejecting expense...');
    try {
      await api.patch(`/transactions/${id}/reject`);
      toast.error('Expense rejected', { id: loadToast });
      setSelectedExpense(null);
      fetchExpenses();
    } catch (error) {
      const msg = error.response?.data?.message || 'Could not reject expense. Please try again.';
      toast.error(msg, { id: loadToast });
    }
  };

  const filteredData = transactions.filter(t => {
    const matchesSearch = t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') {
      return matchesSearch && t.status === 'approved';
    }
    return matchesSearch;
  });

  const totalExpenditure = transactions
    .filter(t => t.status === 'approved')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const chartData = [...filteredData].reverse().slice(-30).map(t => ({
    date: new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    amount: t.totalAmount
  }));

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8 pb-24">
        {/* Header */}
        <div className="relative group overflow-hidden bg-(--color-surface) dark:bg-(--color-surface) rounded-xl p-10 border border-(--color-border) dark:border-(--color-border) shadow-sm ">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Receipt size={200} className="text-danger" strokeWidth={1} />
          </div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shadow-lg ">
                  <TrendingDown size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-(--color-text-primary) dark:text-white leading-none">
                    Branch <span className="text-danger">Expenses</span>
                  </h1>
                  <p className="text-(--color-text-muted) font-bold mt-2 flex items-center gap-2 text-sm">
                    <Sparkles size={14} className="text-primary" />
                    Track your daily expenses and costs.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 bg-(--color-surface-soft) dark:bg-(--color-bg) p-1.5 rounded-[1.5rem] border border-(--color-border) dark:border-(--color-border) shadow-inner">
                {['7d', '1m', 'all'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all duration-500 ${timeRange === t ? 'bg-danger text-white shadow-lg  scale-105' : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Button 
                variant="primary" 
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="!rounded-xl !py-4 px-8 bg-danger hover:bg-danger shadow-sm  scale-105  active:scale-95 transition-all"
              >
                Add Expense
              </Button>
            </div>
          </div>
        </div>

        {/* Dynamic Tabs */}
        <div className="flex items-center gap-10 border-b border-(--color-border) dark:border-(--color-border) px-10">
          <button 
            onClick={() => setActiveTab('all')}
            className={`pb-5 text-xs font-bold uppercase tracking-normal transition-all relative ${activeTab === 'all' ? 'text-danger' : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'}`}
          >
            All Expenses
            {activeTab === 'all' && <motion.div layoutId="tab-underline-ba" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button 
            onClick={() => setActiveTab('mine')}
            className={`pb-5 text-xs font-bold uppercase tracking-normal transition-all relative ${activeTab === 'mine' ? 'text-danger' : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'}`}
          >
            My Expenses
            {activeTab === 'mine' && <motion.div layoutId="tab-underline-ba" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`pb-5 text-xs font-bold uppercase tracking-normal transition-all relative ${activeTab === 'pending' ? 'text-danger' : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'}`}
          >
            Pending Review
            {activeTab === 'pending' && <motion.div layoutId="tab-underline-ba" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-danger transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search expenses..."
                  className="w-full pl-14 pr-6 py-5 bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) rounded-xl focus:ring-4 focus:ring-danger/10 outline-none transition-all font-bold text-sm text-(--color-text-primary) dark:text-(--color-text-primary) shadow-sm"
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
                  filename="branch_expenses"
                />
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={fetchExpenses}
                  isLoading={loading}
                  className="!rounded-xl !py-4 px-4 bg-(--color-surface-soft) dark:bg-(--color-surface) border-none hover:bg-(--color-surface-soft) dark:hover:bg-(--color-surface-soft)"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {refetching ? (
                [1, 2, 3, 4].map(i => <CardSkeleton key={i} />)
              ) : paginatedData.length === 0 ? (
                <div className="sm:col-span-2 py-32 text-center bg-(--color-surface-soft) dark:bg-(--color-bg)/40 rounded-xl border border-dashed border-(--color-border) dark:border-(--color-border)">
                  <p className="text-(--color-text-muted) font-bold text-lg tracking-tight">No expenses found.</p>
                </div>
              ) : (
                paginatedData.map((t, idx) => (
                  <SlideIn key={t._id} delay={idx * 0.03}>
                    <CardHover>
                      <div 
                        onClick={() => setSelectedExpense(t)}
                        className="bg-(--color-surface) dark:bg-(--color-surface) p-6 rounded-xl border border-(--color-border) dark:border-(--color-border) flex items-center justify-between group hover:border-danger/40 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shadow-inner transition-transform duration-500">
                            <ArrowDownRight size={24} strokeWidth={2.5} />
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="font-bold text-(--color-text-primary) dark:text-white tracking-tight text-base line-clamp-1">
                              {t.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted)">
                                {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-normal text-danger bg-danger/5 px-2.5 py-1 rounded-lg border border-danger/10">
                                {t.category}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold text-danger tracking-tight leading-none">-₹{t.totalAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-2">Paid</p>
                        </div>
                      </div>
                    </CardHover>
                  </SlideIn>
                ))
              )}
            </div>
          </div>

          <div className="space-y-8">
            <SlideIn direction="right" delay={0.2}>
              <div className="bg-(--color-text-primary) rounded-xl p-8 text-(--color-surface) shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-20 transition-transform duration-700">
                  <Activity size={100} strokeWidth={1} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-normal opacity-80 mb-6">Expense Trend</h3>
                <div className="space-y-6 relative z-10">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} fill="#f43f5e30" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="border-t border-(--color-border) pt-6">
                    <p className="text-[10px] font-bold uppercase tracking-normal opacity-60">Total Expense</p>
                    <p className="text-2xl font-bold tracking-tight mt-1 text-danger">₹{totalExpenditure.toLocaleString()}</p>
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
                  <div className="h-14 w-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shadow-inner">
                    <Receipt size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl font-bold text-(--color-text-primary) dark:text-white tracking-tight leading-none">{selectedExpense.title}</h3>
                      {selectedExpense.status === 'pending' && (
                        <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg animate-pulse">Pending Review</span>
                      )}
                      {selectedExpense.status === 'rejected' && (
                        <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-1 bg-(--color-surface-soft)/10 text-(--color-text-secondary) border border-(--color-border)/20 rounded-lg">Rejected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-normal px-4 py-1.5 bg-danger text-white rounded-xl shadow-lg ">{selectedExpense.category}</span>
                      <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) dark:bg-(--color-surface) px-4 py-1.5 rounded-xl flex items-center gap-2">
                        <Calendar size={12} /> {new Date(selectedExpense.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right bg-(--color-surface-soft) dark:bg-(--color-bg) p-6 rounded-xl border border-(--color-border) dark:border-(--color-border) min-w-[200px]">
                  <p className="text-4xl font-bold text-danger tracking-tight">₹{selectedExpense.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-2">Total Amount</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-(--color-surface) dark:bg-(--color-surface) p-8 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm relative overflow-hidden group">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <User size={12} className="text-danger" /> Created By
                  </p>
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) border-2 border-(--color-border) dark:border-(--color-border) flex items-center justify-center text-(--color-text-muted) overflow-hidden shadow-inner">
                      {selectedExpense.createdBy?.profileImageUrl ? (
                        <img src={selectedExpense.createdBy.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-danger">{selectedExpense.createdBy?.name?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-(--color-text-primary) dark:text-white leading-none">{selectedExpense.createdBy?.name || 'Unknown'}</p>
                      <p className="text-[10px] font-bold uppercase tracking-normal text-danger mt-1 bg-danger/5 px-2 py-0.5 rounded-lg w-fit">{selectedExpense.createdBy?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                  {selectedExpense.approvedBy && (
                    <div className="mt-4 pt-4 border-t border-(--color-border) dark:border-(--color-border)">
                      <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                        <Sparkles size={10} className="text-primary" /> Approved By {selectedExpense.approvedBy.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-(--color-surface) dark:bg-(--color-surface) p-8 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm relative overflow-hidden group">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <MapPin size={12} className="text-danger" /> Branch
                  </p>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-(--color-text-primary) dark:text-white leading-none">{selectedExpense.locationId?.name || 'Main Branch'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">{selectedExpense.locationId?.city || 'Branch'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2 mb-2 ml-4">
                  <Info size={12} className="text-danger" /> Description
                </p>
                <div className="p-8 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) relative">
                  <p className="text-sm font-medium text-(--color-text-secondary) dark:text-(--color-text-muted) leading-relaxed italic relative z-10">
                    &ldquo;{selectedExpense.description || 'No description provided.'}&rdquo;
                  </p>
                </div>
              </div>

              {selectedExpense.billImage && (
                <div className="space-y-6">
                <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2 mb-2 ml-4">
                  <Sparkles size={12} className="text-danger" /> Bill Image
                </p>
                  <div className="rounded-xl overflow-hidden border-4 border-(--color-border) dark:border-(--color-border) bg-(--color-surface) dark:bg-(--color-bg) p-3 shadow-sm relative group">
                    <img src={selectedExpense.billImage} alt="Bill" className="w-full h-auto rounded-xl transition-all duration-1000" />
                  </div>
                </div>
              )}

              {selectedExpense.status === 'pending' ? (
                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="primary" 
                    className="flex-1 !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs shadow-sm  bg-danger hover:bg-danger" 
                    icon={Sparkles}
                    onClick={() => handleApprove(selectedExpense._id)}
                  >
                    Approve Expense
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1 !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs border-(--color-border) dark:border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-primary)" 
                    onClick={() => handleReject(selectedExpense._id)}
                  >
                    Reject Expense
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="secondary" 
                  className="w-full !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs border-none bg-(--color-surface-soft) dark:bg-(--color-surface)" 
                  onClick={() => setSelectedExpense(null)}
                >
                  Exit
                </Button>
              )}
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
                    setFormData({...formData, title: val});
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
                    <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Enter Custom Title</label>
                    <input 
                      required 
                      className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-danger/10 transition-all outline-none" 
                      placeholder="e.g. Special equipment repair"
                      value={formData.customTitle}
                      onChange={e => setFormData({...formData, customTitle: e.target.value})}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Amount (₹)</label>
                  <input required type="number" className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-danger/10 transition-all outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                </div>
                <PremiumSelect 
                  label="Category"
                  value={formData.category}
                  onChange={val => setFormData({...formData, category: val})}
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
                <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Date</label>
                <input required type="date" className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-danger/10 transition-all outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Description</label>
                <textarea className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) p-5 text-sm font-medium dark:text-white focus:ring-4 focus:ring-danger/10 transition-all outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} placeholder="Add a short note about this expense..." />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full bg-primary !rounded-xl !py-6 shadow-sm  font-bold uppercase tracking-normal text-sm" icon={Sparkles}>Save Expense</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
