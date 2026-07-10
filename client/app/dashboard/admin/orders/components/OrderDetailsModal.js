import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import PremiumSelect from '../../../../components/ui/PremiumSelect';
import PaymentBadge from '../../../../components/ui/PaymentBadge';
import { Money } from '../../../../components/ui/Money';
import { Zap, Printer, RotateCcw, Scissors } from 'lucide-react';
import toast from 'react-hot-toast';

// Minimal HTML escaping so item names / ids can't break out of the print markup.
const esc = (val) => String(val ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const PAYMENT_CHIP = {
  paid: 'text-success bg-success/10 border-success/20',
  partial: 'text-secondary bg-secondary/10 border-secondary/20',
  unpaid: 'text-danger bg-danger/10 border-danger/20',
};

export default function OrderDetailsModal({ selectedOrder, onClose, handleCancel, handleForceComplete, handleDeleteOrder, handleRefund, handleReorder, handleMoveTable, handleSplit, handleRedeemGiftCard, tables = [], userRole, canDelete, canRefund: canRefundProp }) {
  const [showSplit, setShowSplit] = useState(false);
  const [splitQty, setSplitQty] = useState({}); // itemId -> qty to split off
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

  const handlePrint = () => {
    const rows = (selectedOrder.items || []).map((item) => {
      const name = item.menuItem?.name || item.itemName || 'Item';
      const price = Number(item.menuItem?.price || item.price || 0);
      const qty = Number(item.quantity || 0);
      return `<tr>
        <td class="uppercase font-bold">${esc(name)}</td>
        <td class="text-center">${qty}</td>
        <td class="text-center">&#8377;${price.toLocaleString('en-IN')}</td>
        <td class="text-right">&#8377;${(price * qty).toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');

    const statusLabel = selectedOrder.isRefunded ? 'REFUNDED' : String(payStatus).toUpperCase();

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the order.');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Order ${esc(selectedOrder._id)}</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { font-family: 'Courier New', Courier, monospace; width: 320px; margin: 20px auto; padding: 16px; font-size: 12px; color: #000; background: #fff; }
            .text-center { text-align: center; } .text-right { text-align: right; }
            .font-bold { font-weight: 900; } .uppercase { text-transform: uppercase; } .italic { font-style: italic; }
            .muted { color: #555; }
            .flex { display: flex; justify-content: space-between; }
            .divider { border-top: 1px dashed #000; margin: 12px 0; }
            .big { font-size: 16px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 4px; }
            th { border-bottom: 1px solid #000; font-weight: 900; text-align: left; padding-bottom: 4px; }
            td { padding: 4px 0; vertical-align: top; }
            @media print { body { width: 320px; margin: 0 auto; padding: 8mm; } }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h2 class="big uppercase" style="margin:0;">${esc(selectedOrder.branch?.name || 'CafeOS')}</h2>
            <p class="muted" style="margin:2px 0;">${esc(orderTypeLabel)}</p>
            <p class="muted" style="margin:2px 0;">${esc(new Date(selectedOrder.createdAt).toLocaleString())}</p>
          </div>
          <div class="divider"></div>
          <div class="flex"><span class="font-bold">ORDER ID:</span><span>#${esc(selectedOrder._id)}</span></div>
          <div class="flex"><span class="font-bold">PAYMENT:</span><span>${esc(selectedOrder.paymentType || 'CASH')} / ${esc(statusLabel)}</span></div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr><th>ITEM</th><th class="text-center">QTY</th><th class="text-center">RATE</th><th class="text-right">AMT</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="divider"></div>
          <div class="flex big"><span>TOTAL:</span><span>&#8377;${Number(selectedOrder.totalAmount || 0).toLocaleString('en-IN')}</span></div>
          <div class="divider"></div>
          <div class="text-center italic muted">
            <p style="margin:2px 0;">Thank you!</p>
            <p style="margin:2px 0;">*** End of Receipt ***</p>
          </div>
          <script>
            window.onload = function () {
              setTimeout(function () { window.print(); window.close(); }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
            <p className="text-4xl font-bold text-primary tracking-tight"><Money value={selectedOrder.totalAmount} /></p>
            <div className="flex justify-end items-center gap-2 mt-2">
              <PaymentBadge method={selectedOrder.paymentType || 'CASH'} size="xs" />
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
                    <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">{item.quantity} x <Money value={item.menuItem?.price} /></p>
                  </div>
                </div>
                <span className="text-xs font-bold text-(--color-text-primary)"><Money value={item.quantity * (item.menuItem?.price || 0)} /></span>
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
          <button
            onClick={handlePrint}
            className="w-full py-4 text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal hover:text-primary transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={14} /> Print Order
          </button>
        </div>
      </div>
    </Modal>
  );
}
