'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import {
  ArrowLeft, ShoppingBag, IndianRupee, Ticket, CalendarCheck,
  User as UserIcon, Phone, Mail, MapPin, FilterX, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PremiumSelect from './ui/PremiumSelect';

const amountOf = (o) => Number(o.grandTotal ?? o.totalAmount ?? 0);
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const ORDER_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];

function Stat({ icon: Icon, label, value, sub, tone = 'primary' }) {
  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-5">
      <div className="flex items-center gap-2 text-(--color-text-muted)">
        <Icon size={14} className={`text-${tone}`} />
        <span className="text-[10px] font-bold uppercase tracking-normal">{label}</span>
      </div>
      <p className="text-2xl font-bold text-(--color-text-primary) mt-2">{value}</p>
      {sub && <p className="text-[10px] text-(--color-text-muted) mt-1">{sub}</p>}
    </div>
  );
}

export default function StaffDetailReport({ staffId, user }) {
  const router = useRouter();
  const basePath = user?.role === 'branch_admin' ? '/dashboard/branch-admin'
    : user?.role === 'location_admin' ? '/dashboard/location-admin' : '/dashboard/admin';

  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '' });
  const [page, setPage] = useState(1);
  const perPage = 15;

  // Staff profile (once).
  useEffect(() => {
    if (!staffId) return;
    api.get(`/users/${staffId}`)
      .then((r) => setStaff(r.data?.data || null))
      .catch(() => toast.error('Could not load this staff member'));
  }, [staffId]);

  // Orders (looped for an accurate summary) + reservations, on filter change.
  useEffect(() => {
    if (!staffId) return;
    let ignore = false;
    const load = async () => {
      setLoading(true); progress.start();
      try {
        const params = new URLSearchParams({ createdBy: staffId, limit: '100' });
        if (filters.startDate) params.set('startDate', filters.startDate);
        if (filters.endDate) params.set('endDate', filters.endDate);
        if (filters.status) params.set('status', filters.status);

        const all = [];
        let p = 1, pages = 1;
        do {
          params.set('page', String(p));
          const res = await api.get(`/orders?${params.toString()}`);
          all.push(...(res.data?.data || []));
          pages = res.data?.pagination?.pages || 1;
          p += 1;
        } while (p <= pages && p <= 20); // hard cap: 2000 orders

        let resv = [];
        try {
          const rr = await api.get(`/reservations?createdBy=${staffId}&limit=100`);
          resv = (rr.data?.data || []).filter((r) => String(r.userId?._id || r.userId) === String(staffId));
        } catch (e) { /* reservation filter may need a backend deploy — degrade gracefully */ }

        if (!ignore) { setOrders(all); setReservations(resv); setPage(1); }
      } catch (e) {
        if (!ignore) toast.error('Could not load this staff member’s activity');
      } finally {
        if (!ignore) { setLoading(false); progress.done(); }
      }
    };
    load();
    return () => { ignore = true; };
  }, [staffId, filters]);

  const summary = useMemo(() => {
    const sales = orders.reduce((s, o) => s + amountOf(o), 0);
    const couponOrders = orders.filter((o) => o.coupon || Number(o.discountAmount) > 0);
    const totalDiscount = orders.reduce((s, o) => s + Number(o.discountAmount || 0), 0);
    return {
      orders: orders.length,
      sales,
      avg: orders.length ? sales / orders.length : 0,
      couponsUsed: couponOrders.length,
      totalDiscount,
      reservations: reservations.length,
    };
  }, [orders, reservations]);

  // Coupons the staff applied, grouped by code.
  const couponUsage = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      if (!o.coupon && !(Number(o.discountAmount) > 0)) return;
      const code = o.coupon?.code || 'Manual discount';
      map[code] = map[code] || { code, count: 0, discount: 0 };
      map[code].count += 1;
      map[code].discount += Number(o.discountAmount || 0);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [orders]);

  const pagedOrders = orders.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(orders.length / perPage));
  const hasFilters = filters.startDate || filters.endDate || filters.status;

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary';

  if (loading && !staff) return <LoadingScreen fullScreen={false} />;

  return (
    <div className="max-w-360 mx-auto pb-20 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`${basePath}/staff-reports`)} className="p-2.5 rounded-xl border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:text-primary transition-all">
            <ArrowLeft size={18} />
          </button>
          <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl overflow-hidden shrink-0">
            {staff?.profileImageUrl ? <img src={staff.profileImageUrl} alt={staff.name} className="h-full w-full object-cover" /> : (staff?.name?.charAt(0) || '?')}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-(--color-text-primary) tracking-tight truncate">{staff?.name || 'Staff Member'}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] font-medium text-(--color-text-muted)">
              {staff?.role && <span className="inline-flex items-center gap-1 uppercase tracking-wide"><ShieldCheck size={12} /> {String(staff.role).replace('_', ' ')}</span>}
              {(staff?.assignedLocation?.name || staff?.assignedLocation?.city) && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {staff.assignedLocation.name || staff.assignedLocation.city}</span>}
              {staff?.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {staff.phone}</span>}
              {staff?.email && <span className="inline-flex items-center gap-1 truncate"><Mail size={12} /> {staff.email}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Stat icon={ShoppingBag} label="Orders" value={summary.orders} sub={hasFilters ? 'in selected range' : 'all time'} />
        <Stat icon={IndianRupee} label="Total Sales" value={inr(summary.sales)} sub={`Avg ${inr(summary.avg)}`} />
        <Stat icon={Ticket} label="Coupons Used" value={summary.couponsUsed} sub={`${inr(summary.totalDiscount)} discount`} tone="warning" />
        <Stat icon={CalendarCheck} label="Reservations" value={summary.reservations} sub="created by them" />
        <Stat icon={UserIcon} label="Avg Order Value" value={inr(summary.avg)} sub={`${summary.orders} orders`} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase text-(--color-text-muted) ml-1">From</label>
          <input type="date" className={inputCls} value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase text-(--color-text-muted) ml-1">To</label>
          <input type="date" className={inputCls} value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="flex-1">
          <PremiumSelect
            label="Status"
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[{ label: 'All Statuses', value: '' }, ...ORDER_STATUSES.map((s) => ({ label: s, value: s }))]}
          />
        </div>
        {hasFilters && (
          <button onClick={() => setFilters({ startDate: '', endDate: '', status: '' })} className="px-4 py-2.5 rounded-xl border border-(--color-border) text-(--color-text-muted) hover:text-danger hover:border-danger/40 text-xs font-bold inline-flex items-center gap-2">
            <FilterX size={15} /> Clear
          </button>
        )}
      </div>

      {/* Coupons used */}
      {couponUsage.length > 0 && (
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-5">
          <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2 mb-4"><Ticket size={14} className="text-warning" /> Coupons Used</h3>
          <div className="flex flex-wrap gap-2">
            {couponUsage.map((c) => (
              <div key={c.code} className="px-3 py-2 rounded-xl bg-warning/10 border border-warning/20 text-[11px] font-bold text-warning">
                {c.code} <span className="opacity-70">×{c.count}</span>{c.discount > 0 && <span className="text-(--color-text-muted) ml-1">({inr(c.discount)})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
        <div className="px-5 py-4 border-b border-(--color-border) flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><ShoppingBag size={14} className="text-primary" /> Orders ({summary.orders})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                <th className="py-3 px-5">Order</th>
                <th className="py-3 px-5">Date / Time</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Items</th>
                <th className="py-3 px-5">Coupon</th>
                <th className="py-3 px-5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)/50">
              {pagedOrders.map((o) => (
                <tr key={o._id} className="hover:bg-(--color-surface-soft)/30">
                  <td className="py-3 px-5 text-[11px] font-bold text-primary">#{o._id.slice(-6).toUpperCase()}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-secondary)">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-5"><span className="text-[10px] font-bold uppercase">{o.status}</span></td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted) max-w-60 truncate">{(o.items || []).map((i) => `${i.quantity}x ${i.menuItem?.name || i.itemName || 'Item'}`).join(', ')}</td>
                  <td className="py-3 px-5 text-[11px] font-semibold text-warning">{o.coupon?.code || (Number(o.discountAmount) > 0 ? `−${inr(o.discountAmount)}` : '—')}</td>
                  <td className="py-3 px-5 text-right text-sm font-bold text-(--color-text-primary)">{inr(amountOf(o))}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-(--color-text-muted) italic">No orders for this staff member{hasFilters ? ' in the selected range' : ''}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-(--color-border) flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-(--color-text-muted)">Page {page} / {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-4 py-2 rounded-lg border border-(--color-border) text-[10px] font-bold uppercase disabled:opacity-30">Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-4 py-2 rounded-lg border border-(--color-border) text-[10px] font-bold uppercase disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Reservations */}
      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
        <div className="px-5 py-4 border-b border-(--color-border)">
          <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2"><CalendarCheck size={14} className="text-primary" /> Reservations ({reservations.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/40 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                <th className="py-3 px-5">Event</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Time</th>
                <th className="py-3 px-5">Branch</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)/50">
              {reservations.map((r) => (
                <tr key={r._id} className="hover:bg-(--color-surface-soft)/30">
                  <td className="py-3 px-5 text-[11px] font-semibold text-(--color-text-primary)">{r.eventName || '—'}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-secondary)">{r.customerName || '—'}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{r.startTime}{r.endTime ? `–${r.endTime}` : ''}</td>
                  <td className="py-3 px-5 text-[11px] text-(--color-text-muted)">{r.locationId?.name || '—'}</td>
                  <td className="py-3 px-5 text-[10px] font-bold uppercase">{r.status}</td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-(--color-text-muted) italic">No reservations created by this staff member.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
