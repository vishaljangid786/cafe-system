import { CardHover } from '../../../../components/ui/AnimatedContainer';

export default function MetricCard({ label, value, sub, icon: Icon, color }) {
  const themes = {
    primary: 'text-[var(--color-primary)] bg-[var(--color-primary-soft)] border-[var(--color-border)]',
    rose: 'text-[var(--color-danger)] bg-[rgba(var(--color-danger-rgb),0.1)] border-[var(--color-border)]',
    emerald: 'text-[var(--color-success)] bg-[rgba(var(--color-success-rgb),0.1)] border-[var(--color-border)]'
  };

  const theme = themes[color] || themes.primary;

  return (
    <CardHover>
      <div className="card p-6 rounded-xl flex flex-col items-center text-center transition-colors duration-200 hover:border-[var(--color-border-strong)] h-full">
        <div className={`h-14 w-14 rounded-xl ${theme} flex items-center justify-center mb-4 border`}>
          <Icon size={26} strokeWidth={2} />
        </div>
        <p className="label mb-2">{label}</p>
        <h4 className="text-3xl font-bold text-[var(--color-text-primary)] mb-1">
          {value}
        </h4>
        <p className="text-xs font-medium text-[var(--color-text-muted)] mt-1">{sub}</p>
      </div>
    </CardHover>
  );
}
