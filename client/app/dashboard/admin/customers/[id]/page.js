'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { can } from '@/app/config/actions';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { Money, Num } from '@/app/components/ui/Money';
import { Button } from '@/app/components/ui/Button';
import UniversalDateFilter from '@/app/components/ui/UniversalDateFilter';
import Modal from '@/app/components/ui/Modal';
import OrderDetailModal from '../components/OrderDetailModal';
import { runValidation, required, email as emailV, phone as phoneV, hasErrors, firstError } from '@/app/utils/validators';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ArrowLeft, Phone, Mail, Cake, Lock, Store, Award, Clock, Tag, Ticket, ShoppingBag,
  Pencil, Save, Crown, TrendingUp, Utensils, Repeat, Calendar,
} from 'lucide-react';

const maskPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return 'N/A';
  return d.length <= 4 ? d : `${'•'.repeat(d.length - 4)}${d.slice(-4)}`;
};
const monthsBetween = (from) => {
  if (!from) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / (30 * 24 * 60 * 60 * 1000)));
};
const getTier = (spend = 0) => {
  const s = Number(spend) || 0;
  if (s >= 50000) return { label: 'Platinum', cls: 'bg-secondary/10 text-secondary border-secondary/20' };
  if (s >= 20000) return { label: 'Gold', cls: 'bg-primary/10 text-primary border-primary/20' };
  if (s >= 5000) return { label: 'Silver', cls: 'bg-(--color-surface-soft) text-(--color-text-secondary) border-(--color-border)' };
  return { label: 'Bronze', cls: 'bg-success/10 text-success border-success/20' };
};

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = can(user, 'customers.modify');

  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [insights, setInsights] = useState(null);
  const [orders, setOrders] = useState({ data: [], totals: { count: 0, amount: 0 }, byDate: [] });
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', gender: '', email: '', phone: '', dob: '' });

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ins] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/insights`),
      ]);
      const cust = c.data?.data || null;
      setCustomer(cust);
      setInsights(ins.data?.data || null);
      setForm({
        name: cust?.name || '', gender: cust?.gender || '', email: cust?.email || '',
        phone: '', dob: cust?.dob ? String(cust.dob).slice(0, 10) : '',
      });
    } catch {
      toast.error('Could not load this customer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadOrders = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (range.startDate) p.append('startDate', range.startDate);
      if (range.endDate) p.append('endDate', range.endDate);
      p.append('limit', '100');
      const r = await api.get(`/customers/${id}/orders?${p.toString()}`);
      setOrders({ data: r.data?.data || [], totals: r.data?.totals || { count: 0, amount: 0 }, byDate: r.data?.byDate || [] });
    } catch {
      setOrders({ data: [], totals: { count: 0, amount: 0 }, byDate: [] });
    }
  }, [id, range.startDate, range.endDate]);

  useEffect(() => { if (id) loadCore(); }, [id, loadCore]);
  useEffect(() => { if (id) loadOrders(); }, [id, loadOrders]);

  const save = async () => {
    const errors = runValidation(form, { name: [required('Name')], email: [emailV], phone: [phoneV] });
    if (hasErrors(errors)) return toast.error(firstError(errors));
    setSaving(true);
    try {
      const body = { name: form.name, gender: form.gender || null, email: form.email };
      if (form.phone.replace(/\D/g, '').length >= 10) body.phone = form.phone;
      if (!customer?.dobLockedAt && form.dob) body.dob = form.dob;
      await api.patch(`/customers/${id}`, body);
      toast.success('Customer updated');
      setEditing(false);
      loadCore();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const topCafe = insights?.perCafe?.[0];
  const maxCafeOrders = useMemo(() => Math.max(1, ...(insights?.perCafe || []).map((c) => c.orders)), [insights]);
  const maxCat = useMemo(() => Math.max(1, ...(insights?.topCategories || []).map((c) => c.count)), [insights]);

  if (loading) return <LoadingScreen fullScreen={false} />;
  if (!customer) {
    return (
      <div className="p-10 text-center text-(--color-text-muted)">
        <p className="text-sm">Customer not found.</p>
        <button onClick={() => router.push('/dashboard/admin/customers')} className="mt-3 text-primary text-sm font-medium">← Back to customers</button>
      </div>
    );
  }

  const tier = getTier(customer.totalSpend);
  const kpis = [
    { label: 'Visits', value: <Num value={customer.visits || 0} />, icon: Repeat },
    { label: 'Lifetime spend', value: <Money value={customer.totalSpend || 0} />, icon: TrendingUp, accent: true },
    { label: 'Reward points', value: <Num value={customer.loyaltyPoints || 0} />, icon: Award },
    { label: 'Total orders', value: <Num value={insights?.totalOrders || 0} />, icon: ShoppingBag },
    { label: 'Avg gap', value: insights?.avgGapDays != null ? `${insights.avgGapDays} days` : '—', icon: Clock },
    { label: 'Discount taken', value: <Money value={insights?.discount?.total || 0} />, icon: Tag },
  ];

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
        {/* Back */}
        <button onClick={() => router.push('/dashboard/admin/customers')}
          className="inline-flex items-center gap-2 text-sm font-medium text-(--color-text-muted) hover:text-primary transition-colors">
          <ArrowLeft size={16} /> Back to customers
        </button>

        {/* Header */}
        <SlideIn>
          <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-primary text-(--color-on-primary) flex items-center justify-center text-2xl font-semibold shrink-0">
              {(customer.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">{customer.name}</h1>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${tier.cls} flex items-center gap-1`}><Crown size={11} /> {tier.label}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-(--color-text-muted)">
                <span className="flex items-center gap-1.5"><Phone size={13} /> {maskPhone(customer.phone)}</span>
                {customer.email && <span className="flex items-center gap-1.5"><Mail size={13} /> {customer.email}</span>}
                {customer.dob && <span className="flex items-center gap-1.5"><Cake size={13} /> {new Date(customer.dob).toLocaleDateString('en-IN')}{customer.dobLockedAt && <Lock size={10} />}</span>}
              </div>
              <p className="text-[11px] text-(--color-text-muted) mt-1.5 flex items-center gap-1.5">
                <Calendar size={12} /> Customer since {new Date(customer.createdAt).toLocaleDateString('en-IN')} · {monthsBetween(customer.createdAt)} month(s)
                {insights?.firstOrderAt && <> · first order {new Date(insights.firstOrderAt).toLocaleDateString('en-IN')}</>}
              </p>
            </div>
            {canEdit && (
              <Button variant="outline" icon={Pencil} className="!rounded-xl shrink-0" onClick={() => setEditing(true)}>Edit details</Button>
            )}
          </div>
        </SlideIn>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className={`rounded-2xl border p-4 shadow-sm ${k.accent ? 'bg-primary text-(--color-on-primary) border-transparent' : 'bg-(--color-surface) border-(--color-border)'}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${k.accent ? 'opacity-80' : 'text-(--color-text-muted)'}`}>
                <k.icon size={12} /> {k.label}
              </div>
              <p className={`text-xl font-bold mt-1.5 ${k.accent ? '' : 'text-(--color-text-primary)'}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Cafes + Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Where they spend */}
          <SlideIn delay={0.05}>
            <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-5 shadow-sm h-full">
              <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2 mb-3"><Store size={16} className="text-primary" /> Cafes visited</h2>
              {topCafe && (
                <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Most-visited cafe</p>
                  <p className="text-base font-bold text-(--color-text-primary) mt-0.5">{topCafe.cafeName}</p>
                  <p className="text-[11px] text-(--color-text-muted)">{topCafe.orders} visits · <Money value={topCafe.spend} /> spent</p>
                </div>
              )}
              <div className="space-y-2.5">
                {(insights?.perCafe || []).length === 0 && <p className="text-xs text-(--color-text-muted)">No cafe activity yet.</p>}
                {(insights?.perCafe || []).map((c) => (
                  <div key={c.cafeId || c.cafeName}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-(--color-text-primary) truncate">{c.cafeName}</span>
                      <span className="text-(--color-text-muted) shrink-0">{c.orders} visits · <Money value={c.spend} /></span>
                    </div>
                    <div className="h-2 rounded-full bg-(--color-surface-soft) overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.orders / maxCafeOrders) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SlideIn>

          {/* What they like */}
          <SlideIn delay={0.1}>
            <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-5 shadow-sm h-full space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2 mb-3"><Utensils size={16} className="text-primary" /> Favourite categories</h2>
                {(insights?.topCategories || []).length === 0 && <p className="text-xs text-(--color-text-muted)">Not enough data yet.</p>}
                <div className="space-y-2">
                  {(insights?.topCategories || []).map((c) => (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-(--color-text-primary)">{c.category}</span>
                        <span className="text-(--color-text-muted)">{c.count}×</span>
                      </div>
                      <div className="h-2 rounded-full bg-(--color-surface-soft) overflow-hidden">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {(insights?.topItems || []).length > 0 && (
                <div className="pt-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) mb-2">Most-ordered items</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {insights.topItems.slice(0, 8).map((it) => (
                      <span key={it.name} className="px-2.5 py-1 rounded-full bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium text-(--color-text-secondary)">
                        {it.name} <span className="text-primary font-semibold">{it.count}×</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SlideIn>
        </div>

        {/* Monthly trend + coupons/discount */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SlideIn delay={0.15}>
            <div className="lg:col-span-2 bg-(--color-surface) rounded-2xl border border-(--color-border) p-5 shadow-sm h-full">
              <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2 mb-3"><TrendingUp size={16} className="text-primary" /> Orders over time</h2>
              {(insights?.byMonth || []).length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insights.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                      <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="count" name="Orders" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-xs text-(--color-text-muted)">No orders yet.</p>}
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-5 shadow-sm h-full space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><Ticket size={16} className="text-primary" /> Coupons used</h2>
                <p className="text-2xl font-bold text-(--color-text-primary) mt-1">{insights?.coupons?.totalUsed || 0}</p>
                {(insights?.coupons?.byCoupon || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {insights.coupons.byCoupon.map((c) => (
                      <span key={c.code} className="px-2.5 py-1 rounded-full bg-success/10 text-success text-[11px] font-semibold">
                        {c.code} <span className="opacity-70">{c.count}×</span>
                      </span>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-(--color-text-muted) mt-1">No coupons used yet.</p>}
              </div>
              <div className="pt-3 border-t border-(--color-border)">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-1.5"><Tag size={12} /> Discounts</h3>
                <p className="text-lg font-bold text-(--color-text-primary) mt-1"><Money value={insights?.discount?.total || 0} /></p>
                <p className="text-[11px] text-(--color-text-muted)">across {insights?.discount?.ordersWithDiscount || 0} of {insights?.discount?.totalOrders || 0} orders</p>
              </div>
            </div>
          </SlideIn>
        </div>

        {/* Orders — clickable */}
        <SlideIn delay={0.25}>
          <div className="bg-(--color-surface) rounded-2xl border border-(--color-border) p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-(--color-text-primary) flex items-center gap-2"><ShoppingBag size={16} className="text-primary" /> Order history</h2>
              <UniversalDateFilter defaultFilter="all" onFilterChange={({ startDate, endDate }) => setRange({ startDate, endDate })} />
            </div>
            <p className="text-xs text-(--color-text-muted) mb-3">{orders.totals.count} order(s) · <Money value={orders.totals.amount} /> in this range · tap any order for full details</p>

            {orders.byDate.length > 0 && (
              <div className="h-40 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orders.byDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="count" name="Orders" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="rounded-xl border border-(--color-border) overflow-hidden">
              {orders.data.length === 0 ? (
                <p className="text-xs text-(--color-text-muted) text-center py-6">No orders in this range.</p>
              ) : (
                <div className="divide-y divide-(--color-border)">
                  {orders.data.map((o) => (
                    <button key={o._id} type="button" onClick={() => setSelectedOrder(o)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-(--color-surface-soft)/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-(--color-text-primary)">{new Date(o.createdAt).toLocaleString('en-IN')}</p>
                        <p className="text-[11px] text-(--color-text-muted) truncate">
                          {o.branch?.name || '—'} · {(o.items || []).length} item(s) · {o.paymentType || '—'}
                          {o.coupon?.code && <span className="text-success"> · {o.coupon.code}</span>}
                          {o.discountAmount > 0 && <span className="text-success"> · −<span className="tabular-nums">{o.discountAmount}</span></span>}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-(--color-text-primary) shrink-0"><Money value={o.grandTotal || o.totalAmount || 0} /></p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SlideIn>
      </div>

      {/* Order detail popup */}
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

      {/* Edit modal */}
      <Modal isOpen={editing} onClose={() => !saving && setEditing(false)} title="Edit customer" maxWidth="max-w-md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">New phone</label>
              <input value={form.phone} inputMode="numeric" placeholder={maskPhone(customer.phone)}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted) flex items-center gap-1">
                Date of birth {customer.dobLockedAt && <Lock size={10} />}
              </label>
              <input type="date" value={form.dob} disabled={!!customer.dobLockedAt}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className={`mt-1 w-full px-3 py-2.5 rounded-xl border border-(--color-border) text-sm outline-none focus:border-primary ${customer.dobLockedAt ? 'bg-(--color-bg-soft)/50 text-(--color-text-muted) cursor-not-allowed' : 'bg-(--color-bg-soft)'}`} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1 !rounded-xl" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button type="button" variant="primary" icon={Save} className="flex-1 !rounded-xl" onClick={save} loading={saving} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
