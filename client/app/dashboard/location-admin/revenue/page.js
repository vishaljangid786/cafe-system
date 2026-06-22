'use client';

import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { 
  TrendingUp, IndianRupee, Search, Filter, 
  ChevronRight, Calendar, MapPin, Target, 
  ArrowUpRight, Activity, Wallet, Receipt
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../components/ui/Button';
import ExportActions from '../../../components/ui/ExportActions';
import { Skeleton } from '@/app/components/ui/Skeleton';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';

export default function LocationRevenuePage() {
  const { user, selectedLocation } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 20;

  const fetchRevenue = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const query = new URLSearchParams();
      // Location Admin only sees their location data
      
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
      const revenueOnly = res.data.data.filter(t => t.type !== 'expense');
      setTransactions(revenueOnly);
    } catch (err) {
      console.error('Revenue sync failed');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRevenue();
    }, 0);

    return () => clearTimeout(timer);
  }, [timeRange]);

  const filteredData = transactions.filter(t => 
    t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = filteredData.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalOrders = filteredData.length;

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
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-(--color-surface) dark:bg-(--color-surface) p-8 rounded-xl shadow-sm border border-(--color-border) dark:border-(--color-border) gap-6">
          <div>
            <h1 className="text-3xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) flex items-center tracking-tight leading-none">
              <TrendingUp className="mr-4 text-success" size={36} /> Branch <span className="ml-3 text-success">Revenue</span>
            </h1>
            <p className="text-(--color-text-muted) dark:text-(--color-text-muted) text-sm mt-2 font-medium">Track your branch income and daily sales.</p>
          </div>
          <div className="flex items-center gap-3 bg-(--color-surface-soft) dark:bg-(--color-bg) p-1.5 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-inner">
            {['7d', '1m', 'all'].map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-5 py-2 text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all ${timeRange === t ? 'bg-success text-white shadow-lg ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Graph Section */}
        <SlideIn delay={0.1}>
          <div className="bg-white/40 dark:bg-(--color-bg)/20  p-8 rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Activity size={120} className="text-success" />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
              <h2 className="text-xl font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">Sales Trend</h2>
              <div className="flex gap-10">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total Revenue</p>
                  <p className="text-2xl font-bold text-success tracking-tight">₹{totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="h-[250px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'black', fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid #27272a' }} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevL)" />
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
              placeholder="Search revenue..."
              className="w-full pl-12 pr-4 py-4 bg-white/40 dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) rounded-xl focus:ring-2 focus:ring-success/20 outline-none transition-all font-bold text-sm text-(--color-text-primary) dark:text-(--color-text-primary) shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button variant="secondary" className="!py-4 px-6 rounded-xl border-none bg-success/10 text-success hover:bg-success hover:text-white transition-all shadow-sm">
              <Filter size={18} className="mr-2" /> Filters
            </Button>
            <ExportActions 
              data={filteredData} 
              columns={[
                { header: 'Title', key: 'title' },
                { header: 'Date', key: item => new Date(item.date).toLocaleDateString() },
                { header: 'Amount', key: 'totalAmount' }
              ]} 
              filename="branch_revenue" 
            />
          </div>
        </div>

        {/* Data List */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Recent Income</h3>
          {refetching ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="py-20 text-center bg-white/40 dark:bg-(--color-bg)/40 rounded-xl border border-dashed border-(--color-border) dark:border-(--color-border)">
              <p className="text-(--color-text-muted) font-bold">No revenue found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {paginatedData.map((t, idx) => (
                <SlideIn key={t._id} delay={idx * 0.02}>
                  <CardHover>
                    <div className="bg-white/60 dark:bg-(--color-surface)/40  p-5 rounded-xl border border-(--color-border) dark:border-(--color-border) flex items-center justify-between group hover:border-success/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-5">
                        <div className="h-12 w-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success shadow-sm">
                          <ArrowUpRight size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight leading-none text-base">
                              {t.title || `Order #${t._id.substring(t._id.length - 6).toUpperCase()}`}
                            </h4>
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted)">
                              {new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <p className="text-[8px] font-bold uppercase tracking-normal text-success mt-2 bg-success/5 w-fit px-2 py-0.5 rounded">
                            {t.type === 'POS_REVENUE' ? 'POS Sale' : 'Manual Entry'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div>
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
              className="h-10 w-10 rounded-xl bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) flex items-center justify-center text-(--color-text-muted) disabled:opacity-30 transition-all hover:border-success/30"
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div className="flex items-center gap-1 bg-(--color-surface) dark:bg-(--color-surface) px-3 py-1.5 rounded-xl border border-(--color-border) dark:border-(--color-border)">
              <span className="text-xs font-bold text-(--color-text-primary) dark:text-white">{currentPage}</span>
              <span className="text-[10px] font-bold text-(--color-text-muted)">/ {totalPages}</span>
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="h-10 w-10 rounded-xl bg-(--color-surface) dark:bg-(--color-surface) border border-(--color-border) dark:border-(--color-border) flex items-center justify-center text-(--color-text-muted) disabled:opacity-30 transition-all hover:border-success/30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
