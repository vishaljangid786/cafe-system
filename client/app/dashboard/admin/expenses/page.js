'use client';

import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  TrendingDown, Search, Filter, 
  ChevronRight, Calendar, MapPin, 
  ArrowDownRight, Activity, Receipt,
  Plus, User, Info, ChevronDown, 
  AlertCircle, Sparkles, Download,
  Layers, Wallet, ArrowUpRight
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
  const [timeRange, setTimeRange] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'mine', 'pending'
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [locations, setLocations] = useState([]);
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
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.append('type', 'expense');

      if (activeTab === 'mine') {
        query.append('myExpenses', 'true');
      } else if (activeTab === 'pending') {
        query.append('status', 'pending');
      } else if (selectedLocation) {
        query.append('locationId', selectedLocation._id || selectedLocation);
      }
      
      const now = new Date();
      let start = '';
      if (timeRange !== 'all') {
        const d = new Date();
        if (timeRange === '7d') d.setDate(now.getDate() - 7);
        else if (timeRange === '1m') d.setMonth(now.getMonth() - 1);
        else if (timeRange === '3m') d.setMonth(now.getMonth() - 3);
        start = d.toISOString().split('T')[0];
      }
      if (start) query.append('startDate', start);

      const res = await api.get(`/transactions?${query.toString()}`);
      setTransactions(res.data.data);
    } catch (err) {
      console.error('Expenses sync failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      fetchLocations();
    }
  }, [selectedLocation, timeRange, activeTab]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Archiving expense...');
    try {
      const finalTitle = formData.title === "Other (Custom Title)" ? formData.customTitle : formData.title;
      if (!finalTitle) throw new Error("Title is required");

      const finalLocationId = formData.locationId || (selectedLocation?._id || selectedLocation);
      if (!finalLocationId) throw new Error("Location selection is required for cross-branch archival");

      const data = { 
        ...formData, 
        title: finalTitle,
        locationId: finalLocationId,
        type: 'expense' 
      };
      
      await api.post('/transactions', data);
      toast.success('Expense archived', { id: loadToast });
      setShowAddModal(false);
      setFormData({ title: '', customTitle: '', amount: '', category: 'Operational', date: new Date().toISOString().split('T')[0], description: '', locationId: '' });
      fetchExpenses();
    } catch (error) {
      toast.error(error.message || 'Protocol failure', { id: loadToast });
    }
  };

  const handleApprove = async (id) => {
    const loadToast = toast.loading('Authorizing expenditure...');
    try {
      await api.patch(`/transactions/${id}/approve`);
      toast.success('Expense authorized', { id: loadToast });
      setSelectedExpense(null);
      fetchExpenses();
    } catch (error) {
      toast.error('Authorization failed', { id: loadToast });
    }
  };

  const handleReject = async (id) => {
    const loadToast = toast.loading('Revoking expenditure...');
    try {
      await api.patch(`/transactions/${id}/reject`);
      toast.error('Expense revoked', { id: loadToast });
      setSelectedExpense(null);
      fetchExpenses();
    } catch (error) {
      toast.error('Revocation failed', { id: loadToast });
    }
  };

  const filteredData = transactions.filter(t => {
    if (!globalSearch) return true;
    const searchLower = globalSearch.toLowerCase();
    return t.title?.toLowerCase().includes(searchLower) || 
           t.description?.toLowerCase().includes(searchLower);
  });

  const totalExpenditure = filteredData.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const avgExpense = filteredData.length > 0 ? (totalExpenditure / filteredData.length) : 0;

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            <Layers size={200} className="text-rose-500" strokeWidth={1} />
          </div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/10">
                  <TrendingDown size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 dark:text-white leading-none">
                    Expense <span className="text-rose-500">Core</span>
                  </h1>
                  <p className="text-zinc-500 font-bold mt-2 flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500" />
                    Intelligent resource outflow tracking and archival.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 shadow-inner">
                {['7d', '1m', '3m', 'all'].map(t => (
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Gross Expenditure</p>
              <p className="text-3xl font-black text-rose-500 tracking-tighter">₹{totalExpenditure.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Average Unit Cost</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">₹{avgExpense.toFixed(0)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Active Records</p>
              <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{filteredData.length}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Tabs */}
        <div className="flex items-center gap-10 border-b border-zinc-200 dark:border-zinc-800 px-10">
          <button 
            onClick={() => setActiveTab('all')}
            className={`pb-5 text-xs font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'all' ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
          >
            Global Archives
            {activeTab === 'all' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-rose-500 rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button 
            onClick={() => setActiveTab('mine')}
            className={`pb-5 text-xs font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'mine' ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
          >
            Personal Vault
            {activeTab === 'mine' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-rose-500 rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`pb-5 text-xs font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'pending' ? 'text-rose-500' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
          >
            Pending Review
            {activeTab === 'pending' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1.5 bg-rose-500 rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          {/* Main List Section */}
          <div className="xl:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-rose-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Scan records by title, role or description..."
                  className="w-full pl-14 pr-6 py-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl focus:ring-4 focus:ring-rose-500/10 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm group-hover:border-rose-500/30"
                  onChange={(e) => {/* global search logic from context */}}
                />
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <Button variant="secondary" className="!py-5 px-8 rounded-3xl border-none bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm font-black uppercase text-[10px] tracking-widest">
                  <Filter size={18} className="mr-2" /> Refine
                </Button>
                <ExportActions 
                  data={filteredData} 
                  columns={[
                    { header: 'Title', key: 'title' },
                    { header: 'Category', key: 'category' },
                    { header: 'Date', key: item => new Date(item.date).toLocaleDateString() },
                    { header: 'Amount', key: 'totalAmount' },
                    { header: 'Created By', key: item => item.createdBy?.name }
                  ]} 
                  filename="expense_vault_export" 
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
                  <p className="text-zinc-500 font-bold text-lg tracking-tight">No expenditure nodes detected in this sector.</p>
                  <p className="text-zinc-400 text-xs mt-2 font-medium">Try adjusting your filters or time range.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginatedData.map((t, idx) => (
                    <SlideIn key={t._id} delay={idx * 0.03}>
                      <CardHover>
                        <div 
                          onClick={() => setSelectedExpense(t)}
                          className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between group hover:border-rose-500/40 transition-all cursor-pointer relative overflow-hidden h-full shadow-sm"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                              <ArrowDownRight size={24} strokeWidth={2.5} />
                            </div>
                            <div className="space-y-1.5">
                              <h4 className="font-black text-zinc-900 dark:text-white tracking-tight text-base line-clamp-1">
                                {t.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                                  {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-2.5 py-1 rounded-lg border border-rose-500/10">
                                  {t.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right relative z-10 shrink-0">
                            <p className="text-xl font-black text-rose-500 tracking-tighter leading-none group-hover:scale-105 transition-transform">-₹{t.totalAmount.toLocaleString()}</p>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 mt-2">Verified</p>
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
                  className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:border-rose-500/50 hover:text-rose-500 transition-all shadow-sm"
                >
                  <ChevronRight size={20} className="rotate-180" />
                </button>
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-6 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm font-black tracking-widest text-[10px]">
                  <span className="text-zinc-900 dark:text-white">{currentPage}</span>
                  <span className="text-zinc-400">/ {totalPages}</span>
                </div>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:border-rose-500/50 hover:text-rose-500 transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Analytics Sidebar */}
          <div className="space-y-8">
            <SlideIn direction="right" delay={0.2}>
              <div className="bg-gradient-to-br from-rose-500 to-rose-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-rose-500/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700">
                  <Wallet size={100} strokeWidth={1} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-80 mb-6">Velocity Matrix</h3>
                <div className="space-y-6 relative z-10">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorWhite" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fff" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="amount" stroke="#fff" strokeWidth={3} fill="url(#colorWhite)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/20 pt-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Settled Today</p>
                      <p className="text-2xl font-black tracking-tighter mt-1">₹{totalExpenditure.toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
                      <ArrowUpRight size={20} />
                    </div>
                  </div>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="right" delay={0.3}>
              <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white flex items-center gap-2">
                  <Layers size={14} className="text-rose-500" /> Segment Allocation
                </h3>
                <div className="space-y-4">
                  {['Operational', 'Inventory', 'Utilities', 'Marketing'].map(cat => {
                    const amount = filteredData.filter(t => t.category === cat).reduce((acc, curr) => acc + curr.totalAmount, 0);
                    const percentage = totalExpenditure > 0 ? (amount / totalExpenditure) * 100 : 0;
                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                          <span className="text-zinc-500">{cat}</span>
                          <span className="text-zinc-900 dark:text-white">{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.3)]"
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
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg animate-pulse">Pending Review</span>
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
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-2">Certified Value</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <User size={60} strokeWidth={1} />
                  </div>
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
                      <p className="text-base font-black text-zinc-900 dark:text-white leading-none">{selectedExpense.createdBy?.name || 'Automated Node'}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mt-1 bg-rose-500/5 px-2 py-0.5 rounded-lg w-fit">{selectedExpense.createdBy?.role?.replace('_', ' ') || 'Protocol'}</p>
                    </div>
                  </div>
                  {selectedExpense.approvedBy && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                        <Sparkles size={10} className="text-amber-500" /> Authorized By {selectedExpense.approvedBy.name}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <MapPin size={60} strokeWidth={1} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2">
                    <MapPin size={12} className="text-rose-500" /> Station Hub
                  </p>
                  <div className="space-y-1">
                    <p className="text-base font-black text-zinc-900 dark:text-white leading-none">{selectedExpense.locationId?.name || 'Central Command'}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-1">{selectedExpense.locationId?.city || 'Regional Sector'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2 ml-2">
                  <Info size={12} className="text-rose-500" /> Descriptive Intelligence
                </p>
                <div className="p-8 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 relative">
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic relative z-10">
                    "{selectedExpense.description || "No descriptive intelligence was archived for this particular resource outflow."}"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </div>
                </div>
              )}

              {selectedExpense.status === 'pending' ? (
                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="primary" 
                    className="flex-1 !rounded-2xl !py-6 font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-rose-500/20 bg-rose-600 hover:bg-rose-700" 
                    icon={Sparkles}
                    onClick={() => handleApprove(selectedExpense._id)}
                  >
                    Authorize Outflow
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1 !rounded-2xl !py-6 font-black uppercase tracking-[0.2em] text-xs border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" 
                    onClick={() => handleReject(selectedExpense._id)}
                  >
                    Revoke Request
                  </Button>
                </div>
              ) : (
                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="primary" 
                    className="flex-1 !rounded-2xl !py-6 font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-rose-500/20" 
                    icon={Download}
                  >
                    Download Evidence
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1 !rounded-2xl !py-6 font-black uppercase tracking-[0.2em] text-xs border-none bg-zinc-100 dark:bg-zinc-800" 
                    onClick={() => setSelectedExpense(null)}
                  >
                    Exit
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="New Resource Outflow" maxWidth="max-w-xl">
          <form onSubmit={handleAddExpense} className="space-y-8 p-2">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Archival Title</label>
                <div className="relative">
                  <select 
                    required 
                    className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-bold dark:text-white appearance-none focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" 
                    value={formData.title} 
                    onChange={e => {
                      setFormData({...formData, title: e.target.value});
                      setShowCustomTitle(e.target.value === "Other (Custom Title)");
                    }}
                  >
                    <option value="" disabled>Select Outflow Title</option>
                    {EXPENSE_TITLES.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={20} />
                </div>
              </div>

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
                      onChange={e => setFormData({...formData, customTitle: e.target.value})}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Economic Volume (₹)</label>
                  <input required type="number" className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-black dark:text-white focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Category Vector</label>
                  <select className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-bold dark:text-white appearance-none focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="Operational">Operational</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Welfare">Staff Welfare</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Target Station Hub</label>
                <div className="relative">
                  <select 
                    required 
                    className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-bold dark:text-white appearance-none focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" 
                    value={formData.locationId || (selectedLocation?._id || selectedLocation || '')} 
                    onChange={e => setFormData({...formData, locationId: e.target.value})}
                  >
                    <option value="" disabled>Select Location</option>
                    {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.name} ({loc.city})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={20} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Temporal Stamp</label>
                <input required type="date" className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-bold dark:text-white focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 ml-2">Intelligence Notes</label>
                <textarea className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-5 text-sm font-medium dark:text-white focus:ring-4 focus:ring-rose-500/10 transition-all outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} placeholder="Provide specific context for this outflow..." />
              </div>
            </div>

            <Button type="submit" variant="primary" className="w-full !rounded-[2rem] !py-6 shadow-2xl shadow-rose-600/30 font-black uppercase tracking-[0.4em] text-sm" icon={Sparkles}>Finalize Outflow</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
