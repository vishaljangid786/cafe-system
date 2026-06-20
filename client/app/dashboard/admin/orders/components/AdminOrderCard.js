import { motion } from 'framer-motion';
import { Timer, Zap } from 'lucide-react';

export default function AdminOrderCard({ order, onCancel, onForceComplete, userRole }) {
  const statusColors = {
    'PLACED': 'bg-[rgba(var(--color-warning-rgb),0.1)] text-[var(--color-warning)] border-[var(--color-border)]',
    'ACCEPTED': 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]',
    'PREPARING': 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]',
    'READY': 'bg-[rgba(var(--color-success-rgb),0.1)] text-[var(--color-success)] border-[var(--color-border)]',
    'SERVED': 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]',
    'CANCELLED': 'bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)] border-[var(--color-border)]',
    'REJECTED': 'bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)] border-[var(--color-border)]'
  };

  const isDelayed = !['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && 
    (new Date() - new Date(order.createdAt)) / 1000 / 60 > 15;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={`card ${isDelayed ? 'animate-pulse-danger' : ''} p-6 rounded-xl transition-colors duration-200 hover:border-[var(--color-border-strong)] relative h-full flex flex-col`}>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <div className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-block border ${statusColors[order.status]}`}>
              {order.status}
              {isDelayed && <span className="ml-2 opacity-70">Delayed</span>}
            </div>
            <h4 className="text-xl font-bold text-[var(--color-text-primary)] mt-3">
              Table {order.table?.tableNumber || '??'}
            </h4>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mt-1">Branch: {order.branch?.name}</p>
          </div>
          {isDelayed && (
            <div className="bg-[rgba(var(--color-danger-rgb),0.1)] p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-danger)]">
              <Timer size={18} />
            </div>
          )}
        </div>

        <div className="space-y-2 mb-6 flex-1 relative z-10">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{item.quantity}x {item.menuItem?.name}</span>
              </div>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">₹{item.menuItem?.price * item.quantity}</span>
            </div>
          ))}
        </div>

        {!['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
          <div className="pt-5 border-t border-[var(--color-border)] flex items-center justify-between gap-3 relative z-10">
            <button
              onClick={() => onCancel(order._id)}
              className="flex-1 py-2.5 text-xs font-semibold text-[var(--color-danger)] bg-[rgba(var(--color-danger-rgb),0.08)] hover:bg-[var(--color-danger)] hover:text-white rounded-lg border border-[var(--color-border)] transition-colors"
            >
              Cancel
            </button>
            {['admin', 'super_admin'].includes(userRole) && (
              <button
                onClick={() => onForceComplete(order._id)}
                className="flex-1 py-2.5 text-xs font-semibold text-[var(--color-success)] bg-[rgba(var(--color-success-rgb),0.08)] hover:bg-[var(--color-success)] hover:text-white rounded-lg border border-[var(--color-border)] transition-colors"
              >
                Complete
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
