'use client';
import { useState, useEffect, useCallback } from 'react';
import { Cake, Send, Copy, Power } from 'lucide-react';
import api from '@/app/services/api';
import Modal from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import toast from 'react-hot-toast';

const SCOPES = [
  { value: 'today', label: "Today's birthdays" },
  { value: 'week', label: 'Next 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

/**
 * Generates a birthday coupon batch. Every coupon is scoped to the chosen cafe /
 * branches and assigned to a specific customer, so it cannot be redeemed by
 * anyone else or at another cafe — the server enforces both at redemption.
 */
export default function BirthdayCampaignModal({ isOpen, onClose, cafes = [], branches = [] }) {
  const [tab, setTab] = useState('create'); // create | history
  const [scope, setScope] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cafeId, setCafeId] = useState('');
  const [branchIds, setBranchIds] = useState([]);
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState(25);
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [validDays, setValidDays] = useState(7);
  const [codePrefix, setCodePrefix] = useState('BDAY');
  const [perCustomerCode, setPerCustomerCode] = useState(true);

  const [preview, setPreview] = useState({ count: 0, rows: [] });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [campaigns, setCampaigns] = useState([]);

  // Live preview of exactly who would receive a coupon.
  const loadPreview = useCallback(async () => {
    try {
      const params = new URLSearchParams({ scope: scope === 'custom' ? 'month' : scope });
      if (cafeId) params.append('cafeId', cafeId);
      const r = await api.get(`/customers/birthdays?${params.toString()}`);
      setPreview({ count: r.data?.count || 0, rows: r.data?.data || [] });
    } catch {
      setPreview({ count: 0, rows: [] });
    }
  }, [scope, cafeId]);

  const loadCampaigns = useCallback(async () => {
    try {
      const r = await api.get('/customers/campaigns');
      setCampaigns(r.data?.data || []);
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'create') loadPreview();
    else loadCampaigns();
  }, [isOpen, tab, loadPreview, loadCampaigns]);

  const generate = async () => {
    if (!discountValue || Number(discountValue) <= 0) return toast.error('Enter a discount value');
    setBusy(true);
    try {
      const r = await api.post('/customers/campaigns/birthday', {
        scope, startDate: scope === 'custom' ? startDate : undefined, endDate: scope === 'custom' ? endDate : undefined,
        cafeId: cafeId || undefined,
        branchIds,
        discountType,
        discountValue: Number(discountValue),
        maxDiscount: maxDiscount === '' ? null : Number(maxDiscount),
        minOrderAmount: Number(minOrderAmount) || 0,
        validDays: Number(validDays) || 7,
        codePrefix,
        perCustomerCode,
      });
      setResult(r.data?.data || null);
      toast.success(`${r.data?.data?.created || 0} coupon(s) generated`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not generate the campaign');
    } finally {
      setBusy(false);
    }
  };

  const toggleBatch = async (batchId, isActive) => {
    try {
      await api.patch(`/customers/campaigns/${batchId}`, { isActive });
      toast.success(isActive ? 'Campaign reactivated' : 'Campaign deactivated');
      loadCampaigns();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update the campaign');
    }
  };

  const branchOptions = branches
    .filter((b) => (cafeId ? String(b.cafe?._id || b.cafe) === String(cafeId) : true))
    .map((b) => ({ value: b._id, label: `${b.name}${b.city ? ` · ${b.city}` : ''}` }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Birthday offers" maxWidth="max-w-2xl">
      <div className="flex gap-2 mb-4">
        {['create', 'history'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setResult(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
              tab === t ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'
            }`}
          >
            {t === 'create' ? 'New campaign' : 'Campaigns'}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PremiumSelect label="Whose birthday" value={scope} onChange={setScope} options={SCOPES} />
            <PremiumSelect
              label="Cafe"
              placeholder="All my cafes"
              value={cafeId}
              onChange={(v) => { setCafeId(v); setBranchIds([]); }}
              options={[{ value: '', label: 'All my cafes' }, ...cafes.map((c) => ({ value: c._id, label: c.name }))]}
            />
          </div>

          {scope === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">From</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">To</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
              </div>
            </div>
          )}

          {branchOptions.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Limit to branches (optional)</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {branchOptions.map((b) => {
                  const on = branchIds.includes(b.value);
                  return (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setBranchIds(on ? branchIds.filter((x) => x !== b.value) : [...branchIds, b.value])}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                        on ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PremiumSelect label="Type" value={discountType} onChange={setDiscountType}
              options={[{ value: 'percentage', label: 'Percent' }, { value: 'fixed', label: 'Flat ₹' }]} />
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Value</label>
              <input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Max ₹</label>
              <input type="number" min="0" placeholder="No cap" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Valid days</label>
              <input type="number" min="1" value={validDays} onChange={(e) => setValidDays(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Min order ₹</label>
              <input type="number" min="0" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-muted)">Code prefix</label>
              <input value={codePrefix} onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                className="mt-1 w-full px-3 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) text-sm outline-none focus:border-primary" />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-(--color-text-primary)">A unique code for each customer</span>
            <input type="checkbox" checked={perCustomerCode} onChange={(e) => setPerCustomerCode(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]" />
          </label>

          <div className="p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
            <p className="text-xs font-bold text-(--color-text-primary)">
              {preview.count} customer{preview.count === 1 ? '' : 's'} will receive this offer
            </p>
            {preview.rows.length > 0 && (
              <p className="mt-1 text-[11px] text-(--color-text-muted) truncate">
                {preview.rows.slice(0, 6).map((c) => c.name).join(', ')}{preview.rows.length > 6 ? ` +${preview.rows.length - 6} more` : ''}
              </p>
            )}
          </div>

          {result && (
            <div className="p-3 rounded-xl bg-success/10 border border-success/20 space-y-2">
              <p className="text-xs font-bold text-success">
                {result.created} coupon(s) created{result.skipped ? ` · ${result.skipped} skipped` : ''}
              </p>
              {result.sample?.length > 0 && (
                <>
                  <p className="text-[11px] font-mono text-(--color-text-primary) break-all">{result.sample.join(', ')}</p>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(result.sample.join(', ')); toast.success('Codes copied'); }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"
                  >
                    <Copy size={12} /> Copy codes
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1 !rounded-xl" onClick={onClose}>Close</Button>
            <Button type="button" variant="primary" icon={Send} disabled={busy || preview.count === 0}
              className="flex-1 !rounded-xl" onClick={generate}>
              {busy ? 'Generating…' : `Generate for ${preview.count}`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {campaigns.length === 0 ? (
            <p className="text-sm text-(--color-text-muted) text-center py-8">No campaigns yet.</p>
          ) : campaigns.map((c) => (
            <div key={c.batchId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
              <div className="min-w-0">
                <p className="text-xs font-bold text-(--color-text-primary) flex items-center gap-1.5">
                  <Cake size={13} className="text-primary" /> {c.coupons} coupon{c.coupons === 1 ? '' : 's'}
                  <span className="text-(--color-text-muted) font-medium">· {c.redeemed} redeemed</span>
                </p>
                <p className="text-[10px] text-(--color-text-muted) mt-0.5">
                  {c.generatedAt ? new Date(c.generatedAt).toLocaleString() : '—'} · {c.active} active
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleBatch(c.batchId, c.active === 0)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-[11px] font-bold text-(--color-text-primary)"
              >
                <Power size={12} /> {c.active === 0 ? 'Reactivate' : 'Deactivate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
