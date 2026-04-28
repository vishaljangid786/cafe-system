'use client';

import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  TrendingUp, IndianRupee, Search, Filter,
  ChevronRight, Calendar, MapPin, Target,
  ArrowUpRight, Activity, Wallet, Receipt,
  User, Clock, ShoppingBag, CheckCircle2,
  Tag, CreditCard, Hash, Info
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
import { useTheme } from '../../../context/ThemeContext';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function RevenuePage() {
  const { theme } = useTheme();
  const { user, selectedLocation, switchLocation, globalSearch } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // NEW STATES FOR SERVER-SIDE PAGINATION & SEARCH
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);

  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [locations, setLocations] = useState([]);
  const itemsPerPage = 20;

  const isDark = theme === 'dark';

  const chartColors = {
    grid: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    text: isDark ? '#71717a' : '#71717a', // zinc-500
    tooltipBg: isDark ? '#18181b' : '#ffffff', // zinc-900 or white
    tooltipBorder: isDark ? '#27272a' : '#e4e4e7', // zinc-800 or zinc-200
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations");
    }
  };

  const fetchRevenue = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();

      const locId = typeof selectedLocation === 'object' ? selectedLocation?._id : selectedLocation;
      if (locId && locId !== 'all') {
        query.append('locationId', locId);
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

      // Filter only revenue types (we can also do this in backend, but keep it safe here)
      const revenueOnly = (res.data.data || []).filter(t => t.type !== 'expense');
      setTransactions(revenueOnly);

      // Set pagination
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages);
      }

      if (res.data.totalRevenue !== undefined) {
        setTotalRevenue(res.data.totalRevenue);
      }

    } catch (err) {
      console.error('Failed to load revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      fetchLocations();
    }
  }, [selectedLocation, timeRange, customDates, currentPage, searchQuery, amountRange]);

  // With server-side filtering, transactions is already paginated
  const paginatedData = transactions || [];

  // Calculate avg order for current view
  const avgOrder = paginatedData.length > 0 ? (paginatedData.reduce((acc, curr) => acc + curr.totalAmount, 0) / paginatedData.length) : 0;

  const chartData = [...paginatedData].reverse().map(t => ({
    date: new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    amount: t.totalAmount
  }));

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-[var(--color-text-primary)]">
              <TrendingUp className="text-emerald-500" size={36} strokeWidth={2.5} />
              Revenue <span className="text-emerald-500">Dashboard</span>
            </h1>
            <p className="text-[var(--color-text-muted)] font-medium mt-1">Track your earnings and sales data.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-[var(--color-bg-soft)] p-1.5 rounded-2xl border border-[var(--color-border)] shadow-sm">
            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <PremiumSelect
                icon={MapPin}
                label="Branch"
                value={typeof selectedLocation === 'object' ? selectedLocation?._id : (selectedLocation || 'all')}
                onChange={(val) => {
                  const loc = val === 'all' ? 'all' : locations.find(l => l._id === val);
                  switchLocation(loc);
                }}
                options={[
                  { label: 'All Branches', value: 'all' },
                  ...locations.map(loc => ({ label: loc.name, value: loc._id }))
                ]}
                className="min-w-[180px] !py-2"
              />
            )}
            {['7d', '1m', '3m', 'all', 'custom'].map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${timeRange === t ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {timeRange === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 p-6 glass-card border border-[var(--color-border)] rounded-3xl premium-shadow"
          >
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 ml-1">Start Date</label>
              <input type="date" className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 ml-1">End Date</label>
              <input type="date" className="w-full bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
            </div>
          </motion.div>
        )}

        {/* Graph Section */}
        <SlideIn delay={0.1}>
          <div className="glass-card p-8 rounded-[2.5rem] premium-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Activity size={120} className="text-emerald-500" />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h2 className="text-xl font-black text-[var(--color-text-primary)] tracking-tight">Revenue Trends</h2>
              <div className="flex gap-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Total Revenue</p>
                  <p className="text-2xl font-black text-emerald-500 tracking-tighter">₹{totalRevenue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Average Order</p>
                  <p className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter">₹{avgOrder.toFixed(0)}</p>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'black', fill: chartColors.text }} dy={10} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      borderColor: chartColors.tooltipBorder,
                      borderRadius: '16px',
                      border: '1px solid',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }}
                    itemStyle={{ color: '#10b981', fontWeight: '900', fontSize: '14px' }}
                    labelStyle={{ color: chartColors.text, fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideIn>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={20} />
            <input
              type="text"
              placeholder="Search by invoice or customer..."
              className="w-full pl-12 pr-4 py-4 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-bold text-sm text-[var(--color-text-primary)] shadow-sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset page on search
              }}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              className={`!py-4 px-6 rounded-2xl border-none transition-all shadow-sm ${showFilters ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
            >
              <Filter size={18} className="mr-2" /> Filters
            </Button>
            <ExportActions
              data={paginatedData}
              columns={[
                { header: 'Title', key: 'title' },
                { header: 'Date', key: item => new Date(item.date).toLocaleDateString() },
                { header: 'Amount', key: 'totalAmount' }
              ]}
              filename="revenue_report"
            />
          </div>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-card p-6 rounded-[2rem] border border-[var(--color-border)] flex flex-wrap gap-6 items-end"
          >
            <div>
              <label className="block text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 ml-1">Min Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                className="w-32 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500"
                value={amountRange.min}
                onChange={e => { setAmountRange(prev => ({ ...prev, min: e.target.value })); setCurrentPage(1); }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2 ml-1">Max Amount (₹)</label>
              <input
                type="number"
                placeholder="50000"
                className="w-32 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-emerald-500"
                value={amountRange.max}
                onChange={e => { setAmountRange(prev => ({ ...prev, max: e.target.value })); setCurrentPage(1); }}
              />
            </div>
            <Button
              onClick={() => { setAmountRange({ min: '', max: '' }); setSearchQuery(''); setCurrentPage(1); }}
              className="bg-[var(--color-bg-soft)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] px-4 py-3 rounded-xl text-xs"
            >
              Clear Filters
            </Button>
          </motion.div>
        )}


        {/* Data List */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Recent Transactions</h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[var(--color-bg-soft)] animate-pulse rounded-2xl" />)}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="py-20 text-center bg-[var(--color-bg-soft)]/40 rounded-[2.5rem] border border-dashed border-[var(--color-border)]">
              <p className="text-[var(--color-text-muted)] font-bold">No transactions found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {paginatedData.map((t, idx) => (
                <SlideIn key={t._id} delay={idx * 0.02}>
                  <CardHover>
                    <div
                      onClick={() => setSelectedTransaction(t)}
                      className="glass-card p-5 rounded-2xl premium-shadow flex items-center justify-between group hover:border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm">
                          <ArrowUpRight size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-[var(--color-text-primary)] tracking-tight leading-none text-base">
                              {t.title || `Order #${t._id.substring(t._id.length - 6).toUpperCase()}`}
                            </h4>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]">
                              {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-md">
                              {t.type === 'pos_revenue' ? 'POS Billing' : 'Manual Entry'}
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1">
                              <MapPin size={8} /> {t.locationId?.name || 'Main Branch'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xl font-black text-emerald-500 tracking-tighter">+₹{t.totalAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mt-1">Confirmed</p>
                        </div>
                        <ChevronRight size={18} className="text-[var(--color-text-muted)] group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </CardHover>
                </SlideIn>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-30 transition-all hover:border-emerald-500/30"
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-black text-zinc-900 dark:text-white">{currentPage}</span>
              <span className="text-[10px] font-bold text-zinc-500">/ {totalPages}</span>
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-30 transition-all hover:border-emerald-500/30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        {/* Transaction Detail Modal */}
        <Modal
          isOpen={!!selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          title="Transaction Details"
          maxWidth="max-w-2xl"
        >
          {selectedTransaction && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm">
                    <Receipt size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                      {selectedTransaction.title || `Order #${selectedTransaction._id.substring(selectedTransaction._id.length - 6).toUpperCase()}`}
                    </h3>
                    <p className="text-zinc-500 font-bold text-xs flex items-center gap-2 mt-1">
                      <Hash size={12} /> ID: {selectedTransaction._id}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Date & Time</div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Calendar size={14} className="text-emerald-500" />
                      {new Date(selectedTransaction.date).toLocaleDateString()}
                    </span>
                    <span className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                      <Clock size={14} />
                      {new Date(selectedTransaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Location Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Payment Source</p>
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-emerald-500" />
                    <span className="font-black text-zinc-900 dark:text-zinc-100 text-xs">
                      {selectedTransaction.type === 'pos_revenue' ? 'POS Billing' : 'Manual Entry'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Branch</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-500" />
                    <span className="font-black text-zinc-900 dark:text-zinc-100 text-xs">
                      {selectedTransaction.locationId?.name || 'Main Branch'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 col-span-2 md:col-span-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="font-black text-zinc-900 dark:text-zinc-100 text-xs uppercase tracking-wider">Payment Received</span>
                  </div>
                </div>
              </div>

              {/* Stakeholder Info */}
              {(selectedTransaction.customerName || selectedTransaction.staffId) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTransaction.customerName && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                        <User size={10} /> Customer Name
                      </p>
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{selectedTransaction.customerName}</p>
                      {selectedTransaction.tableNumber && (
                        <p className="text-xs font-bold text-zinc-500 mt-1">Table Assignment: {selectedTransaction.tableNumber}</p>
                      )}
                    </div>
                  )}
                  {selectedTransaction.staffId && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                        <User size={10} /> Staff Member
                      </p>
                      <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">{selectedTransaction.staffId.name || 'Staff'}</p>
                      <p className="text-xs font-bold text-zinc-500 mt-1">Service Execution</p>
                    </div>
                  )}
                </div>
              )}

              {/* Order Details */}
              {selectedTransaction.orders && selectedTransaction.orders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Order Details</p>
                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">Item</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center">Qty</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Price</th>
                          <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {selectedTransaction.orders.map((item, i) => (
                          <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-xs font-black text-zinc-900 dark:text-zinc-100">{item.itemName}</td>
                            <td className="px-4 py-3 text-xs font-bold text-zinc-500 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-xs font-bold text-zinc-500 text-right">₹{item.price}</td>
                            <td className="px-4 py-3 text-xs font-black text-zinc-900 dark:text-zinc-100 text-right">₹{item.price * item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedTransaction.description && (
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                    <Info size={10} /> Context / Notes
                  </p>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 italic">
                    "{selectedTransaction.description}"
                  </p>
                </div>
              )}

              {/* Financial Summary */}
              <div className="pt-4 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Profit</p>
                        <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">₹{selectedTransaction.totalProfit?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Amount</p>
                      <p className="text-3xl font-black text-emerald-500 tracking-tighter">₹{selectedTransaction.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-4">
                <Button
                  onClick={() => setSelectedTransaction(null)}
                  className="w-full !py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase tracking-widest text-[10px]"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}
