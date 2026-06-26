import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import PremiumSelect from '../../../../components/ui/PremiumSelect';
import { Zap, Printer, RotateCcw, Scissors } from 'lucide-react';

const PAYMENT_CHIP = {
  paid: 'text-success bg-success/10 border-success/20',
  partial: 'text-secondary bg-secondary/10 border-secondary/20',
  unpaid: 'text-danger bg-danger/10 border-danger/20',
};

export default function OrderDetailsModal({ selectedOrder, onClose, handleCancel, handleForceComplete, handleDeleteOrder, handleRefund, handleReorder, handleMoveTable, handleSplit, handleRedeemGiftCard, tables = [], userRole, canDelete, canRefund: canRefundProp }) {
  const [showSplit, setShowSplit] = useState(false);
  const [splitQty, setSplitQty] = useState({}); // itemId -> qty to split off
  const [gcCode, setGcCode] = useState('');
  const [gcAmount, setGcAmount] = useState('');
  useEffect(() => { setShowSplit(false); setSplitQty({}); setGcCode(''); setGcAmount(''); }, [selectedOrder?._id]);

  if (!selectedOrder) return null;

  const splitSelected = Object.entries(splitQty)
    .filter(([, q]) => Number(q) > 0)
    .map(([itemId, q]) => ({ itemId, quantity: Number(q) }));

  const payStatus = selectedOrder.paymentStatus || 'unpaid';
  const orderTypeLabel = selectedOrder.table?.tableNumber
    ? `Table ${selectedOrder.table.tableNumber}`
    : (selectedOrder.orderType === 'delivery' ? 'Delivery' : 'Takeaway');
  // Prefer the action-permission flags from the parent (which include granted
  // users); fall back to the legacy role check when the props aren't supplied.
  const canRefund = canRefundProp !== undefined ? canRefundProp : ['admin', 'super_admin', 'branch_admin'].includes(userRole);
  const canDeleteOrder = canDelete !== undefined ? canDelete : ['admin', 'super_admin'].includes(userRole);

  return (
    <Modal
      isOpen={!!selectedOrder}
      onClose={onClose}
      title="Order Details"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-10 p-2">
        <div className="flex items-center justify-between p-8 bg-(--color-text-primary) text-(--color-surface) rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <Zap size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-bold uppercase tracking-normal rounded border border-primary/20">ORDER</span>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-normal">#{selectedOrder._id}</span>
            </div>
            <h3 className="text-3xl font-bold tracking-tight">{orderTypeLabel}</h3>
            <p className="text-xs font-bold text-white/60 mt-1 uppercase tracking-normal">{selectedOrder.branch?.name} / {new Date(selectedOrder.createdAt).toLocaleTimeString()}</p>
          </div>
          <div className="relative z-10 text-right">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-normal mb-1">Total Amount</p>
            <p className="text-4xl font-bold text-primary tracking-tight">₹{selectedOrder.totalAmount}</p>
            <div className="flex justify-end gap-2 mt-2">
              <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-normal rounded border ${PAYMENT_CHIP[payStatus] || PAYMENT_CHIP.unpaid}`}>
                {selectedOrder.isRefunded ? 'Refunded' : payStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-1 w-6 bg-primary rounded-full" />
            <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Order Items</h4>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {selectedOrder.items.map((item, idx) => (
              <div key={idx} className="p-5 bg-(--color-surface-soft) rounded-[1.5rem] border border-(--color-border) flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-(--color-surface) flex items-center justify-center border border-(--color-border) text-primary transition-transform">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-(--color-text-primary)">{item.menuItem?.name}</p>
                    <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">{item.quantity} x ₹{item.menuItem?.price}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-(--color-text-primary)">₹{item.quantity * (item.menuItem?.price || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-(--color-border)">
          {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedOrder.status) && selectedOrder.table && handleMoveTable && (() => {
            const branchId = (selectedOrder.branch?._id || selectedOrder.branch)?.toString();
            const currentTableId = (selectedOrder.table?._id || selectedOrder.table)?.toString();
            const moveOptions = tables.filter((t) => ((t.locationId?._id || t.locationId)?.toString() === branchId) && (t._id?.toString() !== currentTableId));
            if (moveOptions.length === 0) return null;
            return (
              <PremiumSelect
                value=""
                onChange={(v) => { if (v) handleMoveTable(selectedOrder._id, v); }}
                options={moveOptions.map((t) => ({ label: `T${t.tableNumber}${t.tableName ? ` · ${t.tableName}` : ''}`, value: t._id }))}
                placeholder="Move to table…"
              />
            );
          })()}
          {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedOrder.status) && handleSplit && selectedOrder.items.length > 0 && (
            <div className="rounded-xl border border-(--color-border) overflow-hidden">
              <button
                onClick={() => setShowSplit((v) => !v)}
                className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-(--color-surface-soft) text-(--color-text-primary) text-[10px] font-bold uppercase tracking-normal hover:bg-(--color-surface) transition-all"
              >
                <Scissors size={14} /> {showSplit ? 'Hide split' : 'Split bill'}
              </button>
              {showSplit && (
                <div className="p-4 space-y-3">
                  <p className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal">Choose how many of each item to move to a new bill</p>
                  {selectedOrder.items.map((item) => (
                    <div key={item._id} className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-bold text-(--color-text-primary) truncate">{item.menuItem?.name || item.itemName} <span className="text-(--color-text-muted)">×{item.quantity}</span></span>
                      <input
                        type="number"
                        min={0}
                        max={item.quantity}
                        value={splitQty[item._id] ?? ''}
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(Number(e.target.value) || 0, item.quantity));
                          setSplitQty((prev) => ({ ...prev, [item._id]: v }));
                        }}
                        className="w-16 px-2 py-1.5 rounded-lg bg-(--color-surface-soft) border border-(--color-border) text-xs font-bold text-center text-(--color-text-primary) outline-none"
                      />
                    </div>
                  ))}
                  <button
                    disabled={splitSelected.length === 0}
                    onClick={() => handleSplit(selectedOrder._id, splitSelected)}
                    className="w-full py-3 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-xl border border-primary/20 hover:bg-primary hover:text-(--color-on-primary) transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Split off {splitSelected.reduce((a, s) => a + s.quantity, 0)} item(s) to a new order
                  </button>
                </div>
              )}
            </div>
          )}
          {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedOrder.status) && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleCancel(selectedOrder._id)}
                className="py-4 bg-danger/10 text-danger text-[10px] font-bold uppercase tracking-normal rounded-xl border border-danger/20 hover:bg-danger hover:text-white transition-all"
              >
                Cancel Order
              </button>
              <button
                onClick={() => handleForceComplete(selectedOrder._id)}
                className="py-4 bg-success/10 text-success text-[10px] font-bold uppercase tracking-normal rounded-xl border border-success/20 hover:bg-success hover:text-white transition-all"
              >
                Complete Order
              </button>
            </div>
          )}
          {selectedOrder.status === 'COMPLETED' && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-xl text-center">
              <p className="text-success text-[10px] font-bold uppercase tracking-normal">Order Completed</p>
            </div>
          )}

          {['REJECTED', 'CANCELLED'].includes(selectedOrder.status) && handleReorder && (
            <div className="space-y-3">
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-center">
                <p className="text-danger text-[10px] font-bold uppercase tracking-normal">{selectedOrder.status}</p>
                {selectedOrder.rejectReason && (
                  <p className="text-danger/70 text-[9px] font-medium normal-case mt-1">{selectedOrder.rejectReason}</p>
                )}
              </div>
              <button
                onClick={() => handleReorder(selectedOrder._id)}
                className="w-full py-4 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-xl border border-primary/20 hover:bg-primary hover:text-(--color-on-primary) transition-all"
              >
                Re-order (place again)
              </button>
            </div>
          )}

          {handleRedeemGiftCard && !selectedOrder.isRefunded && !['CANCELLED', 'REJECTED'].includes(selectedOrder.status) && selectedOrder.paymentStatus !== 'paid' && (
            <div className="rounded-xl border border-(--color-border) p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Redeem gift card</p>
              <div className="flex gap-2">
                <input
                  value={gcCode}
                  onChange={(e) => setGcCode(e.target.value.toUpperCase())}
                  placeholder="Card code"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-bold text-(--color-text-primary) outline-none"
                />
                <input
                  type="number"
                  value={gcAmount}
                  onChange={(e) => setGcAmount(e.target.value)}
                  placeholder="₹"
                  className="w-24 px-3 py-2.5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-xs font-bold text-(--color-text-primary) outline-none"
                />
                <button
                  onClick={() => handleRedeemGiftCard(selectedOrder._id, gcCode, gcAmount)}
                  className="px-4 py-2.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-xl border border-primary/20 hover:bg-primary hover:text-(--color-on-primary) transition-all"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {selectedOrder.status === 'COMPLETED' && selectedOrder.isRefunded && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-center">
              <p className="text-danger text-[10px] font-bold uppercase tracking-normal">Refunded</p>
              {selectedOrder.refundReason && (
                <p className="text-danger/70 text-[9px] font-medium normal-case mt-1">{selectedOrder.refundReason}</p>
              )}
            </div>
          )}

          {selectedOrder.status === 'COMPLETED' && !selectedOrder.isRefunded && canRefund && handleRefund && (
            <button
              onClick={() => handleRefund(selectedOrder._id)}
              className="w-full py-4 bg-danger/10 text-danger text-[10px] font-bold uppercase tracking-normal rounded-xl border border-danger/20 hover:bg-danger hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} /> Refund Order
            </button>
          )}

          {canDeleteOrder && selectedOrder.status !== 'COMPLETED' && (
            <button
              onClick={() => handleDeleteOrder(selectedOrder._id)}
              className="w-full py-4 bg-danger/5 text-danger/40 text-[9px] font-bold uppercase tracking-normal rounded-xl border border-danger/10 hover:bg-danger hover:text-white transition-all mt-2"
            >
              Delete Order
            </button>
          )}
          <button className="w-full py-4 text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Printer size={14} /> Print Order
          </button>
        </div>
      </div>
    </Modal>
  );
}
