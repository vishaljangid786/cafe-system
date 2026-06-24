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
  AlertCircle, Sparkles, Download,
  Layers, Wallet, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
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

export default function ExpensesPage() {
  const { user, selectedLocation, switchLocation, globalSearch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [timeRange, setTimeRange] = useState('all');

  // NEW STATES FOR SERVER-SIDE PAGINATION & SEARCH
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExpenditure, setTotalExpenditure] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'mine', 'pending'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [locations, setLocations] = useState([]);
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const itemsPerPage = 12;

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    customTitle: '',
    amount: '',
    category: 'Daily',
    date: new Date().toISOString().split('T')[0],
    description: '',
    locationId: ''
  });

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error('Failed to fetch locations');
    }
  };

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
      } else if (selectedLocation) {
        query.append('locationId', selectedLocation._id || selectedLocation);
      }

      const now = new Date();
      let start = '';
      let end = '';

      if (timeRange === 'custom') {
        start = customDates.start;
        end = customDates.end;
      } else if (timeRange === 'today') {
        start = now.toISOString().split('T')[0];
        end = start;
      } else if (timeRange === 'this_week') {
        const d = new Date();
        d.setDate(now.getDate() - now.getDay());
        start = d.toISOString().split('T')[0];
      } else if (timeRange === 'this_month') {
        const d = new Date();
        d.setDate(1);
        start = d.toISOString().split('T')[0];
      } else if (timeRange !== 'all') {
        const d = new Date();
        if (timeRange === '7d') d.setDate(now.getDate() - 7);
        else if (timeRange === '1m') d.setMonth(now.getMonth() - 1);
        else if (timeRange === '3m') d.setMonth(now.getMonth() - 3);
        start = d.toISOString().split('T')[0];
      }

      if (start) query.append('startDate', start);
      if (end) query.append('endDate', end);

      // Pagination & Search
      query.append('page', currentPage);
      query.append('limit', itemsPerPage);
      if (searchQuery) query.append('search', searchQuery);
      if (amountRange.min) query.append('minAmount', amountRange.min);
      if (amountRange.max) query.append('maxAmount', amountRange.max);

      // Fetch
      const res = await api.get(`/transactions?${query.toString()}`);
      setTransactions(res.data.data || []);

      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages);
      }

      if (res.data.totalExpense !== undefined) {
        setTotalExpenditure(res.data.totalExpense);
      }

    } catch (err) {
      console.error('Expenses load failed');
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
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        fetchLocations();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedLocation, timeRange, activeTab, customDates, currentPage, searchQuery, amountRange]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Saving expense...');
    try {
      const finalTitle = formData.title === "Other (Custom Title)" ? formData.customTitle : formData.title;
      if (!finalTitle) throw new Error("Title is required");

      const finalLocationId = formData.locationId || (selectedLocation?._id || selectedLocation);
      if (!finalLocationId) throw new Error("Location selection is required for cross-branch entry");

      const data = {
        ...formData,
        title: finalTitle,
        locationId: finalLocationId,
        type: 'EXPENSE'
      };

      await api.post('/transactions', data);
      toast.success('Expense saved', { id: loadToast });
      setShowAddModal(false);
      setFormData({ title: '', customTitle: '', amount: '', category: 'Daily', date: new Date().toISOString().split('T')[0], description: '', locationId: '' });
      fetchExpenses();
    } catch (error) {
      toast.error(error.message || 'Error', { id: loadToast });
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
      toast.error('Could not approve. Please try again.', { id: loadToast });
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
      toast.error('Could not reject. Please try again.', { id: loadToast });
    }
  };

  // Server-side filtering paginated data
  const paginatedData = transactions || [];

  // Avg expense for current view
  const avgExpense = paginatedData.length > 0 ? (paginatedData.reduce((acc, curr) => acc + curr.totalAmount, 0) / paginatedData.length) : 0;

  const chartData = [...paginatedData].reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    amount: t.totalAmount
  }));

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8 pb-24">
        {/* Header */}
        <div className="relative group overflow-hidden bg-(--color-surface) rounded-xl p-10 border border-(--color-border) shadow-sm ">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Layers size={200} className="text-danger" strokeWidth={1} />
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shadow-lg ">
                  <TrendingDown size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-(--color-text-primary) leading-none">
                    Expenses
                  </h1>
                  <p className="text-(--color-text-secondary) font-bold mt-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" />
                    Easily track and manage all cafe expenses.
                  </p>

                </div>

              </div>

              <div className="flex items-center mt-10 gap-1.5 bg-(--color-surface-soft) p-1.5 rounded-[1.5rem] border border-(--color-border) shadow-inner">
                {['7d', '1m', '3m', 'all', 'custom'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all duration-500 ${timeRange === t ? 'bg-danger text-(--color-bg-base) shadow-lg  scale-105' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">

              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                <PremiumSelect
                  icon={MapPin}
                  label="Branch"
                  value={selectedLocation?._id || selectedLocation || 'all'}
                  onChange={(val) => {
                    const loc = val === 'all' ? 'all' : locations.find(l => l._id === val);
                    switchLocation(loc);
                  }}
                  options={[
                    { label: 'All Branches', value: 'all' },
                    ...locations.map(loc => ({ label: loc.name, value: loc._id }))
                  ]}
                  className="min-w-45 !py-2.5"
                />
              )}
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowAddModal(true)}
                className="!rounded-xl !py-4 px-8 bg-danger hover:bg-danger/90 shadow-sm  scale-105  active:scale-95 transition-all text-(--color-bg-base)"
              >
                New Entry
              </Button>
            </div>
          </div>

          {timeRange === 'custom' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 mt-10 p-8 bg-(--color-bg-soft) border border-(--color-border) rounded-xl relative z-20"
            >
               <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-2">Start Date</label>
                <input type="date" className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl p-4 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-4 focus:ring-danger/10 transition-all" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-2">End Date</label>
                <input type="date" className="w-full bg-(--color-surface) border border-(--color-border) rounded-xl p-4 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-4 focus:ring-danger/10 transition-all" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-(--color-border)">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total Expenses</p>
              <p className="text-3xl font-bold text-danger tracking-tight">₹{totalExpenditure.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Average Expense</p>
              <p className="text-3xl font-bold text-(--color-text-primary) tracking-tight">₹{avgExpense.toFixed(0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total Entries (View)</p>
              <p className="text-3xl font-bold text-(--color-text-primary) tracking-tight">{paginatedData.length}</p>
            </div>
          </div>
        </div>
         <div className="flex flex-col md:flex-row gap-4 items-center sticky-filter !-mt-0">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-danger transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search list..."
                  className="w-full pl-14 pr-6 py-4 bg-(--color-surface) border border-(--color-border) rounded-xl focus:ring-4 focus:ring-danger/10 outline-none transition-all font-bold text-sm text-(--color-text-primary) shadow-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                <Button
                  variant="secondary"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`!py-4 px-6 rounded-xl border-none transition-all shadow-sm font-bold uppercase text-[9px] tracking-normal shrink-0 ${showFilters ? 'bg-danger text-(--color-bg-base)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'}`}
                >
                  <Filter size={16} className="mr-2" /> Filters
                </Button>
                <ExportActions
                  data={paginatedData}
                  columns={[
                    { header: 'Title', key: 'title' },
                    { header: 'Category', key: 'category' },
                    { header: 'Date', key: item => new Date(item.date).toLocaleDateString() },
                    { header: 'Amount', key: 'totalAmount' },
                    { header: 'Created By', key: item => item.createdBy?.name }
                  ]}
                  filename="Expenses_Report"
                />
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={fetchExpenses}
                  isLoading={refetching}
                  className="!rounded-xl !py-4 px-4 bg-(--color-surface-soft) border-none hover:bg-(--color-surface-hover)"
                />
              </div>
            </div>

            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-(--color-surface) p-6 rounded-xl border border-(--color-border) flex flex-wrap gap-6 items-end"
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">Min Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-32 bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-danger"
                    value={amountRange.min}
                    onChange={e => { setAmountRange(prev => ({ ...prev, min: e.target.value })); setCurrentPage(1); }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">Max Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="50000"
                    className="w-32 bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-danger"
                    value={amountRange.max}
                    onChange={e => { setAmountRange(prev => ({ ...prev, max: e.target.value })); setCurrentPage(1); }}
                  />
                </div>
                <Button
                  onClick={() => { setAmountRange({ min: '', max: '' }); setSearchQuery(''); setCurrentPage(1); }}
                  className="bg-(--color-surface-soft) text-(--color-text-primary) hover:bg-(--color-bg-soft) px-4 py-3 rounded-xl text-xs"
                >
                  Clear Filters
                </Button>
              </motion.div>
            )}

        {/* Dynamic Tabs */}
        <div className="flex items-center gap-10 border-b border-(--color-border) px-10">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-5 text-xs font-bold uppercase tracking-normal transition-all relative ${activeTab === 'all' ? 'text-danger' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            All Expenses
            {activeTab === 'all' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`pb-5 text-xs font-bold uppercase tracking-normal transition-all relative ${activeTab === 'mine' ? 'text-danger' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            My Expenses
            {activeTab === 'mine' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-5 text-xs font-bold uppercase tracking-normal transition-all relative ${activeTab === 'pending' ? 'text-danger' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            Pending Review
            {activeTab === 'pending' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
        </div>
        

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          {/* Main List Section */}
          <div className="xl:col-span-2 space-y-6">
           

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {refetching ? (
                [1, 2, 3, 4].map(i => <CardSkeleton key={i} />)
              ) : paginatedData.length === 0 ? (
                <div className="sm:col-span-2 py-32 text-center bg-(--color-surface-soft)/40 rounded-xl border border-dashed border-(--color-border) flex flex-col items-center justify-center">
                  <div className="h-20 w-20 rounded-xl bg-(--color-surface-soft) flex items-center justify-center text-(--color-text-muted) mb-6">
                    <Receipt size={40} strokeWidth={1} />
                  </div>
                  <p className="text-(--color-text-muted) font-bold text-lg tracking-tight">No expenses found here.</p>
                  <p className="text-(--color-text-muted) text-xs mt-2 font-medium">Try adjusting your filters or time range.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginatedData.map((t, idx) => (
                    <SlideIn key={t._id} delay={idx * 0.03}>
                      <CardHover>
                        <div
                          onClick={() => setSelectedExpense(t)}
                          className="bg-(--color-surface) p-6 rounded-xl border border-(--color-border) flex items-center justify-between group hover:border-danger/40 transition-all cursor-pointer relative overflow-hidden h-full shadow-sm"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="h-14 w-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shadow-inner transition-transform duration-500">
                              <ArrowDownRight size={24} strokeWidth={2.5} />
                            </div>
                            <div className="space-y-1.5">
                               <h4 className="font-bold text-(--color-text-primary) tracking-tight text-base line-clamp-1">
                                 {t.title}
                               </h4>
                               <div className="flex flex-wrap items-center gap-2">
                                 <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg bg-(--color-bg-soft) text-(--color-text-muted) group-hover:bg-danger group-hover:text-(--color-on-primary) transition-colors">
                                   {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                 </span>
                                <span className="text-[9px] font-bold uppercase tracking-normal text-danger bg-danger/5 px-2.5 py-1 rounded-lg border border-danger/10">
                                  {t.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right relative z-10 shrink-0">
                            <p className="text-xl font-bold text-danger tracking-tight leading-none transition-transform">-₹{t.totalAmount.toLocaleString()}</p>
                            <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-2">Verified</p>
                          </div>
                        </div>
                      </CardHover>
                    </SlideIn>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-10">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="h-12 w-12 rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) disabled:opacity-20 hover:border-danger/50 hover:text-danger transition-all shadow-sm"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <div className="flex items-center gap-2 bg-(--color-surface) px-6 py-2.5 rounded-xl border border-(--color-border) shadow-sm font-bold tracking-normal text-[10px]">
                  <span className="text-(--color-text-primary)">{currentPage}</span>
                  <span className="text-(--color-text-muted)">/ {totalPages}</span>
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="h-12 w-12 rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) disabled:opacity-20 hover:border-danger/50 hover:text-danger transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Analytics Sidebar */}
          <div className="space-y-8">
            <SlideIn direction="right" delay={0.2}>
              <div className="bg-gradient-to-br from-danger to-danger/80 rounded-xl p-8 text-(--color-bg-base) shadow-sm  relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-20 transition-transform duration-700">
                  <Wallet size={100} strokeWidth={1} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-normal opacity-80 mb-6">Expense Trend</h3>
                <div className="space-y-6 relative z-10">
                  <div className="h-50 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorWhite" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-bg-base)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-bg-base)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="amount" stroke="var(--color-bg-base)" strokeWidth={3} fill="url(#colorWhite)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between items-end border-t border-(--color-bg-base)/20 pt-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-normal opacity-60">Today&apos;s Total</p>
                      <p className="text-2xl font-bold tracking-tight mt-1">₹{totalExpenditure.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-(--color-bg-base)/10 flex items-center justify-center  border border-(--color-bg-base)/10">
                      <ArrowUpRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="right" delay={0.3}>
              <div className="bg-(--color-surface) rounded-xl p-8 border border-(--color-border) shadow-sm space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-primary) flex items-center gap-2">
                  <Layers size={14} className="text-danger" /> Category Wise
                </h3>
                <div className="space-y-4">
                  {['Daily', 'Inventory', 'Utilities', 'Marketing'].map(cat => {
                    const amount = paginatedData.filter(t => t.category === cat).reduce((acc, curr) => acc + curr.totalAmount, 0);
                    const percentage = totalExpenditure > 0 ? (amount / totalExpenditure) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-normal">
                          <span className="text-(--color-text-muted)">{cat}</span>
                          <span className="text-(--color-text-primary)">{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full bg-(--color-bg-soft) rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-danger rounded-full "
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SlideIn>
          </div>
        </div>

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
                      <h3 className="text-3xl font-bold text-(--color-text-primary) tracking-tight leading-none">{selectedExpense.title}</h3>
                      {selectedExpense.status === 'pending' && (
                        <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-1 bg-primary/10 text-primary-dark dark:text-primary border border-primary/20 rounded-lg animate-pulse">Pending Review</span>
                      )}
                      {selectedExpense.status === 'rejected' && (
                        <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-1 bg-(--color-surface-soft) text-(--color-text-muted) border border-(--color-border) rounded-lg">Rejected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-normal px-4 py-1.5 bg-danger text-(--color-bg-base) rounded-xl shadow-lg ">{selectedExpense.category}</span>
                      <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) px-4 py-1.5 rounded-xl flex items-center gap-2">
                        <Calendar size={12} /> {new Date(selectedExpense.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right bg-(--color-bg-soft) p-6 rounded-xl border border-(--color-border) min-w-50">
                  <p className="text-4xl font-bold text-danger tracking-tight">₹{selectedExpense.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-2">Total Amount</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <User size={60} strokeWidth={1} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <User size={12} className="text-danger" /> Created By
                  </p>
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-xl bg-(--color-surface-soft) border-2 border-(--color-border) flex items-center justify-center text-(--color-text-muted) overflow-hidden shadow-inner">
                      {selectedExpense.createdBy?.profileImageUrl ? (
                        <img src={selectedExpense.createdBy.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-danger">{selectedExpense.createdBy?.name?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-(--color-text-primary) leading-none">{selectedExpense.createdBy?.name || 'System'}</p>
                      <p className="text-[10px] font-bold uppercase tracking-normal text-danger mt-1 bg-danger/5 px-2 py-0.5 rounded-lg w-fit">{selectedExpense.createdBy?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                  {selectedExpense.approvedBy && (
                    <div className="mt-4 pt-4 border-t border-(--color-border)">
                      <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                        <Sparkles size={10} className="text-primary" /> Approved By {selectedExpense.approvedBy.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-(--color-surface) p-8 rounded-xl border border-(--color-border) shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <MapPin size={60} strokeWidth={1} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <MapPin size={12} className="text-danger" /> Branch
                  </p>
                  <div className="space-y-1">
                    <p className="text-base font-bold text-(--color-text-primary) leading-none">{selectedExpense.locationId?.name || 'Main Office'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">{selectedExpense.locationId?.city || 'Location'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2 ml-2">
                  <Info size={12} className="text-danger" /> Description
                </p>
                <div className="p-8 rounded-xl bg-(--color-surface-soft) border border-(--color-border) relative">
                  <p className="text-sm font-medium text-(--color-text-secondary) leading-relaxed italic relative z-10">
                    &ldquo;{selectedExpense.description || 'No description provided for this expense.'}&rdquo;
                  </p>
                </div>
              </div>

              {selectedExpense.billImage && (
                <div className="space-y-6">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2 ml-2">
                    <Sparkles size={12} className="text-danger" /> Bill / Receipt
                  </p>
                  <div className="rounded-xl overflow-hidden border-4 border-(--color-surface-soft) bg-(--color-surface) p-3 shadow-sm relative group">
                    <img src={selectedExpense.billImage} alt="Receipt" className="w-full h-auto rounded-xl transition-all duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                </div>
              )}

              {selectedExpense.status === 'pending' ? (
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="primary"
                    className="flex-1 !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs shadow-sm  bg-danger hover:bg-danger/90 text-(--color-bg-base)"
                    icon={Sparkles}
                    onClick={() => handleApprove(selectedExpense._id)}
                  >
                    Approve Expense
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary)"
                    onClick={() => handleReject(selectedExpense._id)}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="flex gap-4 pt-4">
                  {(selectedExpense.proofImage || selectedExpense.billImage) && (
                    <Button
                      variant="primary"
                      className="flex-1 !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs shadow-sm  bg-danger text-(--color-bg-base)"
                      icon={Download}
                      onClick={() => window.open(selectedExpense.proofImage || selectedExpense.billImage, '_blank')}
                    >
                      Download Receipt
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="flex-1 !rounded-xl !py-6 font-bold uppercase tracking-normal text-xs border-none bg-(--color-surface-soft)"
                    onClick={() => setSelectedExpense(null)}
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="New Expense" maxWidth="max-w-xl">
          <form onSubmit={handleAddExpense} className="space-y-8 p-2">
            <div className="space-y-6">
              <div className="space-y-3">
                <PremiumSelect
                  label="Expense Title"
                  value={formData.title}
                  onChange={(val) => {
                    setFormData({ ...formData, title: val });
                    setShowCustomTitle(val === "Other (Custom Title)");
                  }}
                  placeholder="Select Expense Title"
                  options={EXPENSE_TITLES.map(title => ({ label: title, value: title }))}
                />
              </div>

              <AnimatePresence>
                {showCustomTitle && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -20 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -20 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Enter Title</label>
                    <input
                      required
                      className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-bold text-(--color-text-primary) focus:ring-4 focus:ring-danger/10 transition-all outline-none"
                      placeholder="e.g. Electricity Bill"
                      value={formData.customTitle}
                      onChange={e => setFormData({ ...formData, customTitle: e.target.value })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Amount (₹)</label>
                  <input required type="number" className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-bold text-(--color-text-primary) focus:ring-4 focus:ring-danger/10 transition-all outline-none" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-3">
                  <PremiumSelect
                    label="Category"
                    value={formData.category}
                    onChange={(val) => setFormData({ ...formData, category: val })}
                    options={[
                      { label: 'Daily', value: 'Daily' },
                      { label: 'Inventory', value: 'Inventory' },
                      { label: 'Utilities', value: 'Utilities' },
                      { label: 'Marketing', value: 'Marketing' },
                      { label: 'Staff Welfare', value: 'Welfare' },
                      { label: 'Other', value: 'Other' }
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <PremiumSelect
                  label="Select Branch"
                  icon={MapPin}
                  value={formData.locationId || (selectedLocation?._id || selectedLocation || '')}
                  onChange={(val) => setFormData({ ...formData, locationId: val })}
                  placeholder="Select Branch"
                  options={locations.map(loc => ({ label: `${loc.name} (${loc.city})`, value: loc._id }))}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Date</label>
                <input required type="date" className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-bold text-(--color-text-primary) focus:ring-4 focus:ring-danger/10 transition-all outline-none" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-normal text-danger ml-2">Notes / Description</label>
                <textarea className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-medium text-(--color-text-primary) focus:ring-4 focus:ring-danger/10 transition-all outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Enter details about this expense..." />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !rounded-xl !py-6 shadow-sm  font-bold uppercase tracking-normal text-sm bg-danger text-(--color-bg-base)" icon={Sparkles}>Add Expense</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
