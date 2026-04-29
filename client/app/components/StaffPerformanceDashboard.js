'use client';
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  TrendingUp, Timer, ShoppingBag, Award, XCircle, CheckCircle2, Zap, History,
  Filter, Calendar, Bookmark, Utensils, Building, CreditCard, Ticket
} from 'lucide-react';
import { PageTransition } from './ui/AnimatedContainer';
import toast from 'react-hot-toast';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colorMap = {
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    fuchsia: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20'
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-6 border border-zinc-200/50 dark:border-zinc-800/50 flex items-center gap-5 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${colorMap[color] || 'text-zinc-500 bg-zinc-500/10'}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-none">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-2">{label}</p>
        {sub && <p className="text-[9px] font-bold text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function StaffPerformanceDashboard({ user, role }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    foodItem: '',
    branch: '',
    paymentType: '',
    coupon: ''
  });

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [coupons, setCoupons] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFilterOptions = async () => {
    try {
      const [catRes, menuRes, locRes, coupRes] = await Promise.all([
        api.get('/categories').catch(() => ({ data: { data: [] } })),
        api.get('/menu').catch(() => ({ data: { data: [] } })),
        api.get('/locations').catch(() => ({ data: { data: [] } })),
        api.get('/coupons').catch(() => ({ data: { data: [] } }))
      ]);
      setCategories(catRes.data.data || []);
      setMenuItems(menuRes.data.data || []);
      setBranches(locRes.data.data || []);
      setCoupons(coupRes.data.data || []);
    } catch (error) {
      console.error('Failed to load filter options');
    }
  };

  const fetchPerformance = async (pageToFetch = 1) => {
    setLoading(true);
    try {
      const params = { page: pageToFetch, limit: 10 };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.category) params.category = filters.category;
      if (filters.foodItem) params.foodItem = filters.foodItem;
      if (filters.branch) params.branch = filters.branch;
      if (filters.paymentType) params.paymentType = filters.paymentType;
      if (filters.coupon) params.coupon = filters.coupon;

      const endpoint = role === 'chef' ? '/orders/my-stats-chef' : '/orders/my-stats-staff';
      const res = await api.get(endpoint, { params });
      
      setStats(res.data.data);
      setCurrentPage(res.data.data.pagination?.page || 1);
      setTotalPages(res.data.data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchPerformance(1);
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (!user) return null;

  return (
    <div className="max-w-[1600px] mx-auto pb-20 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <TrendingUp size={24} className="text-white" />
            </div>
            {role === 'chef' ? 'Chef' : 'Staff'} Performance Dashboard
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Analyze productivity and financial yields across metrics.</p>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <Filter size={16} className="text-amber-500" />
          <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Advanced Analytics Filters</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> From Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> To Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Bookmark size={12} /> Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            >
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Utensils size={12} /> Food Item
            </label>
            <select
              value={filters.foodItem}
              onChange={(e) => handleFilterChange('foodItem', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            >
              <option value="">All Items</option>
              {menuItems.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Building size={12} /> Branch
            </label>
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            >
              <option value="">All Branches</option>
              {branches.map(loc => <option key={loc._id} value={loc._id}>{loc.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <CreditCard size={12} /> Payment Type
            </label>
            <select
              value={filters.paymentType}
              onChange={(e) => handleFilterChange('paymentType', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            >
              <option value="">All Types</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Ticket size={12} /> Coupon Used
            </label>
            <select
              value={filters.coupon}
              onChange={(e) => handleFilterChange('coupon', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            >
              <option value="">All Coupons</option>
              {coupons.map(coup => <option key={coup._id} value={coup._id}>{coup.code}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                startDate: '', endDate: '', category: '', foodItem: '', branch: '', paymentType: '', coupon: ''
              })}
              className="w-full py-3 bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-3xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Total Orders" value={stats?.totalOrders || 0} sub="Overall processing volume" icon={ShoppingBag} color="amber" />
            <MetricCard label="Highest Order" value={`₹${stats?.highestValue || 0}`} sub="Peak ticket threshold" icon={Award} color="emerald" />
            <MetricCard label="Lowest Order" value={`₹${stats?.lowestValue || 0}`} sub="Minimum ticket threshold" icon={XCircle} color="rose" />
            <MetricCard label="Completed" value={stats?.completedOrders || 0} sub="Successfully served" icon={CheckCircle2} color="emerald" />
            <MetricCard label="Cancelled" value={stats?.cancelledOrders || 0} sub="Terminated lifecycle" icon={XCircle} color="rose" />
            <MetricCard label="Ignored/Unaccepted" value={stats?.unacceptedOrders || 0} sub="Pending verification" icon={Timer} color="amber" />
            <MetricCard label="Avg Ticket Size" value={`₹${stats?.avgTicketSize || 0}`} sub="Mean financial footprint" icon={TrendingUp} color="blue" />
            <MetricCard label="Total Sales" value={`₹${stats?.totalSales || 0}`} sub="Aggregate direct revenue" icon={Zap} color="violet" />
            <MetricCard label="Daily Payout" value={`₹${stats?.dailyPayout || 0}`} sub="Pro-rated base compensation" icon={CreditCard} color="fuchsia" />
            <MetricCard label="Top Category" value={stats?.bestSellingCategory || 'None'} sub="Highest item distribution" icon={Bookmark} color="amber" />
            <MetricCard label="Top Item" value={stats?.bestSellingItem || 'None'} sub="Maximum operational volume" icon={Utensils} color="blue" />
            <MetricCard label="Fulfillment Success" value={`${stats?.successRate || 0}%`} sub="Order completion rating" icon={Award} color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-amber-500" /> Weekly Distribution
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.ordersByWeek || []} margin={{ left: -20, right: 10 }}>
                    <defs>
                      <linearGradient id="colorWeek" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="week" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2.5} fill="url(#colorWeek)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-blue-500" /> Monthly Distribution
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.ordersByMonth || []} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
              <History size={16} className="text-amber-500" /> Recent Order Sequence
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Order ID</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Items</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Table</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentOrders?.map((order) => (
                    <tr key={order._id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all group">
                      <td className="py-4 text-xs font-black text-zinc-600 dark:text-zinc-400">#{order._id.slice(-6).toUpperCase()}</td>
                      <td className="py-4 text-xs font-bold text-zinc-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 text-xs font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 mt-2">{order.items?.map(it => it.menuItem?.name || 'Item').join(', ')}</td>
                      <td className="py-4 text-xs font-black text-amber-500">T{order.table?.tableNumber || 'N/A'}</td>
                      <td className="py-4">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                          order.status === 'SERVED' ? 'bg-emerald-500/10 text-emerald-500' :
                          order.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 text-xs font-black text-zinc-900 dark:text-white">₹{order.totalAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  disabled={currentPage === 1}
                  onClick={() => fetchPerformance(currentPage - 1)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Prev
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Page {currentPage} of {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => fetchPerformance(currentPage + 1)}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
