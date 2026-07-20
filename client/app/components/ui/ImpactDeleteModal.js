'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Trash2, Archive, UserCog, Loader2, Lock } from 'lucide-react';
import { Button } from './Button';
import api from '@/app/services/api';

// The confirmation that stands between a super admin and an irreversible delete.
//
// It refuses to render a generic "are you sure": it asks the server what the
// deletion would actually touch and lays that out in three groups, because the
// distinction matters more than the total —
//
//   removed    disappears for good
//   preserved  financial and audit records that survive by design, and will
//              show the person as "(removed)" from here on
//   detached   survives, but stops pointing at what is being deleted
//
// For a role-holder it also offers the choice the operator actually has: take
// the person out on their own, hand their seat to somebody else, or remove
// their whole team with them.

const MODE_COPY = {
  solo: {
    icon: Archive,
    title: 'Remove this person only',
    body: 'Their team keeps working and simply has no lead until you assign one.',
  },
  reassign: {
    icon: UserCog,
    title: 'Remove and hand over to somebody else',
    body: 'The person you pick takes over the role, the branch and everyone reporting to it.',
  },
  cascade: {
    icon: Trash2,
    title: 'Remove this person and their whole team',
    body: 'Every staff member and chef under them is removed at the same time.',
  },
};

const GroupList = ({ rows, tone }) => {
  if (!rows?.length) return null;
  const toneCls =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'safe'
      ? 'text-(--color-text-secondary)'
      : 'text-(--color-text-muted)';
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-(--color-text-secondary)">{r.label}</span>
          <span className={`font-semibold tabular-nums ${toneCls}`}>{r.count.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
};

const Section = ({ title, hint, children }) => (
  <div className="rounded-xl border border-(--color-border) p-4">
    <p className="text-[11px] font-semibold uppercase tracking-normal text-(--color-text-primary) mb-1">{title}</p>
    <p className="text-[11px] text-(--color-text-muted) mb-3 leading-relaxed">{hint}</p>
    {children}
  </div>
);

export default function ImpactDeleteModal({
  isOpen,
  onClose,
  /** 'user' | 'branch' | 'cafe' */
  entity,
  /** id of the thing being deleted */
  id,
  /** shown in the heading before the impact loads */
  name,
  /** called with the chosen options once the operator confirms */
  onConfirm,
}) {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('solo');
  const [replacementId, setReplacementId] = useState('');
  const [alsoRemoveStaff, setAlsoRemoveStaff] = useState(false);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const impactPath = useMemo(() => {
    if (!id) return null;
    if (entity === 'user') return `/users/${id}/impact`;
    if (entity === 'branch') return `/locations/${id}/impact`;
    if (entity === 'cafe') return `/cafes/${id}/impact`;
    return null;
  }, [entity, id]);

  useEffect(() => {
    if (!isOpen || !impactPath) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setImpact(null);
    setMode('solo');
    setReplacementId('');
    setAlsoRemoveStaff(false);
    setTyped('');

    api
      .get(impactPath)
      .then((res) => {
        if (!cancelled) setImpact(res.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not work out what this would affect');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, impactPath]);

  const subjectName = impact?.subject?.name || name || 'this record';

  const cascadeRows = impact?.cascade || [];
  const preserveRows = impact?.preserve || [];
  const detachRows = impact?.detach || [];

  const totalRemoved = cascadeRows.reduce((s, r) => s + r.count, 0);
  const totalPreserved = preserveRows.reduce((s, r) => s + r.count, 0);
  const hasDependencies = totalRemoved + totalPreserved + detachRows.length > 0;

  // Deleting a whole cafe or branch is typed-confirmation territory; removing a
  // single person with nothing attached to them is not.
  const needsTypedConfirm = entity !== 'user' || totalRemoved > 0;
  const confirmWord = entity === 'user' ? 'REMOVE' : 'DELETE';
  const typedOk = !needsTypedConfirm || typed.trim().toUpperCase() === confirmWord;

  const blockedByActiveOrders = entity === 'user' && (impact?.activeOrders || 0) > 0;
  const needsReplacement = entity === 'user' && mode === 'reassign' && !replacementId;

  const canConfirm =
    !loading && !submitting && !error && typedOk && !needsReplacement && !blockedByActiveOrders;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(
        entity === 'user'
          ? { mode, replacementId: mode === 'reassign' ? replacementId : undefined }
          : { force: true, staffMode: alsoRemoveStaff ? 'delete' : 'detach' }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={submitting ? undefined : onClose}
            className="fixed inset-0 bg-black/50 z-10000"
          />
          <div className="fixed inset-0 flex items-center justify-center p-0 sm:p-4 z-10001 pointer-events-none">
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 16 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-lg max-h-[100vh] sm:max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-xl pointer-events-auto border border-(--color-border) bg-(--color-surface) shadow-[var(--shadow-md)] mt-auto sm:mt-0"
            >
              <div className="p-6">
                <div className="h-12 w-12 rounded-xl bg-[rgba(var(--color-danger-rgb),0.1)] text-danger flex items-center justify-center mb-4">
                  <ShieldAlert size={24} />
                </div>

                <h3 className="text-lg font-semibold text-(--color-text-primary)">
                  Delete {subjectName}?
                </h3>

                {loading && (
                  <div className="flex items-center gap-2 text-sm text-(--color-text-muted) py-8">
                    <Loader2 size={16} className="animate-spin" />
                    Checking what this would affect…
                  </div>
                )}

                {error && !loading && (
                  <p className="text-sm text-danger mt-3">{error}</p>
                )}

                {!loading && !error && impact && (
                  <>
                    <p className="text-sm text-(--color-text-secondary) mt-2 mb-5 leading-relaxed">
                      {hasDependencies
                        ? 'A lot of data is connected to this. Read what happens to each part before you continue — this cannot be undone.'
                        : 'Nothing else is connected to this record.'}
                    </p>

                    {blockedByActiveOrders && (
                      <div className="rounded-xl bg-[rgba(var(--color-danger-rgb),0.1)] border border-[rgba(var(--color-danger-rgb),0.2)] p-3 mb-4 text-xs text-danger">
                        {impact.activeOrders} order(s) assigned to this person are still in progress.
                        Close or reassign them before removing the account.
                      </div>
                    )}

                    {/* Role-holder options */}
                    {entity === 'user' && impact.isRoleHolder && (
                      <div className="space-y-2 mb-5">
                        <p className="text-[11px] font-semibold uppercase tracking-normal text-(--color-text-primary)">
                          This person holds a role
                          {impact.subordinates?.length > 0 &&
                            ` — ${impact.subordinates.length} people report to them`}
                        </p>
                        {['solo', 'reassign', 'cascade'].map((m) => {
                          const copy = MODE_COPY[m];
                          const Icon = copy.icon;
                          const active = mode === m;
                          if (m === 'cascade' && !impact.subordinates?.length) return null;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setMode(m)}
                              className={`w-full text-left rounded-xl border p-3 flex gap-3 transition-all ${
                                active
                                  ? 'border-(--color-primary) bg-(--color-primary-soft)'
                                  : 'border-(--color-border) hover:border-(--color-text-muted)'
                              }`}
                            >
                              <Icon size={16} className={active ? 'text-primary mt-0.5' : 'text-(--color-text-muted) mt-0.5'} />
                              <span>
                                <span className="block text-xs font-semibold text-(--color-text-primary)">{copy.title}</span>
                                <span className="block text-[11px] text-(--color-text-muted) mt-0.5 leading-relaxed">{copy.body}</span>
                              </span>
                            </button>
                          );
                        })}

                        {mode === 'reassign' && (
                          <select
                            value={replacementId}
                            onChange={(e) => setReplacementId(e.target.value)}
                            className="w-full mt-1 px-4 py-3 rounded-xl text-sm bg-(--color-surface-2) border border-(--color-border) text-(--color-text-primary)"
                          >
                            <option value="">Who takes over?</option>
                            {(impact.replacementCandidates || []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} — {c.role.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        )}
                        {mode === 'reassign' && !impact.replacementCandidates?.length && (
                          <p className="text-[11px] text-danger">
                            Nobody in this scope can take the role over. Pick another option.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Branch / cafe: what to do with the people */}
                    {entity !== 'user' && (
                      <label className="flex items-start gap-3 rounded-xl border border-(--color-border) p-3 mb-5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alsoRemoveStaff}
                          onChange={(e) => setAlsoRemoveStaff(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-xs font-semibold text-(--color-text-primary)">
                            Also remove the {impact.staffCount ?? 0} people attached to it
                          </span>
                          <span className="block text-[11px] text-(--color-text-muted) mt-0.5 leading-relaxed">
                            Leave this off and they keep their accounts; only the link to this{' '}
                            {entity} is cleared.
                          </span>
                        </span>
                      </label>
                    )}

                    <div className="space-y-3">
                      {cascadeRows.length > 0 && (
                        <Section
                          title={`Permanently removed (${totalRemoved.toLocaleString()})`}
                          hint="Exists only because of what you are deleting. Gone for good."
                        >
                          <GroupList rows={cascadeRows} tone="danger" />
                        </Section>
                      )}

                      {preserveRows.length > 0 && (
                        <Section
                          title={`Kept (${totalPreserved.toLocaleString()})`}
                          hint="Financial and audit records are never deleted, so your reports keep adding up. They will show this as removed from now on."
                        >
                          <GroupList rows={preserveRows} tone="safe" />
                        </Section>
                      )}

                      {detachRows.length > 0 && (
                        <Section
                          title="Unlinked"
                          hint="These survive; only their link to this record is cleared."
                        >
                          <GroupList rows={detachRows} tone="muted" />
                        </Section>
                      )}
                    </div>

                    {needsTypedConfirm && (
                      <div className="mt-5">
                        <label className="block text-[11px] font-medium text-(--color-text-muted) mb-2">
                          Type <span className="font-bold text-(--color-text-primary)">{confirmWord}</span> to confirm
                        </label>
                        <input
                          value={typed}
                          onChange={(e) => setTyped(e.target.value)}
                          autoComplete="off"
                          className="w-full px-4 py-3 rounded-xl text-sm bg-(--color-surface-2) border border-(--color-border) text-(--color-text-primary)"
                          placeholder={confirmWord}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button variant="outline" onClick={onClose} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleConfirm} disabled={!canConfirm}>
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    {submitting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
