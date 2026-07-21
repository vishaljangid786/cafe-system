'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { can } from '@/app/config/actions';
import {
  Wallet, LockOpen, Lock, ArrowDownCircle, ArrowUpCircle, IndianRupee, History,
  Banknote, Coins, ShoppingBag, Receipt, RotateCcw, RefreshCcw, TrendingUp, ScrollText,
} from 'lucide-react';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';
import { displayUserName } from '@/app/utils/userDisplay';
import RowDeleteButton from '@/app/components/ui/RowDeleteButton';

export default function CashDrawerPage() {
  const { user, socket } = useAuth();
  const isBranchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState(''); // locationId for admin/super; '' for branch-scoped (implicit)
  const [current, setCurrent] = useState(null); // { session, live, entries }
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

  // `silent` skips the full-screen loader — used for realtime updates and the
  // manual refresh so a live cash event never flashes a blank loading screen.
  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!isBranchScoped && !scope) return;
    if (!silent) setLoading(true);
    try {
      const [cur, hist] = await Promise.all([
        api.get(`/cash-drawer/current${q()}`),
        api.get(`/cash-drawer${q()}`).catch(() => ({ data: { data: [] } })),
      ]);
      setCurrent(cur.data.data);
      setHistory(hist.data.data || []);
    } catch (e) {
      console.error('Could not load cash drawer');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isBranchScoped, scope, q]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refetch whenever a cash event fires for the branch on screen — a
  // cash order completing, a cash expense, a refund, or a manual pay-in/out.
  // Branch-scoped users are auto-joined to their branch room on connect; an
  // admin/super admin viewing a specific branch explicitly (re)joins that room
  // (the server validates access), since switching the global location elsewhere
  // would otherwise have left it.
  useEffect(() => {
    if (!socket) return;
    if (scope) socket.emit('join_room', `branch_${scope}`);
    const onUpdate = (payload) => {
      if (!scope || !payload?.locationId || String(payload.locationId) === String(scope)) {
        refresh({ silent: true });
      }
    };
    socket.on('cashdrawer:update', onUpdate);
    return () => socket.off('cashdrawer:update', onUpdate);
  }, [socket, scope, refresh]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refresh({ silent: true });
    setRefreshing(false);
  };

  const doOpen = async () => {
    setBusy(true);
    try {
      await api.post('/cash-drawer/open', { openingFloat: Number(openingFloat) || 0, ...(scope ? { locationId: scope } : {}) });
      toast.success('Cash drawer opened');
      setOpeningFloat('');
      refresh({ silent: true });
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
      refresh({ silent: true });
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
      toast.success(v === 0 ? 'Drawer balanced — closed' : `Closed · variance ${formatIndianCompact(v, { currency: true })}`);
      setCountedCash(''); setCloseNotes('');
      refresh({ silent: true });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not close drawer');
    } finally { setBusy(false); }
  };

  if (loading) return <LoadingScreen />;

  const live = current?.live;
  const session = current?.session;
  const entries = current?.entries || [];
  const diff = countedCash === '' ? 0 : Number(countedCash) - (live?.expectedCash || 0);
  const closedShifts = history.filter((s) => s.status === 'closed');

  const stats = session && live ? [
    { label: 'Opening float', value: session.openingFloat, icon: Coins, tone: 'neutral' },
    { label: 'Cash sales', value: live.cashSales, icon: ShoppingBag, tone: 'in' },
    { label: 'Cash expenses', value: live.cashExpenses, icon: Receipt, tone: 'out' },
    { label: 'Cash refunds', value: live.cashRefunds, icon: RotateCcw, tone: 'out' },
    { label: 'Paid in', value: live.cashIn, icon: ArrowDownCircle, tone: 'in' },
    { label: 'Paid out', value: live.cashOut, icon: ArrowUpCircle, tone: 'out' },
  ] : [];

  const inputCls = 'h-[48px] w-full rounded-xl border border-(--color-border) bg-(--color-bg-soft)/80 px-4 text-sm font-medium text-(--color-text-primary) outline-none transition-all placeholder:text-(--color-text-muted) focus:border-primary focus:bg-(--color-surface) focus:ring-2 focus:ring-primary/10';

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Hero header */}
        <SlideIn direction="down">
          <div className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-sm">
            <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Wallet size={22} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${session ? 'border-success/30 bg-success/10 text-success' : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${session ? 'bg-success animate-pulse' : 'bg-(--color-text-muted)'}`} />
                    {session ? 'Drawer open' : 'Drawer closed'}
                  </div>
                  <h1 className="text-2xl font-semibold leading-tight tracking-tight text-(--color-text-primary) sm:text-3xl">
                    Cash <span className="text-primary-dark dark:text-primary">Drawer</span>
                  </h1>
                  <p className="mt-1.5 text-sm font-medium text-(--color-text-secondary)">
                    {session
                      ? <>Opened by {displayUserName(session.openedBy, '—')} · {new Date(session.openedAt).toLocaleString('en-IN')}</>
                      : 'Open a shift to start tracking cash for this branch.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {!isBranchScoped && (
                  <div className="w-52">
                    <PremiumSelect
                      value={scope}
                      onChange={setScope}
                      options={locations.map((l) => ({ label: l.name, value: l._id }))}
                      placeholder="Select branch"
                    />
                  </div>
                )}
                <button
                  onClick={handleManualRefresh}
                  title="Refresh"
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) transition-colors hover:border-primary hover:text-primary"
                >
                  <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* No open drawer -> empty-state open form */}
        {!session && (
          <SlideIn delay={0.05}>
            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 shadow-sm">
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <LockOpen size={26} />
                </div>
                <h2 className="text-base font-semibold text-(--color-text-primary)">Open the cash drawer</h2>
                <p className="mt-1.5 text-sm text-(--color-text-muted)">Enter the starting cash float that&apos;s physically in the register to begin the shift.</p>
                <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                    <input
                      type="number" min={0} value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
                      placeholder="Opening float"
                      className="h-[52px] w-full rounded-xl border border-(--color-border) bg-(--color-bg-soft)/80 pl-11 pr-4 text-sm font-medium text-(--color-text-primary) outline-none transition-all focus:border-primary focus:bg-(--color-surface) focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  {can(user, 'cashdrawer.add') && (
                    <button onClick={doOpen} disabled={busy} className="h-[52px] shrink-0 rounded-xl bg-primary px-7 text-xs font-semibold uppercase tracking-wide text-(--color-on-primary) transition-all hover:bg-(--color-primary-hover) active:scale-95 disabled:opacity-50">
                      Open drawer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </SlideIn>
        )}

        {/* Open drawer -> stats + actions + activity */}
        {session && live && (
          <>
            <SlideIn delay={0.05}>
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Expected hero */}
                <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-primary/15 to-primary/5 p-6 shadow-sm">
                  <div className="pointer-events-none absolute -bottom-8 -right-6 text-primary opacity-10"><Banknote size={120} /></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 text-primary-dark dark:text-primary">
                      <TrendingUp size={16} />
                      <p className="text-[11px] font-semibold uppercase tracking-wide">Expected in drawer</p>
                    </div>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-(--color-text-primary)"><Money value={live.expectedCash} /></p>
                    <p className="mt-2 text-[11px] font-medium text-(--color-text-muted)">Float + sales + pay-ins − expenses, refunds &amp; pay-outs</p>
                  </div>
                </div>

                {/* Stat tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2">
                  {stats.map((s, i) => {
                    const Icon = s.icon;
                    const signed = s.tone === 'out' ? -Math.abs(s.value || 0) : (s.value || 0);
                    const valueCls = s.tone === 'in' ? 'text-success' : s.tone === 'out' ? 'text-danger' : 'text-(--color-text-primary)';
                    const chipCls = s.tone === 'in' ? 'bg-success/10 text-success' : s.tone === 'out' ? 'bg-danger/10 text-danger' : 'bg-(--color-surface-soft) text-(--color-text-muted)';
                    return (
                      <div key={i} className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm">
                        <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${chipCls}`}><Icon size={15} /></div>
                        <p className="text-[11px] font-medium text-(--color-text-muted)">{s.label}</p>
                        <p className={`mt-0.5 text-lg font-semibold tracking-tight ${valueCls}`}><Money value={signed} /></p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SlideIn>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Left: pay-in/out + close */}
              <div className="space-y-5">
                <SlideIn delay={0.1}>
                  <div className="space-y-4 rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Coins size={16} className="text-primary" />
                      <h2 className="text-sm font-semibold text-(--color-text-primary)">Cash pay-in / pay-out</h2>
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <IndianRupee size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                        <input type="number" min={0} value={moveAmount} onChange={(e) => setMoveAmount(e.target.value)} placeholder="Amount" className={`${inputCls} pl-10`} />
                      </div>
                      <input type="text" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="Reason (e.g. milk purchase)" className={inputCls} />
                      {can(user, 'cashdrawer.modify') && (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => doMovement('in')} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl border border-success/20 bg-success/10 py-3 text-xs font-semibold text-success transition-all hover:bg-success hover:text-white disabled:opacity-50">
                            <ArrowDownCircle size={15} /> Pay in
                          </button>
                          <button onClick={() => doMovement('out')} disabled={busy} className="flex items-center justify-center gap-2 rounded-xl border border-danger/20 bg-danger/10 py-3 text-xs font-semibold text-danger transition-all hover:bg-danger hover:text-white disabled:opacity-50">
                            <ArrowUpCircle size={15} /> Pay out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </SlideIn>

                <SlideIn delay={0.15}>
                  <div className="space-y-4 rounded-2xl border border-danger/20 bg-(--color-surface) p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-danger">
                      <Lock size={16} />
                      <h2 className="text-sm font-semibold">Close drawer (Z-report)</h2>
                    </div>
                    <p className="text-xs text-(--color-text-muted)">Count the physical cash and enter it. We&apos;ll compare it to the expected <span className="font-semibold text-(--color-text-secondary)"><Money value={live.expectedCash} /></span>.</p>
                    <div className="space-y-3">
                      <div className="relative">
                        <IndianRupee size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                        <input type="number" min={0} value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="Counted cash" className={`${inputCls} pl-10`} />
                      </div>
                      <input type="text" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Notes (optional)" className={inputCls} />
                      {countedCash !== '' && (
                        <div className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface-soft) px-4 py-3">
                          <span className="text-[11px] font-medium text-(--color-text-muted)">Variance</span>
                          <span className={`text-sm font-semibold ${diff === 0 ? 'text-success' : diff > 0 ? 'text-primary' : 'text-danger'}`}>
                            <Money value={diff} /> <span className="text-[11px] font-medium text-(--color-text-muted)">{diff < 0 ? '(short)' : diff > 0 ? '(over)' : '(balanced)'}</span>
                          </span>
                        </div>
                      )}
                      {can(user, 'cashdrawer.modify') && (
                        <button onClick={doClose} disabled={busy} className="w-full rounded-xl bg-danger py-3 text-xs font-semibold uppercase tracking-wide text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-50">
                          Close &amp; reconcile
                        </button>
                      )}
                    </div>
                  </div>
                </SlideIn>
              </div>

              {/* Right: realtime cash activity */}
              <SlideIn delay={0.12}>
                <div className="flex h-full flex-col rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <History size={16} className="text-primary" />
                    <h2 className="text-sm font-semibold text-(--color-text-primary)">Cash activity · this shift</h2>
                    {entries.length > 0 && <span className="ml-auto rounded-full bg-(--color-surface-soft) px-2 py-0.5 text-[10px] font-semibold text-(--color-text-muted)">{entries.length}</span>}
                  </div>
                  {entries.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-soft) text-(--color-text-muted)"><ScrollText size={22} /></div>
                      <p className="text-xs font-medium text-(--color-text-muted)">No cash movement yet this shift.</p>
                      <p className="text-[11px] text-(--color-text-soft)">Cash orders, expenses &amp; pay-ins will appear here.</p>
                    </div>
                  ) : (
                    <div className="-mr-2 max-h-112 divide-y divide-(--color-border) overflow-y-auto pr-2 custom-scrollbar">
                      {entries.map((e, i) => {
                        const isIn = e.direction === 'in';
                        return (
                          <div key={i} className="flex items-center justify-between gap-3 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIn ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                {isIn ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-(--color-text-primary)">{e.label}{e.pending ? <span className="text-warning"> · pending</span> : ''}</p>
                                <p className="text-[11px] text-(--color-text-muted)">{new Date(e.at).toLocaleString('en-IN')}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 text-sm font-semibold ${isIn ? 'text-success' : 'text-danger'}`}><Money value={e.amount} prefix={isIn ? '+' : '−'} /></span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SlideIn>
            </div>
          </>
        )}

        {/* Past shifts / Z-reports */}
        {closedShifts.length > 0 && (
          <SlideIn delay={0.2}>
            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <History size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-(--color-text-primary)">Past shifts (Z-reports)</h2>
              </div>
              <div className="divide-y divide-(--color-border)">
                {closedShifts.map((s) => (
                  <div key={s._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-(--color-text-primary)">{new Date(s.openedAt).toLocaleDateString('en-IN')} · {s.locationId?.name || ''}</p>
                      <p className="text-[11px] text-(--color-text-muted)">Sales <Money value={s.cashSales} />{s.cashExpenses ? <> · Expenses <Money value={s.cashExpenses} /></> : ''} · Expected <Money value={s.expectedCash} /> · Counted <Money value={s.countedCash} /></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${s.variance === 0 ? 'bg-success/10 text-success' : s.variance > 0 ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>
                        <Money value={s.variance} /> {s.variance < 0 ? 'short' : s.variance > 0 ? 'over' : 'balanced'}
                      </span>
                      <RowDeleteButton
                        actionKey="cashdrawer.delete"
                        endpoint={`/cash-drawer/${s._id}`}
                        label={`the ${new Date(s.openedAt).toLocaleDateString('en-IN')} shift`}
                        description="A closed shift is that day's Z-report — the record of what was counted against what was expected. Removing it leaves the day unreconciled."
                        onDeleted={refresh}
                        size={14}
                        className="p-2!"
                      />
                    </div>
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
