'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { can } from '@/app/config/actions';
import { blockNonInteger } from '@/app/utils/inputValidation';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Users, Clock, Plus, Check, X, UserX } from 'lucide-react';

export default function WaitlistPage() {
  const { user } = useAuth();
  const branchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState('');
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', partySize: '2', quotedWaitMinutes: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

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
      const res = await api.get(`/waitlist${q}`);
      setEntries(res.data.data || []);
    } catch (e) { console.error('Could not load the waitlist'); }
    finally { setLoading(false); }
  }, [scope, branchScoped]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const add = async () => {
    if (!form.customerName.trim()) return toast.error('Enter a name');
    setBusy(true);
    try {
      await api.post('/waitlist', { ...form, ...(branchScoped ? {} : { locationId: scope }) });
      toast.success('Added to waitlist');
      setForm({ customerName: '', customerPhone: '', partySize: '2', quotedWaitMinutes: '', notes: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not add'); }
    finally { setBusy(false); }
  };

  const act = async (id, status) => {
    setBusy(true);
    try {
      await api.patch(`/waitlist/${id}`, { status });
      toast.success(status === 'seated' ? 'Party seated' : status === 'no-show' ? 'Marked no-show' : 'Removed');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not update'); }
    finally { setBusy(false); }
  };

  if (loading) return <LoadingScreen />;

  const inputCls = 'px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-medium text-(--color-text-primary) outline-none focus:border-primary';

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><Users size={22} /></div>
              <div>
                <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">Waitlist</h1>
                <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Walk-in queue · {entries.length} waiting</p>
              </div>
            </div>
            {!branchScoped && (
              <div className="w-48">
                <PremiumSelect
                  value={scope}
                  onChange={setScope}
                  options={locations.map((l) => ({ label: l.name, value: l._id }))}
                  placeholder="Select branch"
                />
              </div>
            )}
          </div>
        </SlideIn>

        {/* Add walk-in */}
        <SlideIn delay={0.05}>
          <div className="glass-card p-6 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><Plus size={15} className="text-primary" /> Add a party</h2>
            <div className="flex flex-wrap gap-2">
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Name" className={`${inputCls} flex-1 min-w-32`} />
              <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="Phone" className={`${inputCls} w-32`} />
              <input type="number" min="1" onKeyDown={blockNonInteger} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} placeholder="Party" className={`${inputCls} w-20`} title="Party size" />
              <input type="number" min="0" onKeyDown={blockNonInteger} value={form.quotedWaitMinutes} onChange={(e) => setForm({ ...form, quotedWaitMinutes: e.target.value })} placeholder="~min" className={`${inputCls} w-20`} title="Quoted wait (min)" />
              {can(user, 'waitlist.add') && (
                <button onClick={add} disabled={busy} className="px-6 py-2.5 bg-primary text-(--color-on-primary) text-[11px] font-semibold tracking-normal rounded-xl hover:opacity-90 disabled:opacity-50">Add</button>
              )}
            </div>
          </div>
        </SlideIn>

        {/* Queue */}
        <SlideIn delay={0.1}>
          <div className="glass-card p-6 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">Waiting</h2>
            {entries.length === 0 && <p className="text-xs text-(--color-text-muted)">No one waiting right now.</p>}
            <div className="space-y-2">
              {entries.map((e, idx) => {
                const waited = Math.max(0, Math.floor((now - new Date(e.createdAt).getTime()) / 60000));
                const over = e.quotedWaitMinutes > 0 && waited > e.quotedWaitMinutes;
                return (
                  <div key={e._id} className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">#{idx + 1}</span>
                      <div>
                        <p className="text-xs font-medium text-(--color-text-primary)">{e.customerName} <span className="text-(--color-text-muted)">· party of {e.partySize}</span></p>
                        <p className={`text-[11px] font-medium flex items-center gap-1 ${over ? 'text-danger' : 'text-(--color-text-muted)'}`}>
                          <Clock size={10} /> waiting {waited}m{e.quotedWaitMinutes > 0 ? ` / ~${e.quotedWaitMinutes}m` : ''}{e.customerPhone ? ` · ${e.customerPhone}` : ''}
                        </p>
                      </div>
                    </div>
                    {can(user, 'waitlist.modify') && (
                    <div className="flex items-center gap-2">
                      <button disabled={busy} onClick={() => act(e._id, 'seated')} className="flex items-center gap-1 px-3 py-2 bg-success/10 text-success text-[11px] font-medium rounded-lg border border-success/20 hover:bg-success hover:text-white disabled:opacity-50"><Check size={12} /> Seat</button>
                      <button disabled={busy} onClick={() => act(e._id, 'no-show')} className="flex items-center gap-1 px-3 py-2 bg-amber-500/10 text-amber-500 text-[11px] font-medium rounded-lg border border-amber-500/20 hover:bg-amber-500 hover:text-white disabled:opacity-50"><UserX size={12} /> No-show</button>
                      <button disabled={busy} onClick={() => act(e._id, 'cancelled')} className="flex items-center gap-1 px-3 py-2 bg-danger/10 text-danger text-[11px] font-medium rounded-lg border border-danger/20 hover:bg-danger hover:text-white disabled:opacity-50"><X size={12} /></button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
