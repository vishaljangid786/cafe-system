import { motion } from 'framer-motion';
import { Timer, Zap } from 'lucide-react';
import PaymentBadge from '../../../../components/ui/PaymentBadge';

export default function AdminOrderCard({ order, onCancel, onForceComplete, userRole }) {
  const statusColors = {
    'PLACED': 'bg-[rgba(var(--color-warning-rgb),0.1)] text-warning border-(--color-border)',
    'ACCEPTED': 'bg-(--color-primary-soft) text-primary border-(--color-border)',
    'PREPARING': 'bg-(--color-primary-soft) text-primary border-(--color-border)',
    'READY': 'bg-[rgba(var(--color-success-rgb),0.1)] text-success border-(--color-border)',
    'SERVED': 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)',
    'CANCELLED': 'bg-[rgba(var(--color-danger-rgb),0.1)] text-danger border-(--color-border)',
    'REJECTED': 'bg-[rgba(var(--color-danger-rgb),0.1)] text-danger border-(--color-border)'
  };

  const isDelayed = !['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) &&
    (new Date() - new Date(order.createdAt)) / 1000 / 60 > 15;

  // Order type — takeaway/delivery have no table; dine-in shows the table number.
  const typeLabel = order.orderType === 'takeaway' ? 'Takeaway'
    : order.orderType === 'delivery' ? 'Delivery'
    : 'Dine-in';

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={`card ${isDelayed ? 'animate-pulse-danger' : ''} p-6 rounded-xl transition-colors duration-200 hover:border-(--color-border-strong) relative h-full flex flex-col`}>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-block border ${statusColors[order.status]}`}>
                {order.status}
                {isDelayed && <span className="ml-2 opacity-70">Delayed</span>}
              </div>
              <div className="px-2.5 py-1 rounded-md text-xs font-semibold inline-block border border-(--color-border) bg-(--color-surface-soft) text-(--color-text-muted) uppercase tracking-normal">
                {typeLabel}
              </div>
              <PaymentBadge method={order.paymentType || 'CASH'} size="xs" />
            </div>
            <h4 className="text-xl font-bold text-(--color-text-primary) mt-3">
              {order.orderType && order.orderType !== 'dine-in'
                ? typeLabel
                : `Table ${order.table?.tableNumber || '??'}`}
            </h4>
            <p className="text-xs font-medium text-(--color-text-muted) mt-1">{order.branch?.cafe?.name ? `${order.branch.cafe.name} · ` : ''}Branch: {order.branch?.name}</p>
            {order.createdBy?.name && (
              <p className="text-[11px] font-semibold text-(--color-text-secondary) mt-1">Placed by {order.createdBy.name}</p>
            )}
          </div>
          {isDelayed && (
            <div className="bg-[rgba(var(--color-danger-rgb),0.1)] p-2 rounded-lg border border-(--color-border) text-danger">
              <Timer size={18} />
            </div>
          )}
        </div>

        <div className="space-y-2 mb-6 flex-1 relative z-10">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-(--color-border) last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-success' : 'bg-danger'}`} />
                <span className="text-sm font-medium text-(--color-text-primary)">{item.quantity}x {item.menuItem?.name}</span>
              </div>
              <span className="text-xs font-semibold text-(--color-text-muted)">₹{item.menuItem?.price * item.quantity}</span>
            </div>
          ))}
        </div>

        {!['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status) && (
          <div className="pt-5 border-t border-(--color-border) flex items-center justify-between gap-3 relative z-10">
            <button
              onClick={() => onCancel(order._id)}
              className="flex-1 py-2.5 text-xs font-semibold text-danger bg-[rgba(var(--color-danger-rgb),0.08)] hover:bg-danger hover:text-white rounded-lg border border-(--color-border) transition-colors"
            >
              Cancel
            </button>
            {['admin', 'super_admin'].includes(userRole) && (
              <button
                onClick={() => onForceComplete(order._id)}
                className="flex-1 py-2.5 text-xs font-semibold text-success bg-[rgba(var(--color-success-rgb),0.08)] hover:bg-success hover:text-white rounded-lg border border-(--color-border) transition-colors"
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
