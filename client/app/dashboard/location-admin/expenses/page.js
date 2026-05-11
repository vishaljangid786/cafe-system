'use client';

import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  TrendingDown, IndianRupee, Search, Filter, 
  ChevronRight, Calendar, MapPin, Target, 
  ArrowDownRight, Activity, Wallet, Receipt,
  Plus, RefreshCw
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

export default function LocationExpensesPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 20;

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Daily',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      
      const now = new Date();
      let start = '';
      if (timeRange !== 'all') {
        const d = new Date();
        if (timeRange === '7d') d.setDate(now.getDate() - 7);
        else if (timeRange === '1m') d.setMonth(now.getMonth() - 1);
        start = d.toISOString().split('T')[0];
      }
      if (start) query.append('startDate', start);

      query.append('type', 'EXPENSE');
      const res = await api.get(`/transactions?${query.toString()}`);
      const expensesOnly = res.data.data.filter(t => t.type === 'EXPENSE');
      setTransactions(expensesOnly);
    } catch (err) {
      console.error('Expenses load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
    }, 0);

    return () => clearTimeout(timer);
  }, [timeRange]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Saving expense...');
    try {
      const data = { ...formData, type: 'EXPENSE' };
      await api.post('/transactions', data);
      toast.success('Expense saved', { id: loadToast });
      setShowAddModal(false);
      setFormData({ title: '', amount: '', category: 'Daily', date: new Date().toISOString().split('T')[0], description: '' });
      fetchExpenses();
    } catch (error) {
      toast.error('Error', { id: loadToast });
    }
  };

  const filteredData = transactions.filter(t => 
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenditure = filteredData.reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const chartData = [...filteredData].reverse().slice(-30).map(t => ({
    date: new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    amount: t.totalAmount
  }));

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-zinc-100 dark:border-zinc-800 gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
              <TrendingDown className="mr-4 text-rose-500" size={36} /> Branch <span className="ml-3 text-rose-500">Expenses</span>
            </h1>
            <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Tracking branch expenses and daily costs.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
              {['7d', '1m', 'all'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${timeRange === t ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button 
              variant="primary" 
              icon={Plus}
              onClick={() => setShowAddModal(true)}
              className="!rounded-2xl !py-4 px-6 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20"
            >
              Add Expense
            </Button>
          </div>
        </div>

        {/* Graph Section */}
        <SlideIn delay={0.1}>
          <div className="bg-white/40 dark:bg-zinc-950/20 backdrop-blur-md p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Activity size={120} className="text-rose-500" />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Expense Trend</h2>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Spend</p>
                <p className="text-2xl font-black text-rose-500 tracking-tighter">₹{totalExpenditure.toLocaleString()}</p>
              </div>
            </div>
            <div className="h-[250px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorExpL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'black', fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid #27272a' }} />
                  <Area type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpL)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SlideIn>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
            <input 
              type="text" 
              placeholder="Search branch expenses..."
              className="w-full pl-12 pr-4 py-4 bg-white/40 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-rose-500/20 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button variant="secondary" className="!py-4 px-6 rounded-2xl border-none bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
              <Filter size={18} className="mr-2" /> Filters
            </Button>
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
              className="!rounded-2xl !py-4 px-4 bg-zinc-100 dark:bg-zinc-800 border-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
            />
          </div>
        </div>

        {/* Data List */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Recent Expenses</h3>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-900 animate-pulse rounded-2xl" />)}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="py-20 text-center bg-white/40 dark:bg-zinc-950/40 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 font-bold">No expense records detected.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {paginatedData.map((t, idx) => (
                <SlideIn key={t._id} delay={idx * 0.02}>
                  <CardHover>
                    <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between group hover:border-rose-500/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 shadow-sm">
                          <ArrowDownRight size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none text-base">
                              {t.title || `Expense #${t._id.substring(t._id.length - 6).toUpperCase()}`}
                            </h4>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                              {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded-md mt-2 w-fit">
                            {t.category || 'Daily'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div>
                          <p className="text-xl font-black text-rose-500 tracking-tighter">-₹{t.totalAmount.toLocaleString()}</p>
                          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mt-1">Settled</p>
                        </div>
                        <ChevronRight size={18} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
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
              className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-30 transition-all hover:border-rose-500/30"
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
              className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-30 transition-all hover:border-rose-500/30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Record Branch Expense" maxWidth="max-w-xl">
          <form onSubmit={handleAddExpense} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Expense Title</label>
                <input required className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 text-sm font-bold dark:text-white" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Groceries" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Amount (₹)</label>
                <input required type="number" className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 text-sm font-black dark:text-white" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PremiumSelect 
                  label="Category"
                  value={formData.category}
                  onChange={val => setFormData({...formData, category: val})}
                  options={[
                    { label: 'Supplies', value: 'Supplies' },
                    { label: 'Utilities', value: 'Utilities' },
                    { label: 'Rent', value: 'Rent' },
                    { label: 'Maintenance', value: 'Maintenance' },
                    { label: 'Marketing', value: 'Marketing' },
                    { label: 'Other', value: 'Other' }
                  ]}
                />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Date</label>
                <input required type="date" className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 text-sm font-bold dark:text-white" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Description</label>
              <textarea className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 p-4 text-sm font-medium dark:text-white" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} placeholder="Add details..." />
            </div>
            <Button type="submit" variant="primary" className="w-full !rounded-xl !py-4 shadow-xl shadow-rose-600/10" icon={Receipt}>Add Expense</Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
