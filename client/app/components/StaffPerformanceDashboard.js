'use client';
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  TrendingUp, Timer, ShoppingBag, Award, XCircle, CheckCircle2, Zap, History,
  Filter, Calendar, Bookmark, Utensils, CreditCard, Ticket
} from 'lucide-react';
import { PageTransition } from './ui/AnimatedContainer';
import toast from 'react-hot-toast';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PremiumSelect from './ui/PremiumSelect';
import useBranchScope from '../hooks/useBranchScope';

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colorMap = {
    amber: 'text-primary bg-primary/10 border-primary/20',
    blue: 'text-primary bg-primary/10 border-primary/20',
    emerald: 'text-success bg-success/10 border-success/20',
    rose: 'text-danger bg-danger/10 border-danger/20',
    violet: 'text-primary bg-primary/10 border-primary/20',
    fuchsia: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20'
  };

  return (
    <div className="bg-(--color-surface)/80  rounded-xl p-6 border border-(--color-border) flex items-center gap-5 shadow-sm hover:shadow-md transition-all duration-300">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${colorMap[color] || 'text-(--color-text-muted) bg-(--color-surface-soft)'}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-(--color-text-primary) tracking-tight leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-2">{label}</p>
        {sub && <p className="text-[9px] font-bold text-(--color-text-secondary) mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function StaffPerformanceDashboard({ user, role }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { singleBranchId } = useBranchScope();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    foodItem: '',
    paymentType: '',
    coupon: ''
  });

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [coupons, setCoupons] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchFilterOptions = async () => {
    try {
      const [catRes, menuRes, coupRes] = await Promise.all([
        api.get('/categories').catch(() => ({ data: { data: [] } })),
        api.get('/menu').catch(() => ({ data: { data: [] } })),
        api.get('/coupons').catch(() => ({ data: { data: [] } }))
      ]);
      setCategories(catRes.data.data || []);
      setMenuItems(menuRes.data.data || []);
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
      if (singleBranchId !== 'all') params.branch = singleBranchId;
      if (filters.paymentType) params.paymentType = filters.paymentType;
      if (filters.coupon) params.coupon = filters.coupon;

      const endpoint = role === 'chef' ? '/orders/my-stats-chef' : '/orders/my-stats-staff';
      const res = await api.get(endpoint, { params });
      
      setStats(res.data.data);
      setCurrentPage(res.data.data.pagination?.page || 1);
      setTotalPages(res.data.data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Could not load your performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFilterOptions();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPerformance(1);
    }, 0);

    return () => clearTimeout(timer);
  }, [filters, singleBranchId]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (!user) return null;

  return (
    <div className="max-w-400 mx-auto pb-20 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-(--color-text-primary) tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg ">
              <TrendingUp size={24} className="text-(--color-on-primary)" />
            </div>
            {role === 'chef' ? 'Chef' : 'Staff'} Performance Dashboard
          </h1>
          <p className="text-xs text-(--color-text-muted) mt-1 font-medium">See your orders, sales, and overall work performance.</p>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-(--color-surface)/80  p-8 rounded-xl border border-(--color-border) shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-(--color-border)">
          <Filter size={16} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Filters</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> From Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) text-xs font-bold focus:border-primary focus:outline-none transition-all text-(--color-text-primary)"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> To Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) text-xs font-bold focus:border-primary focus:outline-none transition-all text-(--color-text-primary)"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Bookmark size={12} /> Category
            </label>
            <PremiumSelect
              value={filters.category}
              onChange={(val) => handleFilterChange('category', val)}
              options={[
                { label: 'All Categories', value: '' },
                ...categories.map(cat => ({ label: cat.name, value: cat._id }))
              ]}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Utensils size={12} /> Food Item
            </label>
            <PremiumSelect
              value={filters.foodItem}
              onChange={(val) => handleFilterChange('foodItem', val)}
              options={[
                { label: 'All Items', value: '' },
                ...menuItems.map(item => ({ label: item.name, value: item._id }))
              ]}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <CreditCard size={12} /> Payment Type
            </label>
            <PremiumSelect
              value={filters.paymentType}
              onChange={(val) => handleFilterChange('paymentType', val)}
              options={[
                { label: 'All Types', value: '' },
                { label: 'Cash', value: 'CASH' },
                { label: 'Card', value: 'CARD' },
                { label: 'UPI', value: 'UPI' },
                { label: 'Online', value: 'ONLINE' }
              ]}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Ticket size={12} /> Coupon Used
            </label>
            <PremiumSelect
              value={filters.coupon}
              onChange={(val) => handleFilterChange('coupon', val)}
              options={[
                { label: 'All Coupons', value: '' },
                ...coupons.map(coup => ({ label: coup.code, value: coup._id }))
              ]}
              className="w-full"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                startDate: '', endDate: '', category: '', foodItem: '', paymentType: '', coupon: ''
              })}
              className="w-full py-3 bg-primary text-(--color-on-primary) hover:bg-primary/80 rounded-xl text-xs font-bold uppercase tracking-normal transition-all shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-28 bg-(--color-surface-soft) rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Total Orders" value={stats?.totalOrders || 0} sub="Orders you handled" icon={ShoppingBag} color="amber" />
            <MetricCard label="Highest Order" value={`₹${stats?.highestValue || 0}`} sub="Your biggest bill" icon={Award} color="emerald" />
            <MetricCard label="Lowest Order" value={`₹${stats?.lowestValue || 0}`} sub="Your smallest bill" icon={XCircle} color="rose" />
            <MetricCard label="Completed" value={stats?.completedOrders || 0} sub="Successfully served" icon={CheckCircle2} color="emerald" />
            <MetricCard label="Cancelled" value={stats?.cancelledOrders || 0} sub="Orders cancelled" icon={XCircle} color="rose" />
            <MetricCard label="Ignored/Unaccepted" value={stats?.unacceptedOrders || 0} sub="Not yet accepted" icon={Timer} color="amber" />
            <MetricCard label="Avg Ticket Size" value={`₹${stats?.avgTicketSize || 0}`} sub="Average bill amount" icon={TrendingUp} color="amber" />
            <MetricCard label="Total Sales" value={`₹${stats?.totalSales || 0}`} sub="Total sales amount" icon={Zap} color="violet" />
            <MetricCard label="Daily Payout" value={`₹${stats?.dailyPayout || 0}`} sub="Your daily pay" icon={CreditCard} color="fuchsia" />
            <MetricCard label="Top Category" value={stats?.bestSellingCategory || 'None'} sub="Best-selling category" icon={Bookmark} color="amber" />
            <MetricCard label="Top Item" value={stats?.bestSellingItem || 'None'} sub="Best-selling item" icon={Utensils} color="amber" />
            <MetricCard label="Completion Rate" value={`${stats?.successRate || 0}%`} sub="Orders served on time" icon={Award} color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 bg-white/80 dark:bg-(--color-surface)/80  rounded-xl border border-(--color-border)/50 dark:border-(--color-border)/50 p-8">
              <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-primary" /> Orders by Week
              </h3>
              <div className="h-75">
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

            <div className="lg:col-span-6 bg-white/80 dark:bg-(--color-surface)/80  rounded-xl border border-(--color-border)/50 dark:border-(--color-border)/50 p-8">
              <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-primary" /> Orders by Month
              </h3>
              <div className="h-75">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.ordersByMonth || []} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-(--color-surface)/80  rounded-xl border border-(--color-border) p-8">
            <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
              <History size={16} className="text-primary" /> Recent Orders
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-(--color-border)">
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Order ID</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Date</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Items</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Table</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Status</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentOrders?.map((order) => (
                    <tr key={order._id} className="border-b border-(--color-border)/50 hover:bg-(--color-surface-soft)/30 transition-all group">
                      <td className="py-4 text-xs font-bold text-(--color-text-secondary) dark:text-(--color-text-muted)">#{order._id.slice(-6).toUpperCase()}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-muted)">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-primary) dark:text-(--color-text-muted) line-clamp-1 mt-2">{order.items?.map(it => it.menuItem?.name || 'Item').join(', ')}</td>
                      <td className="py-4 text-xs font-bold text-primary">T{order.table?.tableNumber || 'N/A'}</td>
                      <td className="py-4">
                        <span className={`text-[9px] font-bold uppercase tracking-normal px-2 py-1 rounded-md ${
                          order.status === 'SERVED' ? 'bg-success/10 text-success' :
                          order.status === 'CANCELLED' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-4 text-xs font-bold text-(--color-text-primary) dark:text-white">₹{order.totalAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-(--color-border) dark:border-(--color-border)">
                <button
                  disabled={currentPage === 1}
                  onClick={() => fetchPerformance(currentPage - 1)}
                  className="px-4 py-2 bg-(--color-surface-soft) dark:bg-(--color-surface) hover:bg-(--color-surface-soft) dark:hover:bg-(--color-surface-soft) disabled:opacity-40 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all"
                >
                  Prev
                </button>
                <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Page {currentPage} of {totalPages}</span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => fetchPerformance(currentPage + 1)}
                  className="px-4 py-2 bg-(--color-surface-soft) dark:bg-(--color-surface) hover:bg-(--color-surface-soft) dark:hover:bg-(--color-surface-soft) disabled:opacity-40 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all"
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
