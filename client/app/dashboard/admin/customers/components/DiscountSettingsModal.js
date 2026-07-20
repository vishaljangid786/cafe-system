'use client';
import { useState, useEffect, useCallback } from 'react';
import { Percent, Save } from 'lucide-react';
import api from '@/app/services/api';
import Modal from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';

const LEVEL_LABEL = {
  default: 'Global default',
  global: 'Organisation default',
  cafe: 'This cafe',
  branch: 'This branch',
};

/**
 * Edits the `crm` settings group at the cafe or branch tier. The effective values
 * come from the DEFAULTS < global < cafe < branch chain, and the server reports
 * which tier supplied them so we can show an inheritance hint.
 */
export default function DiscountSettingsModal({ isOpen, onClose, cafes = [], branches = [] }) {
  const { user } = useAuth();
  // A branch/location admin can only ever write their own branch — the cafe tier
  // is rejected server-side for them, so don't offer it.
  const canWriteCafe = ['super_admin', 'admin'].includes(user?.role);

  const [scope, setScope] = useState(canWriteCafe ? 'cafe' : 'branch');
  const [cafeId, setCafeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [level, setLevel] = useState('default');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    newCustomerDiscountEnabled: true,
    newCustomerDiscountPercent: 20,
    newCustomerMaxDiscount: '',
    newCustomerMinOrder: 0,
    askProfileOnScan: true,
    profileRequired: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scope === 'cafe' && cafeId) params.append('cafeId', cafeId);
      if (scope === 'branch' && locationId) params.append('locationId', locationId);
      const r = await api.get(`/customers/discount-config?${params.toString()}`);
      const d = r.data?.data || {};
      setLevel(d.level || 'default');
      setForm({
        newCustomerDiscountEnabled: d.crm?.newCustomerDiscountEnabled !== false,
        newCustomerDiscountPercent: d.crm?.newCustomerDiscountPercent ?? 20,
        newCustomerMaxDiscount: d.crm?.newCustomerMaxDiscount ?? '',
        newCustomerMinOrder: d.crm?.newCustomerMinOrder ?? 0,
        askProfileOnScan: d.crm?.askProfileOnScan !== false,
        profileRequired: d.crm?.profileRequired === true,
      });
    } catch {
      toast.error('Could not load the current settings');
    } finally {
      setLoading(false);
    }
  }, [scope, cafeId, locationId]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const save = async () => {
    if (scope === 'cafe' && !cafeId) return toast.error('Choose a cafe');
    if (scope === 'branch' && !locationId) return toast.error('Choose a branch');
    setSaving(true);
    try {
      await api.put('/customers/discount-config', {
        cafeId: scope === 'cafe' ? cafeId : undefined,
        locationId: scope === 'branch' ? locationId : undefined,
        crm: {
          ...form,
          newCustomerDiscountPercent: Number(form.newCustomerDiscountPercent) || 0,
          newCustomerMinOrder: Number(form.newCustomerMinOrder) || 0,
          // Empty means "no cap" — send null rather than 0, which would cap at ₹0.
          newCustomerMaxDiscount: form.newCustomerMaxDiscount === '' ? null : Number(form.newCustomerMaxDiscount),
        },
      });
      toast.success('Discount settings saved');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save the settings');
    } finally {
      setSaving(false);
    }
  };

  const branchOptions = branches
    .filter((b) => (scope === 'branch' && cafeId ? String(b.cafe?._id || b.cafe) === String(cafeId) : true))
    .map((b) => ({ value: b._id, label: `${b.name}${b.city ? ` · ${b.city}` : ''}` }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New-customer discount" maxWidth="max-w-lg">
      <div className="space-y-5">
        <p className="text-xs text-(--color-text-muted)">
          Applied automatically on a customer&apos;s first order at a cafe — once per customer, per cafe.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {canWriteCafe && (
            <button
              type="button"
              onClick={() => setScope('cafe')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
                scope === 'cafe' ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'
              }`}
            >
              Cafe-wide
            </button>
          )}
          <button
            type="button"
            onClick={() => setScope('branch')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
              scope === 'branch' ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'
            } ${canWriteCafe ? '' : 'col-span-2'}`}
          >
            Specific branch
          </button>
        </div>

        {scope === 'cafe' ? (
          <PremiumSelect
            label="Cafe"
            placeholder="Select cafe"
            value={cafeId}
            onChange={setCafeId}
            options={cafes.map((c) => ({ value: c._id, label: c.name }))}
          />
        ) : (
          <PremiumSelect
            label="Branch"
            placeholder="Select branch"
            value={locationId}
            onChange={setLocationId}
            options={branchOptions}
          />
        )}

        <p className="text-[11px] text-(--color-text-muted) bg-(--color-surface-soft) rounded-lg px-3 py-2">
          Currently inherited from: <span className="font-bold text-(--color-text-primary)">{LEVEL_LABEL[level] || level}</span>
        </p>

        <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-(--color-text-primary)">Offer a new-customer discount</span>
            <input
              type="checkbox"
              checked={form.newCustomerDiscountEnabled}
              onChange={(e) => setForm({ ...form, newCustomerDiscountEnabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Discount %</label>
              <div className="relative mt-1">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={14} />
                <input
                  type="number" min="0" max="100"
                  value={form.newCustomerDiscountPercent}
                  onChange={(e) => setForm({ ...form, newCustomerDiscountPercent: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Max discount (₹)</label>
              <input
                type="number" min="0"
                placeholder="No cap"
                value={form.newCustomerMaxDiscount}
                onChange={(e) => setForm({ ...form, newCustomerMaxDiscount: e.target.value })}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Minimum order (₹)</label>
            <input
              type="number" min="0"
              value={form.newCustomerMinOrder}
              onChange={(e) => setForm({ ...form, newCustomerMinOrder: e.target.value })}
              className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="pt-2 border-t border-(--color-border) space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-(--color-text-primary)">Ask for details on QR scan</span>
              <input
                type="checkbox"
                checked={form.askProfileOnScan}
                onChange={(e) => setForm({ ...form, askProfileOnScan: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-(--color-text-primary)">Make it mandatory (no Skip)</span>
              <input
                type="checkbox"
                checked={form.profileRequired}
                onChange={(e) => setForm({ ...form, profileRequired: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 !rounded-xl" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" icon={Save} disabled={saving} className="flex-1 !rounded-xl" onClick={save}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
