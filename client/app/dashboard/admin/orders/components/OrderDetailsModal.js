import Modal from '../../../../components/ui/Modal';
import { Zap, Printer } from 'lucide-react';

export default function OrderDetailsModal({ selectedOrder, onClose, handleCancel, handleForceComplete, handleDeleteOrder, userRole }) {
  if (!selectedOrder) return null;

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
            <h3 className="text-3xl font-bold tracking-tight">Table {selectedOrder.table?.tableNumber}</h3>
            <p className="text-xs font-bold text-white/60 mt-1 uppercase tracking-normal">{selectedOrder.branch?.name} / {new Date(selectedOrder.createdAt).toLocaleTimeString()}</p>
          </div>
          <div className="relative z-10 text-right">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-normal mb-1">Total Amount</p>
            <p className="text-4xl font-bold text-primary tracking-tight">₹{selectedOrder.totalAmount}</p>
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

          {['admin', 'super_admin'].includes(userRole) && selectedOrder.status !== 'COMPLETED' && (
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
