'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import { can } from '@/app/config/actions';
import {
  BellRing, CheckCircle2, XCircle, Smartphone, Wallet, Users, Loader2, Clock,
} from 'lucide-react';
import { Money } from '@/app/components/ui/Money';

// Front-of-house queue of customer QR/self-orders waiting for a staff member to
// confirm the payment (cash seen / UPI reference verified). Confirming releases
// the order to the kitchen; declining rejects it and restores stock.
export default function PendingApprovals({ branchId }) {
  const { user, socket } = useAuth();
  const [orders, setOrders] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [draft, setDraft] = useState({}); // orderId -> { method, amount }
  const pollRef = useRef(null);

  const mayApprove = can(user, 'orders.approve');

  const fetchPending = useCallback(async () => {
    if (!mayApprove) return;
    try {
      const scope = branchId && branchId !== 'All' && branchId !== 'all' ? `&branchId=${branchId}` : '';
      const res = await api.get(`/orders?status=AWAITING_APPROVAL&limit=50${scope}`);
      setOrders(res.data?.data || []);
    } catch { /* silent — panel just stays empty */ }
  }, [branchId, mayApprove]);

  useEffect(() => {
    fetchPending();
    pollRef.current = setInterval(fetchPending, 20000);
    return () => clearInterval(pollRef.current);
  }, [fetchPending]);

  useEffect(() => {
    if (!socket) return;
    const onPending = () => {
      toast('New self-order awaiting your confirmation', { icon: '🔔' });
      fetchPending();
    };
    const onChange = () => fetchPending();
    socket.on('order:pending_approval', onPending);
    socket.on('order:update', onChange);
    socket.on('order:new', onChange);
    return () => {
      socket.off('order:pending_approval', onPending);
      socket.off('order:update', onChange);
      socket.off('order:new', onChange);
    };
  }, [socket, fetchPending]);

  const draftFor = (o) => draft[o._id] || { method: o.paymentApproval?.method || 'CASH', amount: String(o.totalAmount ?? '') };
  const setDraftFor = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...draftFor({ _id: id, paymentApproval: {}, totalAmount: '' }), ...(d[id] || {}), ...patch } }));

  const approve = async (o) => {
    const d = draftFor(o);
    setBusyId(o._id);
    try {
      await api.patch(`/orders/${o._id}/approve-payment`, {
        method: d.method,
        amountPaid: d.amount === '' ? undefined : Number(d.amount),
      });
      toast.success('Payment confirmed — sent to kitchen');
      setOrders((prev) => prev.filter((x) => x._id !== o._id));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not confirm the order');
    } finally { setBusyId(null); }
  };

  const decline = async (o) => {
    setBusyId(o._id);
    try {
      await api.patch(`/orders/${o._id}/decline`, { reason: 'Payment not received' });
      toast.success('Order declined');
      setOrders((prev) => prev.filter((x) => x._id !== o._id));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not decline the order');
    } finally { setBusyId(null); }
  };

  if (!mayApprove || orders.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
        <BellRing size={16} className="text-amber-500 animate-pulse" />
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-amber-600">
          {orders.length} QR order{orders.length > 1 ? 's' : ''} awaiting payment confirmation
        </h3>
      </div>

      <div className="divide-y divide-(--color-border)">
        {orders.map((o) => {
          const d = draftFor(o);
          const busy = busyId === o._id;
          const itemsText = (o.items || []).map((it) => `${it.quantity}× ${it.itemName || it.menuItem?.name || 'Item'}`).join(', ');
          const wantsUpi = o.paymentApproval?.method === 'UPI';
          return (
            <div key={o._id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-(--color-text-primary)">{o.customerName || 'Guest'}</span>
                  {o.table?.tableNumber != null && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">T{o.table.tableNumber}</span>
                  )}
                  {o.numberOfPeople > 0 && (
                    <span className="text-[10px] font-bold text-(--color-text-muted) flex items-center gap-1"><Users size={11} /> {o.numberOfPeople}</span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1 ${wantsUpi ? 'bg-secondary/10 text-secondary' : 'bg-(--color-bg-soft) text-(--color-text-muted)'}`}>
                    {wantsUpi ? <><Smartphone size={11} /> UPI</> : <><Wallet size={11} /> Cash</>}
                  </span>
                  <span className="text-[10px] font-bold text-(--color-text-muted) flex items-center gap-1"><Clock size={11} /> #{String(o._id).slice(-6).toUpperCase()}</span>
                </div>
                <p className="text-xs text-(--color-text-muted) mt-1 line-clamp-2">{itemsText}</p>
                {o.members?.length > 0 && (
                  <p className="text-[11px] text-(--color-text-muted) mt-0.5">Guests: {o.members.join(', ')}</p>
                )}
                {o.paymentApproval?.upiRef && (
                  <p className="text-[11px] text-secondary mt-0.5 font-medium">UPI ref: {o.paymentApproval.upiRef}</p>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex rounded-lg border border-(--color-border) overflow-hidden">
                  {['CASH', 'UPI'].map((m) => (
                    <button key={m} onClick={() => setDraftFor(o._id, { method: m })}
                      className={`px-3 py-2 text-[11px] font-bold ${d.method === m ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-bg-soft) text-(--color-text-muted)'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex items-center rounded-lg border border-(--color-border) bg-(--color-bg-soft) px-2">
                  <span className="text-[11px] text-(--color-text-muted)">₹</span>
                  <input
                    value={d.amount}
                    onChange={(e) => setDraftFor(o._id, { amount: e.target.value.replace(/[^\d.]/g, '') })}
                    inputMode="decimal"
                    className="w-20 bg-transparent py-2 px-1 text-sm font-bold text-(--color-text-primary) outline-none"
                  />
                </div>
                <span className="text-xs font-bold text-(--color-text-primary) mr-1">of <Money value={o.totalAmount} /></span>
                <button onClick={() => approve(o)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-white text-[11px] font-bold uppercase tracking-wide active:scale-95 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirm
                </button>
                <button onClick={() => decline(o)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-danger/10 text-danger border border-danger/20 text-[11px] font-bold uppercase tracking-wide active:scale-95 disabled:opacity-50">
                  <XCircle size={14} /> Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
