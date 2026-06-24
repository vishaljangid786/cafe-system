'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/app/services/api';
import toast from 'react-hot-toast';
import { CalendarDays, Check, X } from 'lucide-react';

// Branch-scoped leave-request approvals. Server scopes /leave-requests to the
// admin's branch(es), so this works for admin / branch_admin / location_admin.
export default function LeaveApprovals() {
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/leave-requests');
      setRequests(res.data.data || []);
    } catch (e) { /* non-blocking */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (id, decision) => {
    setBusy(id);
    try {
      await api.patch(`/leave-requests/${id}/review`, { decision });
      toast.success(`Leave ${decision}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update request');
    } finally {
      setBusy(null);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const recent = requests.filter((r) => r.status !== 'pending').slice(0, 5);

  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl bg-(--color-surface) border border-(--color-border) p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-(--color-text-primary)">Leave requests</h2>
        {pending.length > 0 && (
          <span className="text-[9px] font-bold uppercase tracking-normal px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500">{pending.length} pending</span>
        )}
      </div>

      {pending.map((r) => (
        <div key={r._id} className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl bg-(--color-surface-soft) border border-(--color-border)">
          <div>
            <p className="text-xs font-bold text-(--color-text-primary)">{r.user?.name || 'Staff'} <span className="text-(--color-text-muted) uppercase text-[9px]">· {r.type}</span></p>
            <p className="text-[10px] text-(--color-text-muted)">{r.fromDate} → {r.toDate}{r.reason ? ` · ${r.reason}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy === r._id} onClick={() => review(r._id, 'approved')}
              className="flex items-center gap-1 px-3 py-2 bg-success/10 text-success text-[9px] font-bold uppercase tracking-normal rounded-lg border border-success/20 hover:bg-success hover:text-white disabled:opacity-50">
              <Check size={13} /> Approve
            </button>
            <button disabled={busy === r._id} onClick={() => review(r._id, 'rejected')}
              className="flex items-center gap-1 px-3 py-2 bg-danger/10 text-danger text-[9px] font-bold uppercase tracking-normal rounded-lg border border-danger/20 hover:bg-danger hover:text-white disabled:opacity-50">
              <X size={13} /> Reject
            </button>
          </div>
        </div>
      ))}

      {recent.length > 0 && (
        <div className="divide-y divide-(--color-border)">
          {recent.map((r) => (
            <div key={r._id} className="py-2 flex items-center justify-between text-[11px]">
              <span className="font-bold text-(--color-text-primary)">{r.user?.name} <span className="text-(--color-text-muted)">· {r.fromDate}→{r.toDate}</span></span>
              <span className={`text-[9px] font-bold uppercase tracking-normal ${r.status === 'approved' ? 'text-success' : 'text-danger'}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
