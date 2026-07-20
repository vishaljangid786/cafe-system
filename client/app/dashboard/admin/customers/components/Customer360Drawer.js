'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, Phone, Mail, Cake, Lock, Store, Pencil, Save } from 'lucide-react';
import api from '@/app/services/api';
import { Money, Num } from '@/app/components/ui/Money';
import UniversalDateFilter from '@/app/components/ui/UniversalDateFilter';
import { Button } from '@/app/components/ui/Button';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const maskPhone = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return 'N/A';
  return d.length <= 4 ? d : `${'•'.repeat(d.length - 4)}${d.slice(-4)}`;
};

const monthsBetween = (from) => {
  if (!from) return 0;
  const ms = Date.now() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / (30 * 24 * 60 * 60 * 1000)));
};

/**
 * Customer 360: identity, per-cafe memberships, and their orders with an
 * INDEPENDENT date filter (separate from the page-level one, by design).
 */
export default function Customer360Drawer({ customerId, onClose, canEdit, onSaved }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState({ data: [], totals: { count: 0, amount: 0 }, byDate: [] });
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', gender: '', email: '', phone: '', dob: '' });

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/customers/${customerId}`);
      const c = r.data?.data || null;
      setCustomer(c);
      setForm({
        name: c?.name || '',
        gender: c?.gender || '',
        email: c?.email || '',
        phone: '',
        dob: c?.dob ? String(c.dob).slice(0, 10) : '',
      });
    } catch {
      toast.error('Could not load this customer');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const loadOrders = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (range.startDate) p.append('startDate', range.startDate);
      if (range.endDate) p.append('endDate', range.endDate);
      const r = await api.get(`/customers/${customerId}/orders?${p.toString()}`);
      setOrders({
        data: r.data?.data || [],
        totals: r.data?.totals || { count: 0, amount: 0 },
        byDate: r.data?.byDate || [],
      });
    } catch {
      setOrders({ data: [], totals: { count: 0, amount: 0 }, byDate: [] });
    }
  }, [customerId, range.startDate, range.endDate]);

  useEffect(() => { if (customerId) loadCustomer(); }, [customerId, loadCustomer]);
  useEffect(() => { if (customerId) loadOrders(); }, [customerId, loadOrders]);

  const save = async () => {
    setSaving(true);
    try {
      const body = { name: form.name, gender: form.gender || null, email: form.email };
      if (form.phone.replace(/\D/g, '').length >= 10) body.phone = form.phone;
      if (!customer?.dobLockedAt && form.dob) body.dob = form.dob;
      await api.patch(`/customers/${customerId}`, body);
      toast.success('Customer updated');
      setEditing(false);
      loadCustomer();
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-(--color-surface) overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-(--color-surface) border-b border-(--color-border) px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-(--color-text-primary) truncate">
              {loading ? 'Loading…' : customer?.name || 'Customer'}
            </h2>
            {customer && (
              <p className="text-xs text-(--color-text-muted) mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1"><Phone size={12} /> {maskPhone(customer.phone)}</span>
                {customer.email && <span className="flex items-center gap-1"><Mail size={12} /> {customer.email}</span>}
                {customer.dob && (
                  <span className="flex items-center gap-1">
                    <Cake size={12} /> {new Date(customer.dob).toLocaleDateString()}
                    {customer.dobLockedAt && <Lock size={10} className="text-(--color-text-muted)" />}
                  </span>
                )}
              </p>
            )}
            {customer && (
              <p className="text-[11px] text-(--color-text-muted) mt-1">
                Customer since {new Date(customer.createdAt).toLocaleDateString()} · active for {monthsBetween(customer.createdAt)} month(s)
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-(--color-surface-soft)">
            <X size={18} className="text-(--color-text-muted)" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Lifetime */}
          {customer && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Visits', value: <Num value={customer.visits || 0} /> },
                { label: 'Lifetime spend', value: <Money value={customer.totalSpend || 0} /> },
                { label: 'Points', value: <Num value={customer.loyaltyPoints || 0} /> },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">{s.label}</p>
                  <p className="text-lg font-bold text-(--color-text-primary) mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Memberships — the "how many cafes" view */}
          {customer?.memberships?.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted) mb-2">Cafes</h3>
              <div className="space-y-2">
                {customer.memberships.map((m, i) => (
                  <div key={i} className="p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-(--color-text-primary) flex items-center gap-1.5 truncate">
                        <Store size={13} className="text-primary" /> {m.cafe?.name || 'Cafe'}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.status === 'new' ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'
                      }`}>
                        {m.status === 'new' ? 'New' : 'Existing'}
                      </span>
                    </div>
                    <p className="text-[11px] text-(--color-text-muted) mt-1">
                      {m.orderCount || 0} orders · <Money value={m.totalSpend || 0} /> · joined {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}
                    </p>
                    <p className="text-[11px] text-(--color-text-muted) mt-0.5">
                      Branches: {(m.branches || []).map((b) => b?.name).filter(Boolean).join(', ') || '—'}
                    </p>
                    {!m.newCustomerDiscountUsed && (
                      <p className="text-[11px] font-bold text-success mt-1">Intro discount still available</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders — own, independent date filter */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-(--color-text-muted)">Orders</h3>
              <UniversalDateFilter
                defaultFilter="all"
                onFilterChange={({ startDate, endDate }) => setRange({ startDate, endDate })}
              />
            </div>
            <p className="text-xs text-(--color-text-muted) mb-2">
              {orders.totals.count} order(s) · <Money value={orders.totals.amount} /> in this range
            </p>

            {orders.byDate.length > 0 && (
              <div className="h-40 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orders.byDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--color-text-muted)" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="rounded-xl border border-(--color-border) overflow-hidden">
              {orders.data.length === 0 ? (
                <p className="text-xs text-(--color-text-muted) text-center py-6">No orders in this range.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-(--color-border)">
                  {orders.data.map((o) => (
                    <div key={o._id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-(--color-text-primary)">
                          {new Date(o.createdAt).toLocaleString()}
                        </p>
                        <p className="text-[11px] text-(--color-text-muted) truncate">
                          {o.branch?.name || '—'} · {(o.items || []).length} item(s) · {o.paymentType || '—'}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-(--color-text-primary) shrink-0">
                        <Money value={o.grandTotal || o.totalAmount || 0} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Edit */}
          {canEdit && customer && (
            <div className="pt-2 border-t border-(--color-border)">
              {!editing ? (
                <Button type="button" variant="outline" icon={Pencil} className="!rounded-xl" onClick={() => setEditing(true)}>
                  Edit details
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Name</label>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">New phone</label>
                      <input value={form.phone} inputMode="numeric"
                        placeholder={maskPhone(customer.phone)}
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
                        className={`mt-1 w-full px-3 py-2.5 rounded-xl border border-(--color-border) text-sm outline-none focus:border-primary ${
                          customer.dobLockedAt ? 'bg-(--color-bg-soft)/50 text-(--color-text-muted) cursor-not-allowed' : 'bg-(--color-bg-soft)'
                        }`} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="!rounded-xl" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button type="button" variant="primary" icon={Save} disabled={saving} className="!rounded-xl" onClick={save}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
