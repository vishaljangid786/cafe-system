'use client';

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { todayInput, toDateInput } from '@/app/utils/dateInput';
import { blockNegative } from '@/app/utils/inputValidation';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { CardSkeleton } from '@/app/components/ui/Skeleton';
import { useAuth } from '../../../context/AuthContext';
import { can } from '../../../config/actions';
import {
  TrendingDown, Search, Filter,
  ChevronRight, Calendar, MapPin,
  ArrowDownRight, Activity, Receipt,
  Plus, User, Info, ChevronDown,
  AlertCircle, Sparkles, Download,
  Layers, Wallet, ArrowUpRight, RefreshCw, Check
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
import DateRangeFilter from '../../../components/ui/DateRangeFilter';
import { Money } from '../../../components/ui/Money';
import { formatIndianCompact } from '../../../utils/formatNumber';
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
  const { user, selectedLocation, globalSearch } = useAuth();
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
  // Multi-branch filter — selected locationIds; [] = fall back to the global branch.
  const [branchFilter, setBranchFilter] = useState([]);
  const itemsPerPage = 12;

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  // Split-expense state: when on, the entry is divided across branches (one approved
  // expense per branch). splitAmounts maps locationId -> amount string; a branch is
  // "included" when its id is present as a key.
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    customTitle: '',
    amount: '',
    category: 'Daily',
    paymentMethod: 'CASH',
    date: todayInput(),
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
      }

      // Branch scope: an explicit multi-branch filter wins; otherwise fall back to
      // the single globally-selected branch (only on the 'all' tab, as before).
      if (branchFilter.length > 0) {
        query.append('locationIds', branchFilter.join(','));
      } else if (activeTab === 'all' && selectedLocation) {
        query.append('locationId', selectedLocation._id || selectedLocation);
      }

      const now = new Date();
      let start = '';
      let end = '';

      if (timeRange === 'custom') {
        start = customDates.start;
        end = customDates.end;
      } else if (timeRange === 'today') {
        start = toDateInput(now);
        end = start;
      } else if (timeRange === 'this_week') {
        const d = new Date();
        d.setDate(now.getDate() - now.getDay());
        start = toDateInput(d);
      } else if (timeRange === 'this_month') {
        const d = new Date();
        d.setDate(1);
        start = toDateInput(d);
      } else if (timeRange !== 'all') {
        const d = new Date();
        if (timeRange === '7d') d.setDate(now.getDate() - 7);
        else if (timeRange === '1m') d.setMonth(now.getMonth() - 1);
        else if (timeRange === '3m') d.setMonth(now.getMonth() - 3);
        start = toDateInput(d);
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
  }, [selectedLocation, timeRange, activeTab, customDates, currentPage, searchQuery, amountRange, branchFilter]);

  const resetAddForm = () => {
    setShowAddModal(false);
    setSplitMode(false);
    setSplitAmounts({});
    setShowCustomTitle(false);
    setFormData({ title: '', customTitle: '', amount: '', category: 'Daily', paymentMethod: 'CASH', date: todayInput(), description: '', locationId: '' });
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (splitMode) return handleSplitExpense();
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
      resetAddForm();
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Error', { id: loadToast });
    }
  };

  // Split-expense helpers ---------------------------------------------------
  const toggleSplitBranch = (locId) => {
    setSplitAmounts((prev) => {
      const next = { ...prev };
      if (locId in next) delete next[locId];
      else next[locId] = '';
      return next;
    });
  };

  const setSplitAmount = (locId, val) => setSplitAmounts((prev) => ({ ...prev, [locId]: val }));

  // Divide the top "Total Amount" evenly across the selected branches. Any rounding
  // remainder lands on the last branch so the parts always add back to the total.
  const splitEqually = () => {
    const ids = Object.keys(splitAmounts);
    const total = Number(formData.amount);
    if (ids.length === 0) return toast.error('Select branches to split across first');
    if (!Number.isFinite(total) || total <= 0) return toast.error('Enter a total amount to divide');
    const per = Math.floor((total / ids.length) * 100) / 100;
    const next = {};
    ids.forEach((id, i) => {
      next[id] = i === ids.length - 1
        ? Number((total - per * (ids.length - 1)).toFixed(2)).toString()
        : per.toString();
    });
    setSplitAmounts(next);
  };

  const splitTotal = Object.values(splitAmounts).reduce((a, v) => a + (Number(v) || 0), 0);

  const handleSplitExpense = async () => {
    const loadToast = toast.loading('Splitting expense...');
    try {
      const finalTitle = formData.title === "Other (Custom Title)" ? formData.customTitle : formData.title;
      if (!finalTitle) throw new Error("Title is required");

      const splits = Object.entries(splitAmounts)
        .filter(([locationId]) => locationId)
        .map(([locationId, amount]) => ({ locationId, amount: Number(amount) }));

      if (splits.length < 2) throw new Error("Select at least two branches to split across");
      if (splits.some((s) => !Number.isFinite(s.amount) || s.amount <= 0)) {
        throw new Error("Enter a positive amount for each selected branch");
      }

      await api.post('/transactions/split', {
        title: finalTitle,
        category: formData.category,
        date: formData.date,
        description: formData.description,
        paymentMethod: formData.paymentMethod,
        splits,
      });
      toast.success(`Expense split across ${splits.length} branches`, { id: loadToast });
      resetAddForm();
      fetchExpenses();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Could not split expense', { id: loadToast });
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
      const msg = error.response?.data?.message || 'Could not approve. Please try again.';
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
      toast.error('Could not reject. Please try again.', { id: loadToast });
    }
  };

  // Open a clean, print-ready expense receipt (used when there's no uploaded bill
  // image). Print/receipt output keeps EXACT full amounts, never the compact form.
  const printExpenseReceipt = (exp) => {
    if (!exp) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cafe = esc(exp.locationId?.cafe?.name || 'CafeOS');
    const branch = esc(exp.locationId?.name || 'Main Office');
    const city = esc(exp.locationId?.city || '');
    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
    const row = (label, val) => `<div class="row"><span class="muted">${label}</span><span>${val}</span></div>`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Expense Receipt</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;max-width:560px;margin:24px auto;padding:0 24px}
      h1{font-size:20px;margin:0}
      .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px dashed #ccc;padding-bottom:14px}
      .tag{color:#c0392b;font-weight:bold;text-transform:uppercase;font-size:12px}
      .muted{color:#777}
      .row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px}
      .item{border-top:2px dashed #ccc;margin-top:16px;padding-top:14px}
      .total{display:flex;justify-content:space-between;border-top:2px solid #111;margin-top:14px;padding-top:14px;font-size:18px;font-weight:bold}
    </style></head><body>
      <div class="hdr">
        <div><h1>${cafe}</h1><div class="muted">${branch}${city ? ` · ${city}` : ''}</div></div>
        <div style="text-align:right"><div class="tag">Expense Receipt</div><div class="muted">#${esc(String(exp._id || '').slice(-8).toUpperCase())}</div></div>
      </div>
      <div style="margin-top:16px">
        ${row('Date', esc(new Date(exp.date).toLocaleDateString()))}
        ${row('Category', esc(exp.category || ''))}
        ${row('Payment', esc(exp.paymentMethod || 'CASH'))}
        ${row('Created by', `${esc(exp.createdBy?.name || 'System')}${exp.createdBy?.role ? ` (${esc(exp.createdBy.role.replace('_', ' '))})` : ''}`)}
        ${row('Status', esc(exp.status || ''))}
        ${exp.approvedBy ? row('Approved by', esc(exp.approvedBy.name)) : ''}
      </div>
      <div class="item">
        <div class="row"><strong>${esc(exp.title || 'Expense')}</strong><span>${fmt(exp.totalAmount)}</span></div>
        ${exp.description ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(exp.description)}</div>` : ''}
      </div>
      <div class="total"><span>TOTAL</span><span>${fmt(exp.totalAmount)}</span></div>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`);
    win.document.close();
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
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="relative group overflow-hidden bg-(--color-surface) rounded-xl p-6 border border-(--color-border) shadow-sm ">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <Layers size={200} className="text-danger" strokeWidth={1} />
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-6 w-6 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger ">
                  <TrendingDown size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-(--color-text-primary) leading-none">
                    Expenses
                  </h1>
                  <p className="text-(--color-text-secondary) font-medium mt-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" />
                    Easily track and manage all cafe expenses.
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap items-center mt-6 gap-3">
                <div className="flex items-center gap-1.5 bg-(--color-surface-soft) p-1.5 rounded-[1.5rem] border border-(--color-border) shadow-inner">
                  {['7d', '1m', '3m', 'all'].map(t => (
                    <button
                      key={t}
                      onClick={() => { setTimeRange(t); setCustomDates({ start: '', end: '' }); setCurrentPage(1); }}
                      className={`px-6 py-2.5 text-[11px] font-medium uppercase tracking-normal rounded-xl transition-all duration-500 ${timeRange === t ? 'bg-danger text-(--color-bg-base) scale-105' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <DateRangeFilter
                  startDate={customDates.start}
                  endDate={customDates.end}
                  onChange={({ startDate, endDate }) => {
                    setCustomDates({ start: startDate, end: endDate });
                    setTimeRange(startDate || endDate ? 'custom' : 'all');
                    setCurrentPage(1);
                  }}
                  loading={refetching}
                  iconClassName="text-danger"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">

              {can(user, 'revenue.add') && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setShowAddModal(true)}
                  className="!rounded-xl !py-2.5 px-5 bg-danger hover:bg-danger/90  active:scale-95 transition-all text-(--color-bg-base)"
                >
                  New Entry
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6 pt-6 border-t border-(--color-border)">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Total Expenses</p>
              <p className="text-3xl font-semibold text-danger tracking-tight"><Money value={totalExpenditure} /></p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Average Expense</p>
              <p className="text-3xl font-semibold text-(--color-text-primary) tracking-tight"><Money value={avgExpense} decimals={0} /></p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Total Entries (View)</p>
              <p className="text-3xl font-semibold text-(--color-text-primary) tracking-tight">{paginatedData.length}</p>
            </div>
          </div>
        </div>
         <div className="flex flex-col md:flex-row gap-4 items-center sticky-filter !-mt-0">
              <div className="relative flex-1 min-w-0 w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-danger transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Search list..."
                  className="w-full pl-14 pr-6 py-2.5 bg-(--color-surface) border border-(--color-border) rounded-xl focus:ring-2 focus:ring-danger/10 outline-none transition-all font-medium text-sm text-(--color-text-primary) shadow-sm"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:shrink-0 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                <Button
                  variant="secondary"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`!py-2.5 px-5 rounded-xl border-none transition-all shadow-sm font-medium uppercase text-[11px] tracking-normal shrink-0 ${showFilters ? 'bg-danger text-(--color-bg-base)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'}`}
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
                  className="!rounded-xl !py-2.5 px-4 bg-(--color-surface-soft) border-none hover:bg-(--color-surface-hover)"
                />
              </div>
            </div>

            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-(--color-surface) p-5 rounded-xl border border-(--color-border) flex flex-wrap gap-5 items-end"
              >
                {locations.length > 1 && (
                  <div className="w-full">
                    <label className="block text-[11px] font-medium text-(--color-text-muted) mb-2 ml-1">Filter by Branches</label>
                    <div className="flex flex-wrap gap-2">
                      {locations.map(loc => {
                        const active = branchFilter.includes(loc._id);
                        return (
                          <button
                            key={loc._id}
                            type="button"
                            onClick={() => { setBranchFilter(prev => active ? prev.filter(id => id !== loc._id) : [...prev, loc._id]); setCurrentPage(1); }}
                            className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all ${active ? 'bg-danger text-(--color-bg-base) border-danger' : 'bg-(--color-bg-soft) text-(--color-text-muted) border-(--color-border) hover:border-danger/40'}`}
                          >
                            {active && <Check size={12} className="inline mr-1 -mt-0.5" />}{loc.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium text-(--color-text-muted) mb-2 ml-1">Min Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    onKeyDown={blockNegative}
                    placeholder="0"
                    className="w-32 bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-danger"
                    value={amountRange.min}
                    onChange={e => { setAmountRange(prev => ({ ...prev, min: e.target.value })); setCurrentPage(1); }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-(--color-text-muted) mb-2 ml-1">Max Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    onKeyDown={blockNegative}
                    placeholder="50000"
                    className="w-32 bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-danger"
                    value={amountRange.max}
                    onChange={e => { setAmountRange(prev => ({ ...prev, max: e.target.value })); setCurrentPage(1); }}
                  />
                </div>
                <Button
                  onClick={() => { setAmountRange({ min: '', max: '' }); setSearchQuery(''); setBranchFilter([]); setCurrentPage(1); }}
                  className="bg-(--color-surface-soft) text-(--color-text-primary) hover:bg-(--color-bg-soft) px-4 py-3 rounded-xl text-xs"
                >
                  Clear Filters
                </Button>
              </motion.div>
            )}

        {/* Dynamic Tabs */}
        <div className="flex items-center gap-5 border-b border-(--color-border) px-5">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-5 text-xs font-medium uppercase tracking-normal transition-all relative ${activeTab === 'all' ? 'text-danger font-semibold' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            All Expenses
            {activeTab === 'all' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`pb-5 text-xs font-medium uppercase tracking-normal transition-all relative ${activeTab === 'mine' ? 'text-danger font-semibold' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            My Expenses
            {activeTab === 'mine' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-5 text-xs font-medium uppercase tracking-normal transition-all relative ${activeTab === 'pending' ? 'text-danger font-semibold' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
          >
            Pending Review
            {activeTab === 'pending' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-danger rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
        </div>
        

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
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
                  <p className="text-(--color-text-muted) font-medium text-lg tracking-tight">No expenses found here.</p>
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
                               <h4 className="font-semibold text-(--color-text-primary) tracking-tight text-base line-clamp-1">
                                 {t.title}
                               </h4>
                               <div className="flex flex-wrap items-center gap-2">
                                 <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-(--color-bg-soft) text-(--color-text-muted) group-hover:bg-danger group-hover:text-(--color-on-primary) transition-colors">
                                   {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                 </span>
                                <span className="text-[11px] font-medium uppercase tracking-normal text-danger bg-danger/5 px-2.5 py-1 rounded-lg border border-danger/10">
                                  {t.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right relative z-10 shrink-0">
                            <p className="text-xl font-semibold text-danger tracking-tight leading-none transition-transform"><Money value={t.totalAmount} prefix="-" /></p>
                            <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-2">Verified</p>
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
                <div className="flex items-center gap-2 bg-(--color-surface) px-5 py-2.5 rounded-xl border border-(--color-border) shadow-sm font-medium tracking-normal text-[11px]">
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
          <div className="space-y-6">
            <SlideIn direction="right" delay={0.2}>
              <div className="bg-gradient-to-br from-danger to-danger/80 rounded-xl p-5 text-(--color-bg-base) shadow-sm  relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-20 transition-transform duration-700">
                  <Wallet size={100} strokeWidth={1} />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-normal opacity-80 mb-6">Expense Trend</h3>
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
                      <p className="text-[11px] font-medium uppercase tracking-normal opacity-60">Today&apos;s Total</p>
                      <p className="text-2xl font-semibold tracking-tight mt-1"><Money value={totalExpenditure} /></p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-(--color-bg-base)/10 flex items-center justify-center  border border-(--color-bg-base)/10">
                      <ArrowUpRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="right" delay={0.3}>
              <div className="bg-(--color-surface) rounded-xl p-5 border border-(--color-border) shadow-sm space-y-6">
                <h3 className="text-xs font-semibold uppercase tracking-normal text-(--color-text-primary) flex items-center gap-2">
                  <Layers size={14} className="text-danger" /> Category Wise
                </h3>
                <div className="space-y-4">
                  {['Daily', 'Inventory', 'Utilities', 'Marketing'].map(cat => {
                    const amount = paginatedData.filter(t => t.category === cat).reduce((acc, curr) => acc + curr.totalAmount, 0);
                    const percentage = totalExpenditure > 0 ? (amount / totalExpenditure) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-medium uppercase tracking-normal">
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
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger shadow-inner">
                    <Receipt size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight leading-none">{selectedExpense.title}</h3>
                      {selectedExpense.status === 'pending' && (
                        <span className="text-[11px] font-medium uppercase tracking-normal px-2 py-1 bg-primary/10 text-primary-dark dark:text-primary border border-primary/20 rounded-lg">Pending Review</span>
                      )}
                      {selectedExpense.status === 'rejected' && (
                        <span className="text-[11px] font-medium uppercase tracking-normal px-2 py-1 bg-(--color-surface-soft) text-(--color-text-muted) border border-(--color-border) rounded-lg">Rejected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[11px] font-medium uppercase tracking-normal px-2.5 py-1 bg-danger text-(--color-bg-base) rounded-xl ">{selectedExpense.category}</span>
                      <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) bg-(--color-surface-soft) px-2.5 py-1 rounded-xl flex items-center gap-2">
                        <Calendar size={12} /> {new Date(selectedExpense.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right bg-(--color-bg-soft) p-5 rounded-xl border border-(--color-border) min-w-50">
                  <p className="text-3xl font-semibold text-danger tracking-tight"><Money value={selectedExpense.totalAmount} /></p>
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-2">Total Amount</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-(--color-surface) p-5 rounded-xl border border-(--color-border) shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <User size={60} strokeWidth={1} />
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <User size={12} className="text-danger" /> Created By
                  </p>
                  <div className="flex items-center gap-5">
                    <div className="h-16 w-16 rounded-xl bg-(--color-surface-soft) border-2 border-(--color-border) flex items-center justify-center text-(--color-text-muted) overflow-hidden shadow-inner">
                      {selectedExpense.createdBy?.profileImageUrl ? (
                        <img src={selectedExpense.createdBy.profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-semibold text-danger">{selectedExpense.createdBy?.name?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-medium text-(--color-text-primary) leading-none">{selectedExpense.createdBy?.name || 'System'}</p>
                      <p className="text-[11px] font-medium uppercase tracking-normal text-danger mt-1 bg-danger/5 px-2 py-0.5 rounded-lg w-fit">{selectedExpense.createdBy?.role?.replace('_', ' ') || 'Staff'}</p>
                    </div>
                  </div>
                  {selectedExpense.approvedBy && (
                    <div className="mt-4 pt-4 border-t border-(--color-border)">
                      <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                        <Sparkles size={10} className="text-primary" /> Approved By {selectedExpense.approvedBy.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-(--color-surface) p-5 rounded-xl border border-(--color-border) shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <MapPin size={60} strokeWidth={1} />
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                    <MapPin size={12} className="text-danger" /> Branch
                  </p>
                  <div className="space-y-1">
                    <p className="text-base font-medium text-(--color-text-primary) leading-none">{selectedExpense.locationId?.name || 'Main Office'}</p>
                    <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-1">{selectedExpense.locationId?.city || 'Location'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2 ml-2">
                  <Info size={12} className="text-danger" /> Description
                </p>
                <div className="p-5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) relative">
                  <p className="text-sm font-medium text-(--color-text-secondary) leading-relaxed relative z-10">
                    &ldquo;{selectedExpense.description || 'No description provided for this expense.'}&rdquo;
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-2">
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                    <Sparkles size={12} className="text-danger" /> Bill / Receipt
                  </p>
                  {!selectedExpense.billImage && (
                    <button
                      onClick={() => printExpenseReceipt(selectedExpense)}
                      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-normal text-danger hover:text-danger/80 bg-danger/5 hover:bg-danger/10 px-2.5 py-1.5 rounded-lg border border-danger/20 transition-colors"
                    >
                      <Download size={12} /> Download
                    </button>
                  )}
                </div>

                {selectedExpense.billImage ? (
                  <div className="rounded-xl overflow-hidden border-4 border-(--color-surface-soft) bg-(--color-surface) p-3 shadow-sm relative group">
                    <img src={selectedExpense.billImage} alt="Receipt" className="w-full h-auto rounded-xl transition-all duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                ) : (
                  /* No uploaded bill — render a generated receipt from the expense details. */
                  <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden shadow-sm">
                    <div className="flex items-start justify-between gap-4 bg-(--color-surface-soft) px-5 py-4 border-b border-dashed border-(--color-border)">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-(--color-text-primary) tracking-tight truncate">{selectedExpense.locationId?.cafe?.name || 'CafeOS'}</p>
                        <p className="text-[11px] text-(--color-text-muted) truncate">
                          {selectedExpense.locationId?.name || 'Main Office'}{selectedExpense.locationId?.city ? ` · ${selectedExpense.locationId.city}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-danger">Expense Receipt</p>
                        <p className="text-[10px] font-mono text-(--color-text-muted) mt-0.5">#{String(selectedExpense._id || '').slice(-8).toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-2 text-xs">
                      {[
                        ['Date', new Date(selectedExpense.date).toLocaleDateString()],
                        ['Category', selectedExpense.category],
                        ['Payment', selectedExpense.paymentMethod || 'CASH'],
                        ['Created by', `${selectedExpense.createdBy?.name || 'System'}${selectedExpense.createdBy?.role ? ` (${selectedExpense.createdBy.role.replace('_', ' ')})` : ''}`],
                        ['Status', selectedExpense.status],
                        ...(selectedExpense.approvedBy ? [['Approved by', selectedExpense.approvedBy.name]] : []),
                      ].map(([label, val]) => (
                        <div key={label} className="flex items-center justify-between gap-4">
                          <span className="text-(--color-text-muted) font-medium">{label}</span>
                          <span className="text-(--color-text-primary) font-medium text-right capitalize truncate">{val}</span>
                        </div>
                      ))}
                    </div>

                    <div className="px-5 py-3 border-t border-dashed border-(--color-border)">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-(--color-text-primary) truncate">{selectedExpense.title}</p>
                          {selectedExpense.description && (
                            <p className="text-[11px] text-(--color-text-muted) mt-0.5 line-clamp-2">{selectedExpense.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-(--color-text-primary) shrink-0"><Money value={selectedExpense.totalAmount} /></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 bg-danger/5 border-t border-(--color-border)">
                      <span className="text-[11px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total</span>
                      <span className="text-xl font-bold text-danger"><Money value={selectedExpense.totalAmount} /></span>
                    </div>
                  </div>
                )}
              </div>

              {selectedExpense.status === 'pending' && can(user, 'revenue.approve') ? (
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="primary"
                    className="flex-1 !rounded-xl !py-4 font-semibold uppercase tracking-normal text-xs shadow-sm  bg-danger hover:bg-danger/90 text-(--color-bg-base)"
                    icon={Sparkles}
                    onClick={() => handleApprove(selectedExpense._id)}
                  >
                    Approve Expense
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 !rounded-xl !py-4 font-medium uppercase tracking-normal text-xs border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary)"
                    onClick={() => handleReject(selectedExpense._id)}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="flex gap-4 pt-4">
                  <Button
                    variant="secondary"
                    className="flex-1 !rounded-xl !py-4 font-medium uppercase tracking-normal text-xs border-none bg-(--color-surface-soft)"
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
        <Modal isOpen={showAddModal} onClose={resetAddForm} title="New Expense" maxWidth="max-w-xl">
          <form onSubmit={handleAddExpense} className="space-y-6 p-2">
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
                    <label className="text-[11px] font-medium uppercase tracking-normal text-danger ml-2">Enter Title</label>
                    <input
                      required
                      className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-danger/10 transition-all outline-none"
                      placeholder="e.g. Electricity Bill"
                      value={formData.customTitle}
                      onChange={e => setFormData({ ...formData, customTitle: e.target.value })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-medium uppercase tracking-normal text-danger ml-2">{splitMode ? 'Total to Divide (₹)' : 'Amount (₹)'}</label>
                  <input required={!splitMode} type="number" min="0" onKeyDown={blockNegative} className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-danger/10 transition-all outline-none" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
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

              {/* Payment method — only CASH expenses are deducted from the cash drawer. */}
              <div className="space-y-3">
                <PremiumSelect
                  label="Paid With"
                  value={formData.paymentMethod}
                  onChange={(val) => setFormData({ ...formData, paymentMethod: val })}
                  options={[
                    { label: 'Cash (deducts from drawer)', value: 'CASH' },
                    { label: 'UPI', value: 'UPI' }
                  ]}
                />
              </div>

              {/* Split toggle — only when the user manages more than one branch */}
              {locations.length > 1 && (
                <div className="flex items-center justify-between rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4">
                  <div className="flex items-center gap-3">
                    <Layers size={16} className="text-danger" />
                    <div>
                      <p className="text-xs font-semibold text-(--color-text-primary)">Split across branches</p>
                      <p className="text-[11px] text-(--color-text-muted)">Divide this expense over multiple branches.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSplitMode(v => !v)}
                    aria-pressed={splitMode}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${splitMode ? 'bg-danger' : 'bg-(--color-surface-soft)'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${splitMode ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>
              )}

              {!splitMode ? (
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
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium uppercase tracking-normal text-danger ml-2">Branches &amp; Amounts</label>
                    <button type="button" onClick={splitEqually} className="text-[11px] font-semibold text-danger hover:underline">Split equally</button>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {locations.map(loc => {
                      const included = loc._id in splitAmounts;
                      return (
                        <div key={loc._id} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${included ? 'border-danger/40 bg-danger/5' : 'border-(--color-border) bg-(--color-bg-soft)'}`}>
                          <button
                            type="button"
                            onClick={() => toggleSplitBranch(loc._id)}
                            className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${included ? 'bg-danger border-danger text-white' : 'border-(--color-border) text-transparent'}`}
                          >
                            <Check size={13} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-(--color-text-primary)">{loc.name}</p>
                            <p className="truncate text-[11px] text-(--color-text-muted)">{loc.city}</p>
                          </div>
                          <div className="relative w-28 shrink-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) text-xs">₹</span>
                            <input
                              type="number" min="0" onKeyDown={blockNegative}
                              disabled={!included}
                              value={splitAmounts[loc._id] ?? ''}
                              onChange={e => setSplitAmount(loc._id, e.target.value)}
                              placeholder="0"
                              className="w-full rounded-lg bg-(--color-surface) border border-(--color-border) py-2 pl-6 pr-2 text-xs font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-danger/10 disabled:opacity-40"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-(--color-bg-soft) border border-(--color-border) px-4 py-3">
                    <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Split total · {Object.keys(splitAmounts).length} branches</span>
                    <span className="text-sm font-semibold text-danger"><Money value={splitTotal} sensitive={false} /></span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[11px] font-medium uppercase tracking-normal text-danger ml-2">Date</label>
                <input required type="date" className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-danger/10 transition-all outline-none" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-medium uppercase tracking-normal text-danger ml-2">Notes / Description</label>
                <textarea className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-5 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-danger/10 transition-all outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Enter details about this expense..." />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !rounded-xl !py-4 shadow-sm  font-semibold uppercase tracking-normal text-sm bg-danger text-(--color-bg-base)" icon={Sparkles}>{splitMode ? `Split Expense${splitTotal > 0 ? ` · ${formatIndianCompact(splitTotal, { currency: true })}` : ''}` : 'Add Expense'}</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
