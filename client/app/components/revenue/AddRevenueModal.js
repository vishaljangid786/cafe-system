'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, TrendingUp, Check, IndianRupee, Info, Layers } from 'lucide-react';
import { blockNegative } from '@/app/utils/inputValidation';
import api from '../../services/api';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import PremiumSelect from '../ui/PremiumSelect';
import { Money } from '../ui/Money';
import toast from 'react-hot-toast';

const REVENUE_TITLES = [
  'Cash Sales',
  'Event / Catering',
  'Hall / Room Booking',
  'Membership / Subscription',
  'Miscellaneous Income',
  'Opening Balance Adjustment',
  'Other (Custom Title)',
];

const todayStr = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  title: 'Cash Sales',
  customTitle: '',
  reason: '',
  category: 'Manual',
  paymentMethod: 'CASH',
  date: todayStr(),
  description: '',
});

// Shared "Add Revenue" modal for the admin & branch-admin revenue pages.
// Lets the user pick one OR many branches, enter a SEPARATE amount for each, and
// give one shared (mandatory) reason. Posts to POST /transactions/revenue/bulk.
export default function AddRevenueModal({
  isOpen,
  onClose,
  locations = [],
  defaultLocationId = '',
  onSuccess,
}) {
  const [form, setForm] = useState(emptyForm());
  // { [locationId]: amountString } — a branch is "selected" iff it has a key here.
  const [amounts, setAmounts] = useState(() =>
    defaultLocationId ? { [defaultLocationId]: '' } : {}
  );
  const [submitting, setSubmitting] = useState(false);

  const showCustomTitle = form.title === 'Other (Custom Title)';

  const selectedIds = Object.keys(amounts);
  const total = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (Number(amounts[id]) || 0), 0),
    [amounts, selectedIds]
  );

  const reset = () => {
    setForm(emptyForm());
    setAmounts(defaultLocationId ? { [defaultLocationId]: '' } : {});
  };

  const close = () => {
    reset();
    onClose?.();
  };

  const toggleBranch = (id) => {
    setAmounts((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) delete next[id];
      else next[id] = '';
      return next;
    });
  };

  const setAmount = (id, value) => {
    setAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const selectAll = () => {
    setAmounts((prev) => {
      const next = { ...prev };
      locations.forEach((loc) => {
        if (next[loc._id] === undefined) next[loc._id] = '';
      });
      return next;
    });
  };

  const clearAll = () => setAmounts({});

  const handleSubmit = async (e) => {
    e.preventDefault();

    const reason = form.reason.trim();
    if (!reason) {
      toast.error('Please enter a reason for this revenue');
      return;
    }

    const title = showCustomTitle ? form.customTitle.trim() : form.title;
    if (!title) {
      toast.error('Please enter a title');
      return;
    }

    if (selectedIds.length === 0) {
      toast.error('Select at least one branch');
      return;
    }

    // Every selected branch needs a positive amount.
    const entries = [];
    for (const id of selectedIds) {
      const amt = Number(amounts[id]);
      if (!Number.isFinite(amt) || amt <= 0) {
        const loc = locations.find((l) => l._id === id);
        toast.error(`Enter a valid amount for ${loc?.name || 'the selected branch'}`);
        return;
      }
      entries.push({ locationId: id, amount: amt });
    }

    const loadToast = toast.loading('Adding revenue...');
    setSubmitting(true);
    try {
      const res = await api.post('/transactions/revenue/bulk', {
        entries,
        reason,
        title,
        category: form.category,
        paymentMethod: form.paymentMethod,
        date: form.date,
        description: form.description,
      });

      const count = res.data?.count ?? entries.length;
      const pending = res.data?.status === 'pending';
      toast.success(
        `${count} revenue ${count === 1 ? 'entry' : 'entries'} ${pending ? 'submitted for approval' : 'added'}`,
        { id: loadToast }
      );
      close();
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to add revenue', { id: loadToast });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Add Revenue" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-6 p-2">
        {/* Title */}
        <div className="space-y-3">
          <PremiumSelect
            label="Revenue Title"
            value={form.title}
            onChange={(val) => setForm({ ...form, title: val })}
            placeholder="Select a title"
            options={REVENUE_TITLES.map((t) => ({ label: t, value: t }))}
          />
        </div>

        <AnimatePresence>
          {showCustomTitle && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="space-y-3 overflow-hidden"
            >
              <label className="text-[11px] font-medium uppercase tracking-normal text-success ml-2">Enter Title</label>
              <input
                className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-success/20 transition-all outline-none"
                placeholder="e.g. Franchise Fee"
                value={form.customTitle}
                onChange={(e) => setForm({ ...form, customTitle: e.target.value })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reason — mandatory */}
        <div className="space-y-3">
          <label className="text-[11px] font-medium uppercase tracking-normal text-success ml-2 flex items-center gap-2">
            <Info size={12} /> Reason <span className="text-danger">*</span>
          </label>
          <textarea
            required
            rows={2}
            className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-success/20 transition-all outline-none"
            placeholder="Why is this revenue being added? (required)"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <PremiumSelect
              label="Category"
              value={form.category}
              onChange={(val) => setForm({ ...form, category: val })}
              options={[
                { label: 'Manual', value: 'Manual' },
                { label: 'Sales', value: 'Sales' },
                { label: 'Event', value: 'Event' },
                { label: 'Adjustment', value: 'Adjustment' },
                { label: 'Other', value: 'Other' },
              ]}
            />
          </div>
          <div className="space-y-3">
            <PremiumSelect
              label="Received Via"
              value={form.paymentMethod}
              onChange={(val) => setForm({ ...form, paymentMethod: val })}
              // Cash and UPI are the only methods the cafe actually takes, so the
              // ledger should not be able to grow payment types the ordering
              // screens can never produce. (The model still accepts the older
              // values, so historical CARD/ONLINE rows keep rendering.)
              options={[
                { label: 'Cash', value: 'CASH' },
                { label: 'UPI', value: 'UPI' },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[11px] font-medium uppercase tracking-normal text-success ml-2">Date</label>
          <input
            required
            type="date"
            className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-success/20 transition-all outline-none"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        {/* Branch picker — a separate amount per selected branch */}
        <div className="space-y-3">
          <div className="flex items-center justify-between ml-2">
            <label className="text-[11px] font-medium uppercase tracking-normal text-success flex items-center gap-2">
              <MapPin size={12} /> Branches &amp; Amounts <span className="text-danger">*</span>
            </label>
            {locations.length > 1 && (
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <button type="button" onClick={selectAll} className="text-success hover:underline">Select all</button>
                <button type="button" onClick={clearAll} className="text-(--color-text-muted) hover:underline">Clear</button>
              </div>
            )}
          </div>

          {locations.length === 0 ? (
            <div className="py-8 text-center bg-(--color-bg-soft)/50 rounded-xl border border-dashed border-(--color-border)">
              <p className="text-(--color-text-muted) text-sm font-medium">No branches available.</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {locations.map((loc) => {
                const isSel = amounts[loc._id] !== undefined;
                return (
                  <div
                    key={loc._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isSel
                        ? 'border-success/40 bg-success/5'
                        : 'border-(--color-border) bg-(--color-bg-soft)/40 hover:border-success/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleBranch(loc._id)}
                      className={`h-6 w-6 shrink-0 rounded-md border flex items-center justify-center transition-all ${
                        isSel ? 'bg-success border-success text-white' : 'border-(--color-border) text-transparent'
                      }`}
                      aria-label={isSel ? 'Deselect branch' : 'Select branch'}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleBranch(loc._id)}>
                      <p className="text-sm font-medium text-(--color-text-primary) truncate">{loc.name}</p>
                      {loc.city && <p className="text-[11px] font-medium text-(--color-text-muted) truncate">{loc.city}</p>}
                    </div>

                    <div className="relative w-32 shrink-0">
                      <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                      <input
                        type="number"
                        min="0"
                        onKeyDown={blockNegative}
                        disabled={!isSel}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-sm font-medium text-(--color-text-primary) outline-none focus:ring-2 focus:ring-success/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        value={amounts[loc._id] ?? ''}
                        onChange={(e) => setAmount(loc._id, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          <div className="flex items-center justify-between px-2 pt-1 text-xs font-medium text-(--color-text-muted)">
            <span className="flex items-center gap-1.5">
              <Layers size={12} /> {selectedIds.length} branch{selectedIds.length === 1 ? '' : 'es'} selected
            </span>
            <span className="text-success font-semibold">Total: <Money value={total} /></span>
          </div>
        </div>

        {/* Notes (optional) */}
        <div className="space-y-3">
          <label className="text-[11px] font-medium uppercase tracking-normal text-success ml-2">Notes (optional)</label>
          <textarea
            rows={2}
            className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-success/20 transition-all outline-none"
            placeholder="Any extra details..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          icon={TrendingUp}
          loading={submitting}
          className="w-full !rounded-xl !py-4 font-semibold uppercase tracking-normal text-sm bg-success hover:bg-success/90 text-white"
        >
          Add Revenue
        </Button>
      </form>
    </Modal>
  );
}
