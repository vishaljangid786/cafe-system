'use client';
import Modal from '@/app/components/ui/Modal';
import { Money } from '@/app/components/ui/Money';
import { Store, CreditCard, Tag, Receipt } from 'lucide-react';

// Full breakdown of a single order: line items (with modifiers), discount, the
// coupon used, tax and what was actually paid. The order object already carries
// everything (see getCustomerOrders' select), so this is a pure presentation modal.
export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;
  const items = order.items || [];
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const discount = Number(order.discountAmount) || 0;
  const tax = Number(order.taxAmount) || 0;
  const grand = Number(order.grandTotal || order.totalAmount) || 0;

  return (
    <Modal isOpen={!!order} onClose={onClose} title="Order details" maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-(--color-text-muted)">
          <span className="font-semibold text-(--color-text-primary)">{new Date(order.createdAt).toLocaleString('en-IN')}</span>
          <span className="flex items-center gap-1.5"><Store size={13} /> {order.branch?.name || '—'}{order.branch?.city ? ` · ${order.branch.city}` : ''}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.orderType && <span className="px-2.5 py-1 rounded-full bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium capitalize">{order.orderType}</span>}
          {order.paymentType && <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium flex items-center gap-1"><CreditCard size={11} /> {order.paymentType}</span>}
          {order.status && <span className="px-2.5 py-1 rounded-full bg-(--color-surface-soft) border border-(--color-border) text-[11px] font-medium">{order.status}</span>}
        </div>

        {/* Items */}
        <div className="rounded-xl border border-(--color-border) divide-y divide-(--color-border)">
          {items.length === 0 && <p className="text-xs text-(--color-text-muted) text-center py-5">No item detail on this order.</p>}
          {items.map((it, i) => (
            <div key={i} className="px-3.5 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-(--color-text-primary)">
                  <span className="text-primary font-semibold">{it.quantity}×</span> {it.itemName || 'Item'}
                </p>
                {(it.modifiers || []).length > 0 && (
                  <p className="text-[11px] text-(--color-text-muted) mt-0.5">
                    {it.modifiers.map((m) => m.label || m.groupName).filter(Boolean).join(', ')}
                  </p>
                )}
                {it.notes && <p className="text-[11px] italic text-(--color-text-muted) mt-0.5">“{it.notes}”</p>}
              </div>
              <p className="text-sm font-semibold text-(--color-text-primary) shrink-0"><Money value={(Number(it.price) || 0) * (Number(it.quantity) || 0)} /></p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="rounded-xl bg-(--color-surface-soft) border border-(--color-border) p-4 space-y-1.5 text-sm">
          <Row label="Subtotal" value={<Money value={subtotal} />} />
          {discount > 0 && (
            <Row
              label={
                <span className="flex items-center gap-1.5 text-success">
                  <Tag size={12} /> Discount{order.coupon?.code ? ` · ${order.coupon.code}` : ''}
                </span>
              }
              value={<span className="text-success">− <Money value={discount} /></span>}
            />
          )}
          {tax > 0 && <Row label="GST" value={<Money value={tax} />} />}
          <div className="pt-1.5 mt-1.5 border-t border-(--color-border) flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold text-(--color-text-primary)"><Receipt size={14} /> Total</span>
            <span className="text-lg font-bold text-(--color-text-primary)"><Money value={grand} /></span>
          </div>
          {order.amountPaid != null && Number(order.amountPaid) !== grand && (
            <Row label="Paid" value={<Money value={order.amountPaid} />} />
          )}
        </div>
      </div>
    </Modal>
  );
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-(--color-text-muted)">{label}</span>
    <span className="font-medium text-(--color-text-primary)">{value}</span>
  </div>
);
