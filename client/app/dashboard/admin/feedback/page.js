'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { Star, MessageSquare, Link2, Copy } from 'lucide-react';

export default function FeedbackPage() {
  const { user } = useAuth();
  const branchScoped = ['branch_admin', 'location_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState('');
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user || branchScoped) return;
    api.get('/locations').then((r) => {
      const locs = r.data?.data || r.data || [];
      setLocations(locs);
      setScope(locs[0]?._id || '');
    }).catch(() => {});
  }, [user, branchScoped]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = !branchScoped && scope ? `?locationId=${scope}` : '';
      const res = await api.get(`/feedback${q}`);
      setList(res.data.data || []);
      setStats(res.data.stats || null);
    } catch (e) {
      toast.error('Could not load feedback');
    } finally {
      setLoading(false);
    }
  }, [scope, branchScoped]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const branchForLink = branchScoped ? (user?.assignedLocation?._id || user?.assignedLocation) : scope;
  const feedbackLink = branchForLink && typeof window !== 'undefined' ? `${window.location.origin}/feedback?branch=${branchForLink}` : '';

  const copyLink = () => {
    if (!feedbackLink) return;
    navigator.clipboard?.writeText(feedbackLink);
    toast.success('Feedback link copied');
  };

  if (loading) return <LoadingScreen />;

  const total = stats?.count || 0;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><MessageSquare size={22} /></div>
              <div>
                <h1 className="text-2xl font-bold text-(--color-text-primary) tracking-tight">Customer Feedback</h1>
                <p className="text-[11px] font-bold text-(--color-text-muted) uppercase tracking-normal">Ratings & reviews</p>
              </div>
            </div>
            {!branchScoped && (
              <select value={scope} onChange={(e) => setScope(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-bold uppercase tracking-normal text-(--color-text-primary) outline-none">
                {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            )}
          </div>
        </SlideIn>

        {/* Shareable link */}
        {feedbackLink && (
          <SlideIn delay={0.05}>
            <div className="glass-card p-4 rounded-xl flex items-center gap-3 flex-wrap">
              <Link2 size={16} className="text-primary" />
              <span className="text-[11px] font-medium text-(--color-text-muted) flex-1 min-w-40 truncate">{feedbackLink}</span>
              <button onClick={copyLink} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-normal rounded-lg border border-primary/20 hover:bg-primary hover:text-(--color-on-primary)">
                <Copy size={12} /> Copy link / make QR
              </button>
            </div>
          </SlideIn>
        )}

        {/* Stats */}
        <SlideIn delay={0.1}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-6 rounded-xl text-center">
              <p className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">Average rating</p>
              <p className="text-4xl font-bold text-(--color-text-primary) tracking-tight mt-1">{stats?.avgRating || 0}<span className="text-lg text-(--color-text-muted)">/5</span></p>
              <div className="flex justify-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={16} className={(stats?.avgRating || 0) >= n - 0.5 ? 'text-amber-400 fill-amber-400' : 'text-(--color-border)'} />)}
              </div>
              <p className="text-[10px] text-(--color-text-muted) mt-2">{total} review{total === 1 ? '' : 's'}</p>
            </div>
            <div className="glass-card p-6 rounded-xl md:col-span-2 space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = stats?.distribution?.[n] || 0;
                const pct = total ? Math.round((c / total) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-(--color-text-muted) w-6">{n}★</span>
                    <div className="flex-1 h-2 rounded-full bg-(--color-surface-soft) overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-(--color-text-muted) w-8 text-right">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </SlideIn>

        {/* Reviews */}
        <SlideIn delay={0.15}>
          <div className="glass-card p-6 rounded-xl space-y-3">
            <h2 className="text-sm font-bold text-(--color-text-primary)">Recent reviews</h2>
            {list.length === 0 && <p className="text-xs text-(--color-text-muted)">No feedback yet. Share the link above to start collecting.</p>}
            <div className="divide-y divide-(--color-border)">
              {list.map((f) => (
                <div key={f._id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={f.rating >= n ? 'text-amber-400 fill-amber-400' : 'text-(--color-border)'} />)}
                      <span className="text-[10px] font-bold text-(--color-text-primary) ml-2">{f.customerName || 'Guest'}</span>
                    </div>
                    <span className="text-[9px] text-(--color-text-muted)">{new Date(f.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  {f.comment && <p className="text-xs text-(--color-text-secondary) mt-1.5">{f.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
