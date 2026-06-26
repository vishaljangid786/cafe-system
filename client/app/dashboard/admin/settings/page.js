'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { Settings as SettingsIcon, Save, Percent, Receipt, Users, Clock, Building2 } from 'lucide-react';

const TABS = [
  { key: 'tax', label: 'Tax (GST)', icon: Percent },
  { key: 'billing', label: 'Billing', icon: Receipt },
  { key: 'payroll', label: 'Payroll & Attendance', icon: Clock },
  { key: 'loyalty', label: 'Loyalty', icon: Users },
  { key: 'invoice', label: 'Invoice', icon: Receipt },
  { key: 'general', label: 'General', icon: Building2 },
];

// [group, key, label, type, hint]
const FIELDS = {
  tax: [
    ['tax', 'gstRate', 'GST rate (%)', 'number', '5 / 12 / 18'],
    ['tax', 'gstin', 'GSTIN (for invoices)', 'text', 'Fallback only — receipts use the cafe’s GSTIN when set (edit it on the Cafes page)'],
  ],
  billing: [
    ['billing', 'serviceChargeRate', 'Service charge (%)', 'number', '0 to disable'],
    ['billing', 'roundBill', 'Round final bill to nearest rupee', 'checkbox', ''],
  ],
  payroll: [
    ['payroll', 'shiftStart', 'Shift start (HH:mm)', 'text', 'e.g. 09:00'],
    ['payroll', 'graceMinutes', 'Late grace (minutes)', 'number', ''],
    ['payroll', 'standardDayMinutes', 'Standard work day (minutes)', 'number', '480 = 8h'],
    ['payroll', 'overtimeMultiplier', 'Overtime pay multiplier', 'number', '1.5 = time-and-a-half'],
    ['payroll', 'latePenaltyGroup', 'Late marks per penalty', 'number', 'e.g. 3'],
    ['payroll', 'latePenaltyDayUnit', 'Days deducted per penalty', 'number', '0.5 = half day'],
    ['payroll', 'halfDayThresholdMinutes', 'Half-day below (minutes)', 'number', '240 = 4h'],
  ],
  loyalty: [
    ['loyalty', 'pointsPer100', 'Points earned per ₹100', 'number', ''],
    ['loyalty', 'rewardThresholdPoints', 'Points needed for a reward', 'number', ''],
    ['loyalty', 'rewardCouponValue', 'Reward coupon value (₹)', 'number', ''],
    ['loyalty', 'rewardMinOrder', 'Min order for reward coupon (₹)', 'number', ''],
    ['loyalty', 'rewardExpiryDays', 'Reward coupon expiry (days)', 'number', ''],
    ['loyalty', 'tierSilver', 'Silver tier from (₹ lifetime spend)', 'number', ''],
    ['loyalty', 'tierGold', 'Gold tier from (₹ lifetime spend)', 'number', ''],
    ['loyalty', 'tierPlatinum', 'Platinum tier from (₹ lifetime spend)', 'number', ''],
  ],
  invoice: [
    ['invoice', 'prefix', 'Invoice number prefix', 'text', 'e.g. INV'],
    ['invoice', 'nextNumber', 'Next invoice number', 'number', ''],
  ],
  general: [
    ['general', 'currency', 'Currency code', 'text', 'INR'],
    ['general', 'timezone', 'Timezone', 'text', 'Asia/Kolkata'],
  ],
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('tax');
  const [form, setForm] = useState(null);
  const [locations, setLocations] = useState([]);
  const [scope, setScope] = useState(''); // '' until resolved; 'global' or a locationId

  const isSuper = user?.role === 'super_admin';
  // Only location_admin is hard-pinned to one branch; a branch_admin may own
  // several branches and gets a selector (server authorizes per accessible branch).
  const isPinned = user?.role === 'location_admin';

  // Resolve the initial scope + load branch list for admins/super admins.
  useEffect(() => {
    if (!user) return;
    if (isPinned) {
      setScope(user.assignedLocation || '');
      return;
    }
    api.get('/locations')
      .then((res) => {
        const locs = res.data?.data || res.data || [];
        setLocations(locs);
        setScope(isSuper ? 'global' : (locs[0]?._id || user.assignedLocation || ''));
      })
      .catch(() => setScope(isSuper ? 'global' : (user.assignedLocation || '')));
  }, [user, isSuper, isPinned]);

  const load = useCallback(async (sc) => {
    setLoading(true);
    try {
      const q = sc && sc !== 'global' ? `?locationId=${sc}` : '';
      const res = await api.get(`/settings${q}`);
      setForm(res.data.data);
    } catch (e) {
      toast.error('Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (scope !== '') load(scope); }, [scope, load]);

  const setField = (group, key, value) => {
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        locationId: scope === 'global' ? null : scope,
        tax: form.tax, billing: form.billing, payroll: form.payroll,
        loyalty: form.loyalty, invoice: form.invoice, general: form.general,
      };
      await api.put('/settings', payload);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <LoadingScreen />;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <SlideIn>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><SettingsIcon size={22} /></div>
              <div>
                <h1 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">Settings</h1>
                <p className="text-[11px] font-medium text-(--color-text-muted)">Configure tax, billing, payroll & loyalty</p>
              </div>
            </div>

            {!isPinned && (
              <div className="w-52">
                <PremiumSelect
                  value={scope}
                  onChange={setScope}
                  options={[...(isSuper ? [{ label: 'Global default', value: 'global' }] : []), ...locations.map((l) => ({ label: l.name, value: l._id }))]}
                  placeholder="Select scope"
                />
              </div>
            )}
          </div>
        </SlideIn>

        <SlideIn delay={0.05}>
          <div className="flex gap-2 flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-medium tracking-normal transition-all border ${activeTab === t.key ? 'bg-primary text-(--color-on-primary) border-primary font-semibold' : 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border) hover:text-(--color-text-primary)'}`}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>
        </SlideIn>

        <SlideIn delay={0.1}>
          <div className="glass-card p-6 rounded-xl premium-shadow space-y-5">
            {FIELDS[activeTab].map(([group, key, label, type, hint]) => (
              <div key={key} className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-medium text-(--color-text-primary)">{label}</p>
                  {hint && <p className="text-[10px] font-medium text-(--color-text-muted)">{hint}</p>}
                </div>
                {type === 'checkbox' ? (
                  <button
                    onClick={() => setField(group, key, !form[group]?.[key])}
                    className={`relative w-12 h-6 rounded-full transition-all ${form[group]?.[key] ? 'bg-primary' : 'bg-(--color-border)'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all ${form[group]?.[key] ? 'translate-x-6' : ''}`} />
                  </button>
                ) : (
                  <input
                    type={type}
                    step={type === 'number' ? 'any' : undefined}
                    value={form[group]?.[key] ?? ''}
                    onChange={(e) => setField(group, key, type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                    className="w-40 px-4 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:border-primary text-right"
                  />
                )}
              </div>
            ))}
          </div>
        </SlideIn>

        <SlideIn delay={0.15}>
          <button
            onClick={save}
            disabled={saving}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-(--color-on-primary) text-sm font-semibold tracking-normal rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Save size={15} /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
