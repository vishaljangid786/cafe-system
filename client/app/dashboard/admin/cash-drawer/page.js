'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Wallet, LockOpen, Lock, ArrowDownCircle, ArrowUpCircle, Plus, Minus, IndianRupee, History } from 'lucide-react';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function CashDrawerPage() {
  const { user } = useAuth();
  const isBranchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(user?.role);
  const isSuper = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState(''); // locationId for admin/super; '' for branch-scoped (implicit)
  const [current, setCurrent] = useState(null); // { session, live }
  const [history, setHistory] = useState([]);

  const [openingFloat, setOpeningFloat] = useState('');
  const [moveAmount, setMoveAmount] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // Admins/super admins pick a branch; branch-scoped roles are implicit.
  useEffect(() => {
    if (!user || isBranchScoped) { setScope(''); return; }
    api.get('/locations')
      .then((res) => {
        const locs = res.data?.data || res.data || [];
        setLocations(locs);
        setScope(locs[0]?._id || '');
      })
      .catch(() => {});
  }, [user, isBranchScoped]);

  const q = useCallback(() => (scope ? `?locationId=${scope}` : ''), [scope]);

  const refresh = useCallback(async () => {
    if (!isBranchScoped && !scope) return;
    setLoading(true);
    try {
      const [cur, hist] = await Promise.all([
        api.get(`/cash-drawer/current${q()}`),
        api.get(`/cash-drawer${q()}`).catch(() => ({ data: { data: [] } })),
      ]);
      setCurrent(cur.data.data);
      setHistory(hist.data.data || []);
    } catch (e) {
      toast.error('Could not load cash drawer');
    } finally {
      setLoading(false);
    }
  }, [isBranchScoped, scope, q]);

  useEffect(() => { refresh(); }, [refresh]);

  const doOpen = async () => {
    setBusy(true);
    try {
      await api.post('/cash-drawer/open', { openingFloat: Number(openingFloat) || 0, ...(scope ? { locationId: scope } : {}) });
      toast.success('Cash drawer opened');
      setOpeningFloat('');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not open drawer');
    } finally { setBusy(false); }
  };

  const doMovement = async (type) => {
    const amt = Number(moveAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    setBusy(true);
    try {
      await api.post(`/cash-drawer/${current.session._id}/movement`, { type, amount: amt, reason: moveReason });
      toast.success(type === 'in' ? 'Cash paid in' : 'Cash paid out');
      setMoveAmount(''); setMoveReason('');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not record movement');
    } finally { setBusy(false); }
  };

  const doClose = async () => {
    if (countedCash === '' || Number(countedCash) < 0) return toast.error('Enter the counted cash');
    setBusy(true);
    try {
      const res = await api.post(`/cash-drawer/${current.session._id}/close`, { countedCash: Number(countedCash), notes: closeNotes });
      const v = res.data.data.variance;
      toast.success(v === 0 ? 'Drawer balanced — closed' : `Closed · variance ${money(v)}`);
      setCountedCash(''); setCloseNotes('');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not close drawer');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingScreen />;

  const live = current?.live;
  const session = current?.session;

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><Wallet size={22} /></div>
              <div>
                <h1 className="text-2xl font-bold text-(--color-text-primary) tracking-tight">Cash Drawer</h1>
                <p className="text-[11px] font-bold text-(--color-text-muted) uppercase tracking-normal">Open / close shift & reconcile cash</p>
              </div>
            </div>
            {!isBranchScoped && (
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

        {/* No open drawer -> open form */}
        {!session && (
          <SlideIn delay={0.05}>
            <div className="glass-card p-8 rounded-xl premium-shadow space-y-5">
              <div className="flex items-center gap-2 text-(--color-text-primary)">
                <LockOpen size={18} className="text-primary" />
                <h2 className="text-sm font-bold">Open the drawer</h2>
              </div>
              <p className="text-xs text-(--color-text-muted)">Enter the starting cash float in the register.</p>
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-50">
                  <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                  <input
                    type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="Opening float" min={0}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:border-primary"
                  />
                </div>
                <button onClick={doOpen} disabled={busy} className="px-8 py-3 bg-primary text-(--color-on-primary) text-[11px] font-bold uppercase tracking-normal rounded-xl hover:opacity-90 disabled:opacity-50">
                  Open drawer
                </button>
              </div>
            </div>
          </SlideIn>
        )}

        {/* Open drawer -> live + movements + close */}
        {session && live && (
          <>
            <SlideIn delay={0.05}>
              <div className="glass-card p-8 rounded-xl premium-shadow space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-success">
                    <LockOpen size={18} />
                    <h2 className="text-sm font-bold">Drawer open</h2>
                  </div>
                  <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">
                    by {session.openedBy?.name || '—'} · {new Date(session.openedAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    ['Opening float', session.openingFloat],
                    ['Cash sales', live.cashSales],
                    ['Cash refunds', -live.cashRefunds],
                    ['Paid in', live.cashIn],
                    ['Paid out', -live.cashOut],
                    ['Expected in drawer', live.expectedCash],
                  ].map(([label, val], i) => (
                    <div key={i} className={`p-4 rounded-xl border ${label === 'Expected in drawer' ? 'bg-primary/10 border-primary/30' : 'bg-(--color-surface-soft) border-(--color-border)'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">{label}</p>
                      <p className={`text-lg font-bold tracking-tight ${label === 'Expected in drawer' ? 'text-primary' : 'text-(--color-text-primary)'}`}>{money(val)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SlideIn>

            {/* Pay in / out */}
            <SlideIn delay={0.1}>
              <div className="glass-card p-8 rounded-xl premium-shadow space-y-4">
                <h2 className="text-sm font-bold text-(--color-text-primary)">Cash pay-in / pay-out</h2>
                <div className="flex gap-3 flex-wrap">
                  <input type="number" value={moveAmount} onChange={(e) => setMoveAmount(e.target.value)} placeholder="Amount" min={0}
                    className="w-32 px-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:border-primary" />
                  <input type="text" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="Reason (e.g. milk purchase)"
                    className="flex-1 min-w-40 px-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary" />
                  <button onClick={() => doMovement('in')} disabled={busy} className="flex items-center gap-1.5 px-4 py-3 bg-success/10 text-success text-[10px] font-bold uppercase tracking-normal rounded-xl border border-success/20 hover:bg-success hover:text-white disabled:opacity-50">
                    <ArrowDownCircle size={14} /> Pay in
                  </button>
                  <button onClick={() => doMovement('out')} disabled={busy} className="flex items-center gap-1.5 px-4 py-3 bg-danger/10 text-danger text-[10px] font-bold uppercase tracking-normal rounded-xl border border-danger/20 hover:bg-danger hover:text-white disabled:opacity-50">
                    <ArrowUpCircle size={14} /> Pay out
                  </button>
                </div>
                {session.movements?.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {session.movements.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] font-medium">
                        <span className="flex items-center gap-1.5 text-(--color-text-muted)">
                          {m.type === 'in' ? <Plus size={11} className="text-success" /> : <Minus size={11} className="text-danger" />}
                          {m.reason || (m.type === 'in' ? 'Pay in' : 'Pay out')}
                        </span>
                        <span className={m.type === 'in' ? 'text-success font-bold' : 'text-danger font-bold'}>{m.type === 'in' ? '+' : '-'}{money(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SlideIn>

            {/* Close */}
            <SlideIn delay={0.15}>
              <div className="glass-card p-8 rounded-xl premium-shadow space-y-4 border border-danger/20">
                <div className="flex items-center gap-2 text-danger">
                  <Lock size={18} />
                  <h2 className="text-sm font-bold">Close drawer (Z-report)</h2>
                </div>
                <p className="text-xs text-(--color-text-muted)">Count the physical cash and enter it. We&apos;ll compare it to the expected {money(live.expectedCash)}.</p>
                <div className="flex gap-3 flex-wrap">
                  <div className="relative w-40">
                    <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                    <input type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="Counted cash" min={0}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-bold text-(--color-text-primary) outline-none focus:border-primary" />
                  </div>
                  <input type="text" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Notes (optional)"
                    className="flex-1 min-w-40 px-4 py-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary" />
                  <button onClick={doClose} disabled={busy} className="px-8 py-3 bg-danger text-white text-[11px] font-bold uppercase tracking-normal rounded-xl hover:opacity-90 disabled:opacity-50">
                    Close & reconcile
                  </button>
                </div>
                {countedCash !== '' && (
                  <p className="text-xs font-bold">
                    Variance: <span className={Number(countedCash) - live.expectedCash === 0 ? 'text-success' : (Number(countedCash) - live.expectedCash > 0 ? 'text-primary' : 'text-danger')}>
                      {money(Number(countedCash) - live.expectedCash)}
                    </span>
                    <span className="text-(--color-text-muted) font-medium"> {Number(countedCash) - live.expectedCash < 0 ? '(short)' : Number(countedCash) - live.expectedCash > 0 ? '(over)' : '(balanced)'}</span>
                  </p>
                )}
              </div>
            </SlideIn>
          </>
        )}

        {/* History / Z-reports */}
        {history.length > 0 && (
          <SlideIn delay={0.2}>
            <div className="glass-card p-8 rounded-xl premium-shadow space-y-3">
              <div className="flex items-center gap-2 text-(--color-text-primary)">
                <History size={18} className="text-primary" />
                <h2 className="text-sm font-bold">Past shifts (Z-reports)</h2>
              </div>
              <div className="divide-y divide-(--color-border)">
                {history.filter((s) => s.status === 'closed').map((s) => (
                  <div key={s._id} className="py-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs font-bold text-(--color-text-primary)">{new Date(s.openedAt).toLocaleDateString('en-IN')} · {s.locationId?.name || ''}</p>
                      <p className="text-[10px] text-(--color-text-muted)">Sales {money(s.cashSales)} · Expected {money(s.expectedCash)} · Counted {money(s.countedCash)}</p>
                    </div>
                    <span className={`text-sm font-bold ${s.variance === 0 ? 'text-success' : s.variance > 0 ? 'text-primary' : 'text-danger'}`}>
                      {money(s.variance)} {s.variance < 0 ? 'short' : s.variance > 0 ? 'over' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SlideIn>
        )}
      </div>
    </PageTransition>
  );
}
