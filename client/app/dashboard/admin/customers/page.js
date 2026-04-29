'use client';
import { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { Users, Crown, Activity, Heart, Calendar, Phone, Award, Ticket, Star, ChevronRight, X } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function CustomersDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [inactiveCustomers, setInactiveCustomers] = useState([]);
  const [viewingCustomer, setViewingCustomer] = useState(null);

  useEffect(() => {
    fetchCRMData();
  }, []);

  const fetchCRMData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, topRes, inactiveRes] = await Promise.all([
        api.get('/customers/analytics'),
        api.get('/customers/top'),
        api.get('/customers/inactive')
      ]);

      setAnalytics(analyticsRes.data.data);
      setTopCustomers(topRes.data.data);
      setInactiveCustomers(inactiveRes.data.data);
    } catch (err) {
      console.error('Failed to load CRM data', err);
      toast.error('Failed to load CRM matrices');
    } finally {
      setLoading(false);
    }
  };

  const getPointsTier = (points) => {
    if (points >= 500) return { label: 'Platinum', color: 'text-purple-500', bg: 'bg-purple-500/10' };
    if (points >= 200) return { label: 'Gold', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (points >= 50) return { label: 'Silver', color: 'text-zinc-500', bg: 'bg-zinc-500/10' };
    return { label: 'Member', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="p-8 space-y-6">
          <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-[2rem] animate-pulse" />)}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Header Segment */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                <Crown className="text-amber-600 h-10 w-10" />
                Loyalty & CRM
              </h1>
              <p className="text-sm font-medium text-zinc-500 mt-2">Manage customer relationships and auto-reward pipelines.</p>
            </div>
            <button 
              onClick={fetchCRMData}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-zinc-900/10"
            >
              Refresh Intelligence
            </button>
          </div>
        </SlideIn>

        {/* Analytics KPIs */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SlideIn delay={0.1}>
              <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Users size={120} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Reach</p>
                <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 mt-2">{analytics.totalCustomers}</p>
                <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                  Active tracked profiles
                </p>
              </div>
            </SlideIn>

            <SlideIn delay={0.2}>
              <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Activity size={120} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Repeat Rate</p>
                <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 mt-2">{analytics.repeatRate}%</p>
                <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                  {analytics.repeatCustomers} returning customers
                </p>
              </div>
            </SlideIn>

            <SlideIn delay={0.3}>
              <div className="bg-amber-600 p-6 rounded-3xl shadow-xl shadow-amber-600/20 text-white relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer">
                <div className="absolute -right-4 -bottom-4 opacity-20">
                  <Award size={120} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Outstanding Points</p>
                <p className="text-4xl font-black mt-2">{analytics.totalLoyaltyPoints?.toLocaleString()}</p>
                <p className="text-xs font-bold opacity-90 mt-2 flex items-center gap-1">
                  Unclaimed loyalty capital
                </p>
              </div>
            </SlideIn>

            <SlideIn delay={0.4}>
              <div className="bg-rose-500/10 dark:bg-rose-500/5 p-6 rounded-3xl border border-rose-500/20 relative overflow-hidden">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">At Risk (Inactive)</p>
                <p className="text-4xl font-black text-rose-700 dark:text-rose-400 mt-2">{analytics.inactiveCustomersCount}</p>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-500 mt-2 flex items-center gap-1">
                   30 days since last visit
                </p>
              </div>
            </SlideIn>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Customers Leaderboard */}
          <div className="lg:col-span-2 space-y-6">
            <SlideIn delay={0.5}>
              <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Star className="text-amber-500" /> Top Loyalists
              </h2>
            </SlideIn>
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Rank</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Customer</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Tier</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Spend</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Visits</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {topCustomers.map((cust, idx) => {
                      const tier = getPointsTier(cust.loyaltyPoints);
                      return (
                        <tr key={cust._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                          <td className="p-6">
                            <span className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{cust.name}</p>
                            <p className="text-xs font-medium text-zinc-500">{cust.phone}</p>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tier.bg} ${tier.color}`}>
                              {tier.label}
                            </span>
                          </td>
                          <td className="p-6">
                            <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">₹{cust.totalSpend?.toLocaleString()}</p>
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-zinc-600 dark:text-zinc-400">{cust.visits}x</p>
                          </td>
                          <td className="p-6">
                            <button 
                              onClick={() => setViewingCustomer(cust)}
                              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-amber-600 hover:text-white transition-all shadow-sm opacity-0 group-hover:opacity-100"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {topCustomers.length === 0 && (
                  <div className="p-12 text-center text-zinc-500 font-medium">
                    No customer data accumulated yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inactive Customers Target List */}
          <div className="space-y-6">
            <SlideIn delay={0.6}>
              <h2 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Heart className="text-rose-500" /> Retention Targets
              </h2>
            </SlideIn>
            
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
              {inactiveCustomers.map(cust => (
                <div key={cust._id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group hover:border-rose-500/30 transition-colors">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{cust.name}</p>
                    <p className="text-xs font-medium text-zinc-500 mt-1 flex items-center gap-1">
                      <Calendar size={12}/> Last: {new Date(cust.lastVisit).toLocaleDateString()}
                    </p>
                  </div>
                  <a href={`tel:${cust.phone}`} className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                    <Phone size={16} />
                  </a>
                </div>
              ))}
              {inactiveCustomers.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Heart size={20} />
                  </div>
                  <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Excellent Retention!</p>
                  <p className="text-xs font-medium text-zinc-500">No inactive high-value targets.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Deep Dive Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
          >
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Customer <span className="text-amber-600">Profile</span></h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">ID: {viewingCustomer._id}</p>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-rose-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="h-14 w-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-amber-500/20">
                  {viewingCustomer.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <p className="font-black text-xl text-zinc-900 dark:text-zinc-100">{viewingCustomer.name}</p>
                  <p className="text-sm font-bold text-zinc-500 flex items-center gap-1 mt-1">
                    <Phone size={14}/> {viewingCustomer.phone}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">Lifetime Value</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">₹{viewingCustomer.totalSpend?.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1"><Ticket size={12}/> Active Points</p>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{viewingCustomer.loyaltyPoints}</p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setViewingCustomer(null)}
                className="w-full py-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] shadow-xl shadow-zinc-900/10"
              >
                Close Profile
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PageTransition>
  );
}
