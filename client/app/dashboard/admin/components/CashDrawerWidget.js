'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { motion } from 'framer-motion';
import {
  Wallet, RefreshCcw, TrendingUp, Coins, ShoppingBag, Receipt, RotateCcw,
  ArrowDownCircle, ArrowUpCircle, History as HistoryIcon, ScrollText, ArrowUpRight,
} from 'lucide-react';
import { Money } from '../../../components/ui/Money';
import { formatIndianCompact } from '../../../utils/formatNumber';

// Overview cash-drawer widget: a READ-ONLY live summary of a branch's register plus
// its last 10 shifts (Z-reports). Admins/super admins pick a branch (defaulting to
// the global branch filter); branch-scoped roles see their own branch implicitly.
// All write actions (open / close / pay-in-out) live on the full Cash Drawer page,
// reachable via the "Manage" link.
export default function CashDrawerWidget() {
  const { user, selectedLocation, socket } = useAuth();
  const isBranchScoped = ['staff', 'chef', 'branch_admin', 'location_admin'].includes(user?.role);
  const manageHref = user?.role === 'staff' ? '/dashboard/staff/cash-drawer' : '/dashboard/admin/cash-drawer';

  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState('');
  const [current, setCurrent] = useState(null); // { session, live, entries } | null
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admins pick a branch; branch-scoped roles are implicit (server uses their branch).
  useEffect(() => {
    if (!user) return;
    if (isBranchScoped) { setScope(''); return; }
    api.get('/locations')
      .then((res) => {
        const locs = res.data?.data || res.data || [];
        setLocations(locs);
        const globalId = selectedLocation ? (selectedLocation._id || selectedLocation) : '';
        setScope((globalId && locs.some((l) => l._id === globalId)) ? globalId : (locs[0]?._id || ''));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isBranchScoped]);

  // Follow the global branch filter whenever it points at an accessible branch.
  useEffect(() => {
    if (isBranchScoped || locations.length === 0) return;
    const globalId = selectedLocation ? (selectedLocation._id || selectedLocation) : '';
    if (globalId && locations.some((l) => l._id === globalId)) setScope(globalId);
  }, [selectedLocation, locations, isBranchScoped]);

  const q = useCallback((extra = '') => {
    const parts = [];
    if (scope) parts.push(`locationId=${scope}`);
    if (extra) parts.push(extra);
    return parts.length ? `?${parts.join('&')}` : '';
  }, [scope]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!isBranchScoped && !scope) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [cur, hist] = await Promise.all([
        api.get(`/cash-drawer/current${q()}`).catch(() => ({ data: { data: null } })),
        api.get(`/cash-drawer${q('limit=10')}`).catch(() => ({ data: { data: [] } })),
      ]);
      setCurrent(cur.data?.data || null);
      setHistory(hist.data?.data || []);
    } catch {
      /* keep last good data on transient errors */
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isBranchScoped, scope, q]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refetch when a cash event fires for the branch currently on screen.
  useEffect(() => {
    if (!socket) return;
    if (scope) socket.emit('join_room', `branch_${scope}`);
    const onUpdate = (payload) => {
      if (!scope || !payload?.locationId || String(payload.locationId) === String(scope)) refresh({ silent: true });
    };
    socket.on('cashdrawer:update', onUpdate);
    return () => socket.off('cashdrawer:update', onUpdate);
  }, [socket, scope, refresh]);

  const handleRefresh = async () => { setRefreshing(true); await refresh({ silent: true }); setRefreshing(false); };

  const live = current?.live;
  const session = current?.session;
  const last10 = (history || []).slice(0, 10);

  const stats = session && live ? [
    { label: 'Float', value: session.openingFloat, icon: Coins, tone: 'neutral' },
    { label: 'Sales', value: live.cashSales, icon: ShoppingBag, tone: 'in' },
    { label: 'Expenses', value: live.cashExpenses, icon: Receipt, tone: 'out' },
    { label: 'Refunds', value: live.cashRefunds, icon: RotateCcw, tone: 'out' },
    { label: 'Paid in', value: live.cashIn, icon: ArrowDownCircle, tone: 'in' },
    { label: 'Paid out', value: live.cashOut, icon: ArrowUpCircle, tone: 'out' },
  ] : [];

  return (
    <Card className="!p-5 bg-(--color-surface)/20 border-(--color-border)" hover={false}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Wallet size={20} />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Cash Drawer</CardTitle>
            <CardDescription>Live register &amp; last 10 shifts.</CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!isBranchScoped && locations.length > 0 && (
            <div className="w-44">
              <PremiumSelect
                value={scope}
                onChange={setScope}
                options={locations.map((l) => ({ label: l.name, value: l._id }))}
                placeholder="Select branch"
              />
            </div>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${session ? 'border-success/30 bg-success/10 text-success' : 'border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${session ? 'bg-success animate-pulse' : 'bg-(--color-text-muted)'}`} />
            {session ? 'Open' : 'Closed'}
          </span>
          <button
            onClick={handleRefresh}
            title="Refresh"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) transition-colors hover:border-primary hover:text-primary"
          >
            <RefreshCcw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-44 rounded-2xl bg-(--color-surface-soft)/40 animate-pulse" />
          <div className="h-44 rounded-2xl bg-(--color-surface-soft)/40 animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left: live summary or closed state */}
          {session && live ? (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-primary/15 to-primary/5 p-5">
                <div className="pointer-events-none absolute -bottom-6 -right-4 text-primary opacity-10"><Wallet size={96} /></div>
                <div className="relative">
                  <div className="flex items-center gap-2 text-primary-dark dark:text-primary">
                    <TrendingUp size={15} />
                    <p className="text-[11px] font-semibold uppercase tracking-wide">Expected in drawer</p>
                  </div>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-(--color-text-primary)"><Money value={live.expectedCash} /></p>
                  <p className="mt-1.5 text-[11px] font-medium text-(--color-text-muted)">
                    Opened by {session.openedBy?.name || '—'} · {new Date(session.openedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((s, i) => {
                  const Icon = s.icon;
                  const valueCls = s.tone === 'in' ? 'text-success' : s.tone === 'out' ? 'text-danger' : 'text-(--color-text-primary)';
                  return (
                    <div key={i} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-(--color-text-muted)">
                        <Icon size={12} />
                        <p className="text-[10px] font-medium uppercase tracking-wide">{s.label}</p>
                      </div>
                      <p className={`text-sm font-semibold tracking-tight ${valueCls}`}><Money value={s.value} /></p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--color-border) bg-(--color-surface-soft)/30 p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-soft) text-(--color-text-muted)">
                <Wallet size={22} />
              </div>
              <p className="text-sm font-semibold text-(--color-text-primary)">No open drawer</p>
              <p className="mt-1 text-xs text-(--color-text-muted)">
                {isBranchScoped || scope ? 'Open a shift to start tracking cash for this branch.' : 'Select a branch to view its cash drawer.'}
              </p>
              <Link href={manageHref} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-(--color-on-primary) transition-all hover:bg-(--color-primary-hover) active:scale-95">
                Manage Drawer <ArrowUpRight size={13} />
              </Link>
            </div>
          )}

          {/* Right: last 10 shifts */}
          <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4">
            <div className="mb-3 flex items-center gap-2">
              <HistoryIcon size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-(--color-text-primary)">Last 10 shifts</h3>
              {last10.length > 0 && <span className="ml-auto rounded-full bg-(--color-surface-soft) px-2 py-0.5 text-[10px] font-semibold text-(--color-text-muted)">{last10.length}</span>}
            </div>
            {last10.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-(--color-surface-soft) text-(--color-text-muted)"><ScrollText size={20} /></div>
                <p className="text-xs font-medium text-(--color-text-muted)">No shifts recorded yet.</p>
              </div>
            ) : (
              <div className="-mr-1.5 max-h-64 divide-y divide-(--color-border) overflow-y-auto pr-1.5 custom-scrollbar">
                {last10.map((s, idx) => {
                  const open = s.status === 'open';
                  const variance = Number(s.variance || 0);
                  return (
                    <motion.div
                      key={s._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-(--color-text-primary)">
                          {new Date(s.openedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          {s.locationId?.name ? <span className="text-(--color-text-muted)"> · {s.locationId.name}</span> : ''}
                        </p>
                        <p className="text-[11px] text-(--color-text-muted)">
                          {open ? 'In progress' : `Counted ${formatIndianCompact(s.countedCash, { currency: true })} · Expected ${formatIndianCompact(s.expectedCash, { currency: true })}`}
                        </p>
                      </div>
                      {open ? (
                        <span className="shrink-0 rounded-lg bg-success/10 px-2 py-1 text-[10px] font-semibold uppercase text-success">Open</span>
                      ) : (
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${variance === 0 ? 'bg-success/10 text-success' : variance > 0 ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger'}`}>
                          <Money value={variance} /> {variance < 0 ? 'short' : variance > 0 ? 'over' : ''}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
            <Link href={manageHref} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-(--color-border) bg-(--color-surface-soft)/40 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted) transition-colors hover:border-primary hover:text-primary">
              Manage Drawer <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
