import Modal from '../../../components/ui/Modal';
import { Zap, Printer } from 'lucide-react';

export default function OrderDetailsModal({ selectedOrder, onClose, handleCancel, handleForceComplete, handleDeleteOrder, userRole }) {
  if (!selectedOrder) return null;

  return (
    <Modal
      isOpen={!!selectedOrder}
      onClose={onClose}
      title="Signal Dossier"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-10 p-2">
        <div className="flex items-center justify-between p-8 bg-zinc-900 text-white rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
            <Zap size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest rounded border border-primary/20">SECURE SIGNAL</span>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">#{selectedOrder._id}</span>
            </div>
            <h3 className="text-3xl font-black tracking-tighter">Table {selectedOrder.table?.tableNumber}</h3>
            <p className="text-xs font-bold text-white/60 mt-1 uppercase tracking-widest">{selectedOrder.branch?.name} / {new Date(selectedOrder.createdAt).toLocaleTimeString()}</p>
          </div>
          <div className="relative z-10 text-right">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Value</p>
            <p className="text-4xl font-black text-primary tracking-tighter">₹{selectedOrder.totalAmount}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-1 w-6 bg-primary rounded-full" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Payload Contents</h4>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {selectedOrder.items.map((item, idx) => (
              <div key={idx} className="p-5 bg-[var(--color-surface-soft)] rounded-[1.5rem] border border-[var(--color-border)] flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center border border-[var(--color-border)] text-primary group-hover:scale-110 transition-transform">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[var(--color-text-primary)]">{item.menuItem?.name}</p>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{item.quantity} Units x ₹{item.menuItem?.price}</p>
                  </div>
                </div>
                <span className="text-xs font-black text-[var(--color-text-primary)]">₹{item.quantity * (item.menuItem?.price || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-[var(--color-border)]">
          {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(selectedOrder.status) && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleCancel(selectedOrder._id)}
                className="py-4 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
              >
                Terminate Order
              </button>
              <button
                onClick={() => handleForceComplete(selectedOrder._id)}
                className="py-4 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
              >
                Finalize Delivery
              </button>
            </div>
          )}
          {selectedOrder.status === 'COMPLETED' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Order Finished: Saved</p>
            </div>
          )}

          {['admin', 'super_admin'].includes(userRole) && selectedOrder.status !== 'COMPLETED' && (
            <button
              onClick={() => handleDeleteOrder(selectedOrder._id)}
              className="w-full py-4 bg-rose-500/5 text-rose-500/40 text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl border border-rose-500/10 hover:bg-rose-600 hover:text-white transition-all mt-2"
            >
              Delete Order Record
            </button>
          )}
          <button className="w-full py-4 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.4em] hover:text-primary transition-colors flex items-center justify-center gap-2">
            <Printer size={14} /> Print Order Blueprint
          </button>
        </div>
      </div>
    </Modal>
  );
}
