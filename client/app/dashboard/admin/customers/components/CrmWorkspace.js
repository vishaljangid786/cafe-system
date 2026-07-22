'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, Percent, Cake, Users, UserPlus, Repeat, RotateCcw, Wallet, ShoppingBag, AlertTriangle, Gift } from 'lucide-react';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { can } from '@/app/config/actions';
import UniversalDateFilter from '@/app/components/ui/UniversalDateFilter';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Money, Num } from '@/app/components/ui/Money';
import { StatGridSkeleton, TableSkeleton } from '@/app/components/ui/Skeleton';
import ExportActions from '@/app/components/ui/ExportActions';
import Customer360Drawer from './Customer360Drawer';
import RowDeleteButton from '@/app/components/ui/RowDeleteButton';
import DiscountSettingsModal from './DiscountSettingsModal';
import BirthdayCampaignModal from './BirthdayCampaignModal';

const maskPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return 'N/A';
  return d.length <= 4 ? d : `${'•'.repeat(d.length - 4)}${d.slice(-4)}`;
};

// Deterministic soft colour per name so a customer's avatar stays the same
// across renders — six brand-adjacent tints, no jarring random palette.
const AVATAR_TINTS = [
  'bg-primary/12 text-primary',
  'bg-success/12 text-success',
  'bg-secondary/12 text-secondary',
  'bg-(--color-amber)/12 text-(--color-amber)',
  'bg-danger/12 text-danger',
  'bg-(--color-text-muted)/12 text-(--color-text-secondary)',
];
const tintFor = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
};
const Avatar = ({ name, size = 'md' }) => {
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className={`${s} ${tintFor(name)} rounded-xl flex items-center justify-center font-bold shrink-0`}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
};

const KPI = ({ icon: Icon, label, value, tone = 'primary' }) => {
  const ring = tone === 'danger' ? 'border-danger/20' : tone === 'success' ? 'border-success/20' : 'border-(--color-border)';
  const chip = tone === 'danger' ? 'bg-danger/12 text-danger' : tone === 'success' ? 'bg-success/12 text-success' : 'bg-primary/12 text-primary';
  return (
    <div className={`group rounded-2xl border ${ring} p-4 bg-(--color-surface) shadow-sm hover:shadow-(--shadow-md) transition-shadow relative overflow-hidden`}>
      <Icon size={72} className="absolute -right-3 -bottom-3 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity" />
      <span className={`h-9 w-9 rounded-xl flex items-center justify-center ${chip}`}>
        <Icon size={16} />
      </span>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted)">{label}</p>
      <p className="mt-1 text-2xl font-bold text-(--color-text-primary) tracking-tight">{value}</p>
    </div>
  );
};

/**
 * The CRM report surface: scoped filters, KPI tiles, and the customer table with
 * per-cafe membership chips. Data scoping is enforced server-side; the cafe and
 * branch selects only narrow what the caller may already see.
 */
export default function CrmWorkspace() {
  const { user, selectedCafe, selectedLocation, locations = [], cafes = [] } = useAuth();

  const isBranchScoped = ['branch_admin', 'location_admin'].includes(user?.role);
  const canEdit = can(user, 'customers.modify');
  const canDiscount = can(user, 'customers.discount');
  const canCampaign = can(user, 'customers.campaign');
  const canExport = can(user, 'customers.export');

  // Page-level filters. Default to the global navbar selection.
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [cafeId, setCafeId] = useState(selectedCafe && selectedCafe !== 'all' ? selectedCafe : '');
  const [locationId, setLocationId] = useState(
    selectedLocation && selectedLocation !== 'all' ? (selectedLocation._id || selectedLocation) : ''
  );
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  // Full filtered set (bounded) used only for Export.
  const [exportRows, setExportRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [openCustomer, setOpenCustomer] = useState(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);

  // Follow the global navbar scope when it changes.
  useEffect(() => {
    setCafeId(selectedCafe && selectedCafe !== 'all' ? selectedCafe : '');
  }, [selectedCafe]);
  useEffect(() => {
    setLocationId(selectedLocation && selectedLocation !== 'all' ? (selectedLocation._id || selectedLocation) : '');
  }, [selectedLocation]);

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    if (range.startDate) p.append('startDate', range.startDate);
    if (range.endDate) p.append('endDate', range.endDate);
    if (locationId) p.append('locationId', locationId);
    else if (cafeId) p.append('cafeId', cafeId);
    if (status !== 'all') p.append('status', status);
    if (search.trim()) p.append('search', search.trim());
    return p;
  }, [range, cafeId, locationId, status, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = queryString();
      const reportParams = new URLSearchParams(base);
      reportParams.append('page', String(page));
      reportParams.append('limit', '20');

      // Third request builds the EXPORT dataset: same filters, whole result set
      // (bounded), so Export doesn't silently emit only the page on screen.
      const exportParams = new URLSearchParams(base);
      exportParams.append('page', '1');
      exportParams.append('limit', '1000');

      const [sumRes, repRes, expRes] = await Promise.allSettled([
        api.get(`/customers/summary?${base.toString()}`),
        api.get(`/customers/report?${reportParams.toString()}`),
        api.get(`/customers/report?${exportParams.toString()}`),
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data?.data || null);
      if (repRes.status === 'fulfilled') {
        setRows(repRes.value.data?.data || []);
        setPages(repRes.value.data?.pages || 1);
        setTotal(repRes.value.data?.total || 0);
      }
      setExportRows(expRes.status === 'fulfilled' ? (expRes.value.data?.data || []) : []);
    } finally {
      setLoading(false);
    }
  }, [queryString, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // Any filter change returns to page 1 so the user can't strand on a page that
  // no longer exists in the narrowed set.
  useEffect(() => { setPage(1); }, [range, cafeId, locationId, status, search]);

  const branchOptions = [
    { value: '', label: 'All branches' },
    ...locations
      .filter((l) => (cafeId ? String(l.cafe?._id || l.cafe) === String(cafeId) : true))
      .map((l) => ({ value: l._id, label: `${l.name}${l.city ? ` · ${l.city}` : ''}` })),
  ];

  const exportColumns = [
    { header: 'Name', key: 'name' },
    { header: 'Phone', key: 'phone' },
    { header: 'Visits', key: 'visits' },
    { header: 'Total spend', key: 'totalSpend' },
    { header: 'Cafes', key: (r) => (r.memberships || []).map((m) => m.cafe?.name).filter(Boolean).join(' | ') },
    { header: 'Last visit', key: (r) => (r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : '') },
  ];

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <UniversalDateFilter
            defaultFilter="all"
            onFilterChange={({ startDate, endDate }) => setRange({ startDate, endDate })}
          />

          {!isBranchScoped && cafes.length > 0 && (
            <div className="w-44">
              <PremiumSelect
                value={cafeId}
                onChange={(v) => { setCafeId(v); setLocationId(''); }}
                placeholder="All cafes"
                options={[{ value: '', label: 'All cafes' }, ...cafes.map((c) => ({ value: c._id, label: c.name }))]}
              />
            </div>
          )}

          <div className="w-48">
            <PremiumSelect value={locationId} onChange={setLocationId} placeholder="All branches" options={branchOptions} />
          </div>

          <div className="w-36">
            <PremiumSelect
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All customers' },
                { value: 'new', label: 'New' },
                { value: 'existing', label: 'Existing' },
              ]}
            />
          </div>

          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-(--color-surface) border border-(--color-border) text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            {canDiscount && (
              <button type="button" onClick={() => setShowDiscount(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-(--color-surface) border border-(--color-border) text-xs font-bold text-(--color-text-primary)">
                <Percent size={14} /> Discount
              </button>
            )}
            {canCampaign && (
              <button type="button" onClick={() => setShowCampaign(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-(--color-on-primary) text-xs font-bold">
                <Cake size={14} /> Birthday offers
              </button>
            )}
            {canExport && rows.length > 0 && (
              <ExportActions data={exportRows.length ? exportRows : rows} columns={exportColumns} filename={`Customers_${new Date().toISOString().slice(0, 10)}`} />
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      {loading && !summary ? (
        <StatGridSkeleton count={4} />
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPI icon={Users} label="Total customers" value={<Num value={summary.totalCustomers} />} />
          <KPI icon={UserPlus} label="New in period" value={<Num value={summary.newInRange} />} tone="success" />
          <KPI icon={Repeat} label="Repeat in period" value={<Num value={summary.repeatInRange} />} />
          <KPI icon={RotateCcw} label="Returning from earlier" value={<Num value={summary.returningFromPrevPeriod} />} />
          <KPI icon={ShoppingBag} label="Avg orders / customer" value={summary.avgOrdersPerCustomer} />
          <KPI icon={Wallet} label="Avg spend" value={<Money value={summary.avgSpend} />} />
          <KPI icon={AlertTriangle} label="At risk (30d)" value={<Num value={summary.atRisk} />} tone="danger" />
          <KPI icon={Gift} label="Birthdays this month" value={<Num value={summary.birthdaysThisMonth} />} />
        </div>
      )}

      {/* Report table */}
      <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-(--color-border) flex items-center justify-between">
          <h3 className="text-sm font-bold text-(--color-text-primary) flex items-center gap-2">
            <Users size={15} className="text-primary" /> Customers
          </h3>
          <span className="text-[11px] font-bold text-(--color-text-muted) bg-(--color-surface-soft) px-2.5 py-1 rounded-full">{total} total</span>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-(--color-text-muted)">
            <Users size={40} className="opacity-20 mb-3" />
            <p className="text-sm font-medium">No customers match these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                  {['Customer', 'Status', 'Cafes / Branches', 'Orders', 'Spend', 'Last visit', ''].map((h, i) => (
                    <th key={h || `actions-${i}`} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-(--color-text-muted) whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                {rows.map((c) => {
                  const memberships = c.memberships || [];
                  const cafeNames = [...new Set(memberships.map((m) => m.cafe?.name).filter(Boolean))];
                  // Every branch the customer is enrolled in, across their cafes.
                  const branchNames = [...new Set(
                    memberships.flatMap((m) => (m.branches || []).map((b) => b?.name || b?.city).filter(Boolean))
                  )];
                  // Fall back to the acquisition branch for customers/data with no
                  // membership branches (e.g. imported or QR-captured before an order).
                  if (branchNames.length === 0 && (c.branch?.name || c.branch?.city)) {
                    branchNames.push(c.branch.name || c.branch.city);
                  }
                  const isNew = memberships.some((m) => m.status === 'new');
                  return (
                    <tr key={c._id} onClick={() => setOpenCustomer(c._id)}
                      className="cursor-pointer hover:bg-(--color-surface-soft)/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-(--color-text-primary) truncate">{c.name}</p>
                            <p className="text-[11px] text-(--color-text-muted)">{maskPhone(c.phone)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isNew ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'
                        }`}>
                          {isNew ? 'New' : 'Existing'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cafeNames.length === 0 && branchNames.length === 0 ? (
                          <span className="text-[11px] text-(--color-text-muted)">—</span>
                        ) : (
                          <div className="space-y-1">
                            {cafeNames.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {cafeNames.map((n) => (
                                  <span key={n} className="px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-bold text-primary">{n}</span>
                                ))}
                              </div>
                            )}
                            {branchNames.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {branchNames.slice(0, 3).map((n) => (
                                  <span key={n} className="px-2 py-0.5 rounded-md bg-(--color-surface-soft) text-[10px] font-medium text-(--color-text-secondary)">{n}</span>
                                ))}
                                {branchNames.length > 3 && (
                                  <span className="text-[10px] font-bold text-(--color-text-muted)">+{branchNames.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-(--color-text-primary)"><Num value={c.visits || 0} /></td>
                      <td className="px-4 py-3 text-xs font-bold text-(--color-text-primary)"><Money value={c.totalSpend || 0} /></td>
                      <td className="px-4 py-3 text-[11px] text-(--color-text-muted) whitespace-nowrap">
                        {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <RowDeleteButton
                          actionKey="customers.delete"
                          endpoint={`/customers/${c._id}`}
                          label={c.name || 'this customer'}
                          description="A customer profile is shared across cafes. Unless you are a Super Admin this removes only your cafe's membership — their orders are kept either way."
                          onDeleted={load}
                          size={15}
                          className="p-2!"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-(--color-border)">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-(--color-surface-soft) text-xs font-bold text-(--color-text-primary) disabled:opacity-40">
              Previous
            </button>
            <span className="text-xs text-(--color-text-muted)">Page {page} of {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-(--color-surface-soft) text-xs font-bold text-(--color-text-primary) disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>

      {openCustomer && (
        <Customer360Drawer
          customerId={openCustomer}
          canEdit={canEdit}
          onClose={() => setOpenCustomer(null)}
          onSaved={load}
        />
      )}
      <DiscountSettingsModal isOpen={showDiscount} onClose={() => setShowDiscount(false)} cafes={cafes} branches={locations} />
      <BirthdayCampaignModal isOpen={showCampaign} onClose={() => setShowCampaign(false)} cafes={cafes} branches={locations} />
    </div>
  );
}
