'use client';
import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { can } from '@/app/config/actions';
import ConfirmDialog from './ConfirmDialog';

// One delete affordance for every list row in the app.
//
// Deleting a single record has the same four requirements everywhere, and each
// of them is easy to get subtly wrong in a bespoke implementation:
//
//   1. PERMISSION — the control must not render at all unless the viewer holds
//      the action (super_admin / legacy role / broad perm / granular flag). The
//      server re-checks, but a button that always 403s is a broken UI.
//   2. CONFIRMATION — irreversible, so never one-click.
//   3. THE SERVER'S OWN MESSAGE — the API answers with specific, actionable text
//      ("This expense is already posted to the ledger. Reject it instead of
//      deleting it.", "This order belongs to a branch you do not manage."). That
//      sentence is the entire value of the backend rules, so it is shown verbatim
//      rather than being replaced by a generic failure string.
//   4. THE ROW MUST GO — onDeleted lets the page refetch or splice.
//
// Usage:
//   <RowDeleteButton
//     actionKey="revenue.delete"
//     endpoint={`/transactions/${row._id}`}
//     label={`revenue entry of ₹${row.totalAmount}`}
//     onDeleted={fetchRevenue}
//   />
export default function RowDeleteButton({
  /**
   * Granular action key, e.g. 'orders.delete' — hides the button when not held.
   * May be an ARRAY, in which case holding ANY one of them is enough. Expenses
   * need this: a stored grant may carry either the dedicated 'expenses.delete'
   * or the older 'revenue.delete', and both must open the same door.
   */
  actionKey,
  /** API path passed straight to api.delete, e.g. `/orders/${id}` */
  endpoint,
  /** what is being deleted, used in the confirm copy: "Delete <label>?" */
  label = 'this record',
  /** optional extra sentence in the confirm body */
  description,
  /** called after a successful delete — refetch or splice the row */
  onDeleted,
  /** icon size, to match whatever the surrounding row uses */
  size = 18,
  /** replaces the default icon button entirely (e.g. a full-width menu item) */
  children,
  className = '',
  title,
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Gate 1 of 2. The server holds the real gate; this only decides what to show.
  const keys = Array.isArray(actionKey) ? actionKey : [actionKey];
  if (!keys.some((k) => can(user, k))) return null;

  const run = async () => {
    setBusy(true);
    const t = toast.loading('Deleting…');
    try {
      const res = await api.delete(endpoint);
      toast.success(res.data?.message || 'Deleted', { id: t, duration: 5000 });
      setOpen(false);
      await onDeleted?.(res.data);
    } catch (err) {
      // The server explains WHY and what to do instead — show that, not a generic
      // string, and give it long enough to read since it is a full sentence.
      toast.error(
        err.response?.data?.message || 'Could not delete. Please try again.',
        { id: t, duration: 7000 }
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  // stopPropagation: these sit inside rows that are themselves clickable, and
  // without it the click also opens the row's detail modal behind the dialog.
  const openDialog = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    setOpen(true);
  };

  return (
    <>
      {children ? (
        <span onClick={openDialog} className={className}>
          {children}
        </span>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          disabled={busy}
          title={title || `Delete ${label}`}
          aria-label={title || `Delete ${label}`}
          className={`p-2.5 rounded-xl text-(--color-text-muted) hover:text-danger hover:bg-danger/10 transition-all disabled:opacity-40 ${className}`}
        >
          {busy ? <Loader2 size={size} className="animate-spin" /> : <Trash2 size={size} />}
        </button>
      )}

      {/* This button often sits inside a clickable row. React events bubble
          through the component tree (even for portaled/fixed overlays), so
          without this a click on Cancel / the backdrop would bubble up to the
          row's onClick and open its drawer. Swallow every click that happens
          inside the confirm dialog. */}
      <span onClick={(e) => e.stopPropagation()}>
        <ConfirmDialog
          isOpen={open}
          loading={busy}
          onClose={() => (busy ? null : setOpen(false))}
          onConfirm={run}
          title={`Delete ${label}?`}
          message={
            description ||
            'This permanently removes the record. Financial and audit history that references it is kept.'
          }
          confirmText="Delete"
          type="danger"
          isImpersonating={!!user?.isImpersonating}
        />
      </span>
    </>
  );
}
