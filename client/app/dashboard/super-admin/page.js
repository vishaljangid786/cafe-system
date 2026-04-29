'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { 
  Crown, Map, TrendingUp, DollarSign, 
  ArrowUpRight, ArrowDownRight, Users, 
  ChefHat, Ticket, CreditCard, AlertOctagon, 
  ChevronRight, Activity, Globe, Zap
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchExecutiveSummary();
  }, []);

  const fetchExecutiveSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/super-admin/executive-summary');
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to sync executive intelligence');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-amber-500 font-black text-2xl tracking-[1em]"
        >
          SYNCING...
        </motion.div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#050505] text-zinc-100 p-6 lg:p-12 space-y-12 overflow-hidden relative">
        
        {/* Cinematic Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-600/10 blur-[120px] rounded-full -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -ml-64 -mb-64" />

        {/* Global Control Header */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="px-3 py-1 bg-amber-600/20 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-600/30">
                  Executive Suite
                </span>
                <span className="h-1 w-1 bg-zinc-700 rounded-full" />
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Global Network Control</span>
              </div>
              <h1 className="text-6xl font-black tracking-tighter text-white flex items-center gap-4 italic">
                <Crown className="text-amber-500 h-14 w-14" />
                ORACLE <span className="text-zinc-500">OS</span>
              </h1>
            </div>

            <div className="flex items-center gap-8 bg-zinc-900/40 backdrop-blur-3xl p-6 rounded-[2rem] border border-zinc-800/50 shadow-2xl">
              <div className="text-right">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Nodes</p>
                <p className="text-3xl font-black text-white">{data?.totalBranches}</p>
              </div>
              <div className="h-10 w-[1px] bg-zinc-800" />
              <div className="text-right">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Network Health</p>
                <p className="text-3xl font-black text-emerald-500 uppercase">99.8%</p>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          <MetricCard 
            title="Lifetime Revenue" 
            value={`₹${(data?.totalRevenue / 100000).toFixed(1)}L`} 
            icon={<Globe className="text-blue-500" />}
            trend="+12.4%"
            sub="Total aggregated capital"
          />
          <MetricCard 
            title="Today's Velocity" 
            value={`₹${data?.todayRevenue?.toLocaleString()}`} 
            icon={<Zap className="text-amber-500" />}
            trend="+8.2%"
            sub="Live transactional stream"
            highlight
          />
          <MetricCard 
            title="Net Profit Hub" 
            value={`₹${(data?.netProfit / 100000).toFixed(1)}L`} 
            icon={<TrendingUp className="text-emerald-500" />}
            trend="+5.1%"
            sub="Estimated earnings after COGS"
          />
          <MetricCard 
            title="Risk Alerts" 
            value={data?.alerts?.lowStockItems + data?.alerts?.recentCancellations} 
            icon={<AlertOctagon className="text-rose-500" />}
            trend="Attention"
            sub="Items requiring intervention"
            isRisk={true}
          />
        </div>

        {/* Performance Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
          
          {/* Branch Leaderboard */}
          <div className="lg:col-span-2 bg-zinc-900/20 backdrop-blur-2xl rounded-[3rem] border border-zinc-800/50 overflow-hidden shadow-2xl">
            <div className="p-10 flex items-center justify-between border-b border-zinc-800/50">
              <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 italic">
                <Map className="text-amber-500" /> Branch Rankings
              </h2>
              <button className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">
                View All Nodes
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <th className="p-6">Branch</th>
                    <th className="p-6">Performance</th>
                    <th className="p-6">Contribution</th>
                    <th className="p-6 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {data?.branchRanking?.map((branch, idx) => (
                    <tr key={idx} className="group hover:bg-zinc-800/20 transition-all">
                      <td className="p-6 flex items-center gap-4">
                        <span className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black italic ${idx === 0 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                          {idx + 1}
                        </span>
                        <p className="font-bold text-white">{branch.name}</p>
                      </td>
                      <td className="p-6">
                        <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(branch.revenue / data.totalRevenue) * 100}%` }}
                            className={`h-full ${idx === 0 ? 'bg-amber-500' : 'bg-zinc-500'}`}
                          />
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="text-xs font-bold text-zinc-500 italic">
                          {((branch.revenue / data.totalRevenue) * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <p className="font-black text-white italic">₹{branch.revenue?.toLocaleString()}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Special Widgets */}
          <div className="space-y-8">
            {/* Top Entities */}
            <div className="bg-zinc-900/40 backdrop-blur-xl p-8 rounded-[3rem] border border-zinc-800/50 shadow-2xl space-y-8">
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Global Elite</h2>
              
              <EntityLink 
                icon={<ChefHat className="text-amber-500" />} 
                label="Lead Chef" 
                name={data?.topChefs?.[0]?.name || 'N/A'} 
                stat={`${data?.topChefs?.[0]?.orderCount || 0} Orders`}
              />
              <EntityLink 
                icon={<Users className="text-blue-500" />} 
                label="Lead Staff" 
                name={data?.topStaff?.[0]?.name || 'N/A'} 
                stat={`${data?.topStaff?.[0]?.orderCount || 0} Sales`}
              />
              <div className="h-[1px] bg-zinc-800" />
              <EntityLink 
                icon={<CreditCard className="text-emerald-500" />} 
                label="UPI Leader" 
                name={data?.upiLeader?.branchName || 'N/A'} 
                stat={`₹${data?.upiLeader?.total?.toLocaleString()}`}
              />
              <EntityLink 
                icon={<Ticket className="text-purple-500" />} 
                label="Offer Usage" 
                name={data?.highestCouponBranch?.name || 'N/A'} 
                stat={`${data?.highestCouponBranch?.count || 0} Coupons`}
              />
            </div>

            {/* Cinematic Summary Card */}
            <div className="relative group cursor-pointer overflow-hidden rounded-[3rem]">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600 to-orange-600 opacity-90 group-hover:scale-110 transition-transform duration-700" />
              <div className="relative p-8 text-white space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Executive Summary</p>
                <h3 className="text-2xl font-black italic">Network performance is exceeding Q2 projections by 18%.</h3>
                <div className="flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-4 py-2 rounded-full backdrop-blur-md">
                  View Full Report <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function MetricCard({ title, value, icon, trend, sub, highlight, isRisk }) {
  return (
    <div className={`p-8 rounded-[3rem] border transition-all duration-500 hover:scale-[1.02] ${
      highlight 
        ? 'bg-amber-600 border-amber-500 shadow-[0_20px_50px_rgba(217,119,6,0.2)] text-white' 
        : 'bg-zinc-900/30 backdrop-blur-2xl border-zinc-800/50 text-zinc-100 shadow-2xl'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <div className={`p-4 rounded-2xl ${highlight ? 'bg-white/20' : 'bg-zinc-800'}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
          isRisk ? 'bg-rose-500/20 text-rose-500' : (highlight ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-500')
        }`}>
          {isRisk ? <AlertOctagon size={10} /> : <ArrowUpRight size={10} />}
          {trend}
        </div>
      </div>
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${highlight ? 'opacity-80' : 'text-zinc-500'}`}>{title}</p>
      <h3 className="text-4xl font-black italic tracking-tighter mb-4">{value}</h3>
      <p className={`text-[10px] font-bold ${highlight ? 'opacity-70' : 'text-zinc-500 italic'}`}>{sub}</p>
    </div>
  );
}

function EntityLink({ icon, label, name, stat }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-zinc-800/50 rounded-2xl group-hover:bg-zinc-700 transition-colors">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</p>
          <p className="text-sm font-bold text-white group-hover:text-amber-500 transition-colors">{name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-black text-white italic">{stat}</p>
      </div>
    </div>
  );
}
