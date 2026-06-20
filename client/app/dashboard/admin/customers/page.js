'use client';
import { useState, useEffect } from 'react';
import api from '@/app/services/api';
import { Users, Crown, Activity, Heart, Calendar, Phone, Award, Ticket, Star, ChevronRight, X } from 'lucide-react';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function CustomersDashboard() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [inactiveCustomers, setInactiveCustomers] = useState([]);
  const [viewingCustomer, setViewingCustomer] = useState(null);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCRMData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const getPointsTier = (points) => {
    if (points >= 500) return { label: 'Platinum', color: 'text-[var(--color-secondary)]', bg: 'bg-[var(--color-secondary)]/10' };
    if (points >= 200) return { label: 'Gold', color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10' };
    if (points >= 50) return { label: 'Silver', color: 'text-[var(--color-text-muted)]', bg: 'bg-[var(--color-surface-soft)]' };
    return { label: 'Member', color: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success)]/10' };
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="p-8 space-y-6">
          <div className="h-10 w-48 bg-[var(--color-surface-soft)] rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-[var(--color-surface-soft)] rounded-xl animate-pulse" />)}
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
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
                <Crown className="text-[var(--color-primary)] h-10 w-10" />
                Customer Rewards
              </h1>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-2">Manage customer relationships and reward points.</p>
            </div>
            <button 
              onClick={fetchCRMData}
              className="px-6 py-3 bg-[var(--color-text-primary)] text-[var(--color-bg-base)] text-xs font-bold uppercase tracking-normal rounded-xl  transition-transform shadow-sm "
            >
              Refresh Information
            </button>
          </div>
        </SlideIn>

        {/* Analytics KPIs */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SlideIn delay={0.1}>
              <div className="bg-[var(--color-surface)]/40  p-6 rounded-xl border border-[var(--color-border)] shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Users size={120} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Total Reach</p>
                <p className="text-4xl font-bold text-[var(--color-text-primary)] mt-2">{analytics.totalCustomers}</p>
                <p className="text-xs font-bold text-[var(--color-success)] mt-2 flex items-center gap-1">
                  Active tracked profiles
                </p>
              </div>
            </SlideIn>

            <SlideIn delay={0.2}>
              <div className="bg-[var(--color-surface)]/40  p-6 rounded-xl border border-[var(--color-border)] shadow-sm relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Activity size={120} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Repeat Rate</p>
                <p className="text-4xl font-bold text-[var(--color-text-primary)] mt-2">{analytics.repeatRate}%</p>
                <p className="text-xs font-bold text-[var(--color-success)] mt-2 flex items-center gap-1">
                  {analytics.repeatCustomers} returning customers
                </p>
              </div>
            </SlideIn>

            <SlideIn delay={0.3}>
              <div className="bg-[var(--color-primary)] p-6 rounded-xl shadow-sm  text-[var(--color-on-primary)] relative overflow-hidden group  transition-transform cursor-pointer">
                <div className="absolute -right-4 -bottom-4 opacity-20">
                  <Award size={120} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-normal opacity-80">Outstanding Points</p>
                <p className="text-4xl font-bold mt-2">{analytics.totalRewardPoints?.toLocaleString()}</p>
                <p className="text-xs font-bold opacity-90 mt-2 flex items-center gap-1">
                  Total reward points
                </p>
              </div>
            </SlideIn>

            <SlideIn delay={0.4}>
              <div className="bg-[var(--color-danger)]/10 p-6 rounded-xl border border-[var(--color-danger)]/20 relative overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)]">At Risk (Inactive)</p>
                <p className="text-4xl font-bold text-[var(--color-danger)] mt-2">{analytics.inactiveCustomersCount}</p>
                <p className="text-xs font-bold text-[var(--color-danger)] mt-2 flex items-center gap-1">
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
              <h2 className="text-lg font-bold uppercase tracking-normal text-[var(--color-text-primary)] flex items-center gap-2">
                <Star className="text-[var(--color-primary)]" /> Top Reward Earners
              </h2>
            </SlideIn>
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]/50">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Rank</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Customer</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Tier</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Total Spend</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Visits</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {topCustomers.map((cust, idx) => {
                      const tier = getPointsTier(cust.loyaltyPoints);
                      return (
                        <tr key={cust._id} className="hover:bg-[var(--color-primary)]/[0.02] transition-colors group">
                          <td className="p-6">
                            <span className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${idx < 3 ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary-dark)] dark:text-[var(--color-primary)]' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-[var(--color-text-primary)]">{cust.name}</p>
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{cust.phone}</p>
                          </td>
                          <td className="p-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-normal ${tier.bg} ${tier.color}`}>
                              {tier.label}
                            </span>
                          </td>
                          <td className="p-6">
                            <p className="text-lg font-bold text-[var(--color-text-primary)]">₹{cust.totalSpend?.toLocaleString()}</p>
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-[var(--color-text-secondary)]">{cust.visits}x</p>
                          </td>
                          <td className="p-6">
                            <button 
                              onClick={() => setViewingCustomer(cust)}
                              className="p-2 rounded-xl bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] transition-all shadow-sm opacity-0 group-hover:opacity-100"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Inactive Customers Target List */}
          <div className="space-y-6">
            <SlideIn delay={0.6}>
              <h2 className="text-lg font-bold uppercase tracking-normal text-[var(--color-text-primary)] flex items-center gap-2">
                <Heart className="text-[var(--color-danger)]" /> Retention Targets
              </h2>
            </SlideIn>
            
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm flex flex-col gap-4">
              {inactiveCustomers.map(cust => (
                <div key={cust._id} className="p-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex justify-between items-center group hover:border-[var(--color-danger)]/30 transition-colors">
                  <div>
                    <p className="font-bold text-[var(--color-text-primary)]">{cust.name}</p>
                    <p className="text-xs font-medium text-[var(--color-text-muted)] mt-1 flex items-center gap-1">
                      <Calendar size={12}/> Last: {new Date(cust.lastVisit).toLocaleDateString()}
                    </p>
                  </div>
                  <a href={`tel:${cust.phone}`} className="h-10 w-10 rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)] flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                    <Phone size={16} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Deep Dive Modal */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 ">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-surface)] w-full max-w-lg rounded-xl shadow-sm overflow-hidden border border-[var(--color-border)]"
          >
            <div className="p-8 border-b border-[var(--color-border)] flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Customer <span className="text-[var(--color-primary)]">Profile</span></h3>
                <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-1">ID: {viewingCustomer._id}</p>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="h-10 w-10 rounded-full bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-[var(--color-surface-soft)] rounded-xl border border-[var(--color-border)]">
                <div className="h-14 w-14 rounded-xl bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center text-2xl font-bold shadow-lg ">
                  {viewingCustomer.name?.charAt(0) || 'C'}
                </div>
                <div>
                  <p className="font-bold text-xl text-[var(--color-text-primary)]">{viewingCustomer.name}</p>
                  <p className="text-sm font-bold text-[var(--color-text-secondary)] flex items-center gap-1 mt-1">
                    <Phone size={14}/> {viewingCustomer.phone}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[var(--color-success)]/10 border border-[var(--color-success)]/20">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-success)] mb-1">Lifetime Value</p>
                  <p className="text-2xl font-bold text-[var(--color-success)]">₹{viewingCustomer.totalSpend?.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-1 flex items-center gap-1"><Award size={12}/> Reward Points</p>
                  <p className="text-2xl font-bold text-[var(--color-primary)]">{viewingCustomer.loyaltyPoints} pts</p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-[var(--color-surface-soft)]/30 border-t border-[var(--color-border)]">
              <button
                onClick={() => setViewingCustomer(null)}
                className="w-full py-4 rounded-xl bg-[var(--color-text-primary)] text-[var(--color-bg-base)] text-xs font-bold uppercase tracking-normal transition-all  shadow-sm "
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
