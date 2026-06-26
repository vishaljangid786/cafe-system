'use client';

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
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
import UniversalDateFilter from '../../../components/ui/UniversalDateFilter';

export default function RevenuePage() {
  const { theme } = useTheme();
  const { user, selectedLocation, globalSearch } = useAuth();
  
  const hasAccess = user?.role === 'super_admin' || user?.permissions?.viewRevenue === true;

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);

  const [timeRange, setTimeRange] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // NEW STATES FOR SERVER-SIDE PAGINATION & SEARCH
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [gst, setGst] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);

  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [locations, setLocations] = useState([]);
  const itemsPerPage = 20;

  const isDark = theme === 'dark';

  const chartColors = {
    grid: 'var(--color-border)',
    text: 'var(--color-text-muted)',
    tooltipBg: 'var(--color-surface)',
    tooltipBorder: 'var(--color-border)',
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
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const query = new URLSearchParams();

      const locId = typeof selectedLocation === 'object' ? selectedLocation?._id : selectedLocation;
      if (locId && locId !== 'all') {
        query.append('locationId', locId);
      }

      let start = startDate;
      let end = endDate;

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
      const revenueOnly = (res.data.data || []).filter(t => t.type !== 'EXPENSE');
      setTransactions(revenueOnly);

      // Set pagination
      if (res.data.pagination) {
        setTotalPages(res.data.pagination.totalPages);
      }

      if (res.data.totalRevenue !== undefined) {
        setTotalRevenue(res.data.totalRevenue);
      }

      // GST collected for the same scope/period (optional — never blocks revenue).
      try {
        const gstQ = new URLSearchParams();
        if (locId && locId !== 'all') gstQ.append('branchId', locId);
        if (start) gstQ.append('startDate', start);
        if (end) gstQ.append('endDate', end);
        const gstRes = await api.get(`/orders/gst-report?${gstQ.toString()}`);
        setGst(gstRes.data.data);
      } catch (e) { /* gst widget optional */ }

    } catch (err) {
      console.error('Failed to load revenue data:', err);
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    if (!user || !hasAccess) return;

    const timer = setTimeout(() => {
      fetchRevenue();
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        fetchLocations();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedLocation, startDate, endDate, currentPage, searchQuery, amountRange]);

  if (!hasAccess && user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <TrendingUp size={60} className="text-danger opacity-20" />
        <h2 className="text-2xl font-bold text-(--color-text-primary) italic uppercase">Access Restricted</h2>
        <p className="text-(--color-text-muted) font-bold text-sm tracking-normal uppercase">You do not have permission to view revenue.</p>
      </div>
    );
  }

  if (loading) return <LoadingScreen fullScreen={false} />;

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
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-4 text-(--color-text-primary)">
              <TrendingUp className="text-success" size={36} strokeWidth={2.5} />
              Revenue <span className="text-success">Dashboard</span>
            </h1>
            <p className="text-(--color-text-muted) font-medium mt-1">Track your earnings and sales data.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <UniversalDateFilter
              onFilterChange={({ startDate, endDate }) => {
                setStartDate(startDate);
                setEndDate(endDate);
              }}
              loading={refetching}
            />
          </div>
        </div>

        {/* Graph Section */}
        <SlideIn delay={0.1}>
          <div className="glass-card p-8 rounded-xl premium-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Activity size={120} className="text-success" />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h2 className="text-xl font-bold text-(--color-text-primary) tracking-tight">Revenue Trends</h2>
              <div className="flex gap-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total Revenue</p>
                  <p className="text-2xl font-bold text-success tracking-tight">₹{totalRevenue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Average Order</p>
                  <p className="text-2xl font-bold text-(--color-text-primary) tracking-tight">₹{avgOrder.toFixed(0)}</p>
                </div>
                {gst && (
                  <div title={`5% GST on ${gst.orders} completed orders (taxable ₹${Number(gst.taxableRevenue || 0).toLocaleString()})`}>
                    <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">GST Collected</p>
                    <p className="text-2xl font-bold text-primary tracking-tight">₹{Number(gst.gstCollected || 0).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="h-75 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
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
                    itemStyle={{ color: 'var(--color-success)', fontWeight: '900', fontSize: '14px' }}
                    labelStyle={{ color: chartColors.text, fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="var(--color-success)" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideIn>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={20} />
            <input
              type="text"
              placeholder="Search by invoice or customer..."
              className="w-full pl-12 pr-4 py-4 bg-(--color-bg-soft) border border-(--color-border) rounded-xl focus:ring-2 focus:ring-success/20 outline-none transition-all font-bold text-sm text-(--color-text-primary) shadow-sm"
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
              className={`!py-4 px-6 rounded-xl border-none transition-all shadow-sm ${showFilters ? 'bg-success text-(--color-bg-base)' : 'bg-success/10 text-success hover:bg-success hover:text-(--color-bg-base)'}`}
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
            className="glass-card p-6 rounded-xl border border-(--color-border) flex flex-wrap gap-6 items-end"
          >
            <div>
              <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">Min Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                className="w-32 bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-success"
                value={amountRange.min}
                onChange={e => { setAmountRange(prev => ({ ...prev, min: e.target.value })); setCurrentPage(1); }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">Max Amount (₹)</label>
              <input
                type="number"
                placeholder="50000"
                className="w-32 bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-success"
                value={amountRange.max}
                onChange={e => { setAmountRange(prev => ({ ...prev, max: e.target.value })); setCurrentPage(1); }}
              />
            </div>
            <Button
              onClick={() => { setAmountRange({ min: '', max: '' }); setSearchQuery(''); setCurrentPage(1); }}
              className="bg-(--color-bg-soft) text-(--color-text-primary) hover:bg-(--color-border) px-4 py-3 rounded-xl text-xs"
            >
              Clear Filters
            </Button>
          </motion.div>
        )}


        {/* Data List */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Recent Transactions</h3>
          {refetching ? (
            <ListSkeleton rows={5} />
          ) : paginatedData.length === 0 ? (
            <div className="py-20 text-center bg-(--color-bg-soft)/40 rounded-xl border border-dashed border-(--color-border)">
              <p className="text-(--color-text-muted) font-bold">No transactions found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {paginatedData.map((t, idx) => (
                <SlideIn key={t._id} delay={idx * 0.02}>
                  <CardHover>
                    <div
                      onClick={() => setSelectedTransaction(t)}
                      className="glass-card p-5 rounded-xl premium-shadow flex items-center justify-between group hover:border-success/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success shadow-sm">
                          <ArrowUpRight size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-(--color-text-primary) tracking-tight leading-none text-base">
                              {t.title || `Order #${t._id.substring(t._id.length - 6).toUpperCase()}`}
                            </h4>
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-(--color-bg-soft) text-(--color-text-muted)">
                              {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-[8px] font-bold uppercase tracking-normal text-success bg-success/5 px-2 py-0.5 rounded-md">
                              {t.type === 'POS_REVENUE' ? 'POS Billing' : 'Manual Entry'}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-1">
                              <MapPin size={8} /> {t.locationId?.name || 'Main Branch'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xl font-bold text-success tracking-tight">+₹{t.totalAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">Confirmed</p>
                        </div>
                        <ChevronRight size={18} className="text-(--color-text-muted) group-hover:translate-x-1 transition-transform" />
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
              className="h-10 w-10 rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) disabled:opacity-30 transition-all hover:border-success/30"
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div className="flex items-center gap-1 bg-(--color-surface) px-3 py-1.5 rounded-xl border border-(--color-border)">
              <span className="text-xs font-bold text-(--color-text-primary)">{currentPage}</span>
              <span className="text-[10px] font-bold text-(--color-text-muted)">/ {totalPages}</span>
            </div>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="h-10 w-10 rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) disabled:opacity-30 transition-all hover:border-success/30"
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
                  <div className="h-14 w-14 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success shadow-sm">
                    <Receipt size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-(--color-text-primary) tracking-tight">
                      {selectedTransaction.title || `Order #${selectedTransaction._id.substring(selectedTransaction._id.length - 6).toUpperCase()}`}
                    </h3>
                    <p className="text-(--color-text-muted) font-bold text-xs flex items-center gap-2 mt-1">
                      <Hash size={12} /> ID: {selectedTransaction._id}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Date & Time</div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-(--color-text-primary) flex items-center gap-1.5">
                      <Calendar size={14} className="text-success" />
                      {new Date(selectedTransaction.date).toLocaleDateString()}
                    </span>
                    <span className="text-xs font-bold text-(--color-text-muted) flex items-center gap-1.5">
                      <Clock size={14} />
                      {new Date(selectedTransaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Location Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                  <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Payment Source</p>
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-success" />
                    <span className="font-bold text-(--color-text-primary) text-xs">
                      {selectedTransaction.type === 'POS_REVENUE' ? 'POS Billing' : 'Manual Entry'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                  <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Branch</p>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-success" />
                    <span className="font-bold text-(--color-text-primary) text-xs">
                      {selectedTransaction.locationId?.name || 'Main Branch'}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) col-span-2 md:col-span-1">
                  <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-success" />
                    <span className="font-bold text-(--color-text-primary) text-xs uppercase tracking-wider">Payment Received</span>
                  </div>
                </div>
              </div>

              {/* Stakeholder Info */}
              {(selectedTransaction.customerName || selectedTransaction.staffId) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTransaction.customerName && (
                    <div className="p-4 rounded-xl bg-(--color-surface) border border-(--color-border)">
                      <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-3 flex items-center gap-2">
                        <User size={10} /> Customer Name
                      </p>
                      <p className="text-sm font-bold text-(--color-text-primary)">{selectedTransaction.customerName}</p>
                      {selectedTransaction.tableNumber && (
                        <p className="text-xs font-bold text-(--color-text-muted) mt-1">Table: {selectedTransaction.tableNumber}</p>
                      )}
                    </div>
                  )}
                  {selectedTransaction.staffId && (
                    <div className="p-4 rounded-xl bg-(--color-surface) border border-(--color-border)">
                      <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-3 flex items-center gap-2">
                        <User size={10} /> Staff Member
                      </p>
                      <p className="text-sm font-bold text-(--color-text-primary)">{selectedTransaction.staffId.name || 'Staff'}</p>
                      <p className="text-xs font-bold text-(--color-text-muted) mt-1">Served the order</p>
                    </div>
                  )}
                </div>
              )}

              {/* Order Details */}
              {selectedTransaction.orders && selectedTransaction.orders.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Order Details</p>
                  <div className="rounded-xl border border-(--color-border) overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-(--color-surface-soft)/50">
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">Item</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted) text-center">Qty</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted) text-right">Price</th>
                          <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted) text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--color-border)">
                        {selectedTransaction.orders.map((item, i) => (
                          <tr key={i} className="hover:bg-(--color-surface-soft) transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-(--color-text-primary)">{item.itemName}</td>
                            <td className="px-4 py-3 text-xs font-bold text-(--color-text-muted) text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-xs font-bold text-(--color-text-muted) text-right">₹{item.price}</td>
                            <td className="px-4 py-3 text-xs font-bold text-(--color-text-primary) text-right">₹{item.price * item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedTransaction.description && (
                <div className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border)">
                  <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2 flex items-center gap-2">
                    <Info size={10} /> Notes
                  </p>
                  <p className="text-sm font-medium text-(--color-text-secondary) italic">
                    &ldquo;{selectedTransaction.description}&rdquo;
                  </p>
                </div>
              )}

              {/* Financial Summary */}
              <div className="pt-4 border-t border-dashed border-(--color-border)">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted)">Profit</p>
                        <p className="text-lg font-bold text-(--color-text-primary) tracking-tight">₹{selectedTransaction.totalProfit?.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-1">Total Amount</p>
                      <p className="text-3xl font-bold text-success tracking-tight">₹{selectedTransaction.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-4">
                <Button
                  onClick={() => setSelectedTransaction(null)}
                  className="w-full !py-4 rounded-xl bg-(--color-text-primary) text-(--color-bg-base) font-bold uppercase tracking-normal text-[10px]"
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
