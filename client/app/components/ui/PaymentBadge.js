import { Banknote, Smartphone, CreditCard, Globe, Gift, Wallet } from 'lucide-react';

// Small chip that shows how an order was paid. Used across the staff and admin
// order views (cards, table rows, details modal) so the payment method reads
// consistently everywhere.
const CONFIG = {
  CASH: { label: 'Cash', icon: Banknote, cls: 'text-success bg-success/10 border-success/20' },
  UPI: { label: 'UPI', icon: Smartphone, cls: 'text-primary bg-primary/10 border-primary/20' },
  CARD: { label: 'Card', icon: CreditCard, cls: 'text-secondary bg-secondary/10 border-secondary/20' },
  ONLINE: { label: 'Online', icon: Globe, cls: 'text-warning bg-warning/10 border-warning/20' },
  GIFT_CARD: { label: 'Gift card', icon: Gift, cls: 'text-secondary bg-secondary/10 border-secondary/20' },
  OTHER: { label: 'Other', icon: Wallet, cls: 'text-(--color-text-muted) bg-(--color-surface-soft) border-(--color-border)' },
};

export default function PaymentBadge({ method, size = 'sm', className = '' }) {
  const cfg = CONFIG[method] || CONFIG.OTHER;
  const Icon = cfg.icon;
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const iconSize = size === 'xs' ? 11 : 12;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium tracking-normal ${pad} ${cfg.cls} ${className}`}>
      <Icon size={iconSize} /> {cfg.label}
    </span>
  );
}
