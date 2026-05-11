import { motion } from 'framer-motion';
import { Timer, Zap } from 'lucide-react';

export default function AdminOrderCard({ order, onCancel, onForceComplete, userRole }) {
  const statusColors = {
    'PLACED': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'ACCEPTED': 'bg-primary/10 text-primary border-primary/20',
    'PREPARING': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'READY': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'SERVED': 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]',
    'CANCELLED': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    'REJECTED': 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  };

  const isDelayed = !['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && 
    (new Date() - new Date(order.createdAt)) / 1000 / 60 > 15;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={`bg-[var(--color-surface)] border ${isDelayed ? 'animate-pulse-danger' : 'border-[var(--color-border)]'} p-8 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all relative group overflow-hidden h-full flex flex-col`}>
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity -rotate-12">
          <Zap size={80} />
        </div>

        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block border ${statusColors[order.status]}`}>
              {order.status}
              {isDelayed && <span className="ml-2 opacity-60">!! DELAYED</span>}
            </div>
            <h4 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter mt-3">
              Table {order.table?.tableNumber || '??'}
            </h4>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Sector: {order.branch?.name}</p>
          </div>
          {isDelayed && (
            <div className="bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 text-rose-500">
              <Timer size={18} />
            </div>
          )}
        </div>

        <div className="space-y-3 mb-10 flex-1 relative z-10">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)]/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-emerald-500' : 'bg-rose-500'} shadow-lg`} />
                <span className="text-xs font-bold text-[var(--color-text-primary)]">{item.quantity}x {item.menuItem?.name}</span>
              </div>
              <span className="text-[10px] font-black text-[var(--color-text-muted)]">₹{item.menuItem?.price * item.quantity}</span>
            </div>
          ))}
        </div>

        {!['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
          <div className="pt-8 border-t border-[var(--color-border)] flex items-center justify-between gap-4 relative z-10">
            <button
              onClick={() => onCancel(order._id)}
              className="flex-1 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-rose-500 bg-rose-500/5 hover:bg-rose-500 hover:text-white rounded-2xl border border-rose-500/10 transition-all active:scale-95"
            >
              Terminate
            </button>
            {['admin', 'super_admin'].includes(userRole) && (
              <button
                onClick={() => onForceComplete(order._id)}
                className="flex-1 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white rounded-2xl border border-emerald-500/10 transition-all active:scale-95 shadow-lg shadow-emerald-500/5"
              >
                Fulfill
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
