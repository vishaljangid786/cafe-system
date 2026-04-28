'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import {
  TrendingUp, Timer, ShoppingBag, Award, XCircle, Plus, CheckCircle2, Zap, History
} from 'lucide-react';
import { PageTransition } from '../../../components/ui/AnimatedContainer';
import toast from 'react-hot-toast';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function MetricCard({ label, value, sub, icon: Icon, color }) {
  const colorMap = {
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  };

  return (
    <div className="glass-morphism rounded-[2.5rem] p-8 border border-zinc-100 dark:border-zinc-800 flex items-center gap-6 shadow-sm">
      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border ${colorMap[color] || 'text-zinc-500 bg-zinc-500/10'}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter leading-none">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-2">{label}</p>
        <p className="text-[9px] font-bold text-zinc-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const { user } = useAuth();
  const [chefStats, setChefStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsFilter, setStatsFilter] = useState({ startDate: '', endDate: '' });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPerformance = async (pageToFetch = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const statsParams = { page: pageToFetch, limit: 20 };
      if (statsFilter.startDate) statsParams.startDate = statsFilter.startDate;
      if (statsFilter.endDate) statsParams.endDate = statsFilter.endDate;

      const statsEndpoint = user.role === 'chef' ? '/orders/my-stats-chef' : '/orders/my-stats-staff';
      const res = await api.get(statsEndpoint, { params: statsParams });
      
      setChefStats(res.data.data);
      setCurrentPage(res.data.data.pagination?.page || 1);
      setTotalPages(res.data.data.pagination?.pages || 1);
    } catch (error) {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance(1);
  }, [user]);

  if (!user) return null;

  return (
    <PageTransition>
      <div className="max-w-[1500px] mx-auto pb-20 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <TrendingUp size={24} className="text-white" />
              </div>
              My Performance
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium ml-13">Analyze and monitor your productivity metrics.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="flex-1 space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">From Date</label>
            <input
              type="date"
              value={statsFilter.startDate}
              onChange={(e) => setStatsFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-amber-500/20 outline-none text-xs font-bold transition-all"
            />
          </div>
          <div className="flex-1 space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">To Date</label>
            <input
              type="date"
              value={statsFilter.endDate}
              onChange={(e) => setStatsFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-amber-500/20 outline-none text-xs font-bold transition-all"
            />
          </div>
          <button
            onClick={fetchPerformance}
            className="px-8 py-4 bg-amber-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            Apply Filter
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-900 rounded-[2.5rem]" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard label="Total Handled" value={chefStats?.totalOrders || 0} sub="Total Items" icon={ShoppingBag} color="amber" />
              {user.role === 'chef' ? (
                <>
                  <MetricCard label="Avg Prep Efficiency" value={`${chefStats?.avgPrepTime || 0}m`} sub="ACCEPTED → READY" icon={Timer} color="blue" />
                  <MetricCard label="Fulfillment Quality" value={`${((chefStats?.totalOrders - chefStats?.rejectionsCount) / (chefStats?.totalOrders || 1) * 100).toFixed(0)}%`} sub="Approval Rating" icon={Award} color="emerald" />
                  <MetricCard label="System Rejections" value={chefStats?.rejectionsCount || 0} sub="Corrective Actions" icon={XCircle} color="rose" />
                </>
              ) : (
                <>
                  <MetricCard label="Placed by Me" value={chefStats?.createdCount || 0} sub="Frontline Initiation" icon={Plus} color="blue" />
                  <MetricCard label="Served by Me" value={chefStats?.servedCount || 0} sub="Service Completion" icon={CheckCircle2} color="emerald" />
                  <MetricCard label="System Activity" value={`${Math.round((chefStats?.servedCount / (chefStats?.totalOrders || 1)) * 100) || 0}%`} sub="Fulfillment %" icon={Zap} color="rose" />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 glass-morphism rounded-[3rem] border border-zinc-100 dark:border-zinc-800 p-10 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-8 flex items-center gap-3">
                    <History size={16} className="text-amber-500" /> Recent Orders Delivered
                  </h3>
                  <div className="space-y-4">
                    {chefStats?.recentOrders?.map((order, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-amber-500/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-xs">
                            T{order.table?.tableNumber || 'N'}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</p>
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 mt-0.5 line-clamp-1">{order.items?.map(it => it.menuItem?.name || it.itemName).join(', ') || 'Menu Items'}</p>
                          </div>
                        </div>
                        <div className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${order.status === 'SERVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {order.status}
                        </div>
                      </div>
                    ))}
                    {!chefStats?.recentOrders?.length && (
                      <div className="h-40 flex flex-col items-center justify-center opacity-30 italic text-xs font-bold">No orders processed in this sector.</div>
                    )}
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => fetchPerformance(currentPage - 1)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Page {currentPage} of {totalPages}</span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => fetchPerformance(currentPage + 1)}
                      className="px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {/* Performance Graph */}
              <div className="lg:col-span-5 glass-morphism rounded-[3rem] border border-zinc-100 dark:border-zinc-800 p-10 flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 mb-8 flex items-center gap-3">
                  <TrendingUp size={16} className="text-amber-500" /> Productivity Trends
                </h3>
                <div className="flex-1 min-h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chefStats?.ordersByDate || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a30" />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorOrders)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
