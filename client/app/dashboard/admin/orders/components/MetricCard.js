import { CardHover } from '../../../../components/ui/AnimatedContainer';

export default function MetricCard({ label, value, sub, icon: Icon, color }) {
  const themes = {
    primary: 'text-primary bg-(--color-primary-soft)',
    rose: 'text-danger bg-[rgba(var(--color-danger-rgb),0.1)]',
    emerald: 'text-success bg-[rgba(var(--color-success-rgb),0.1)]',
  };
  const theme = themes[color] || themes.primary;

  return (
    <CardHover>
      <div className="card p-5 rounded-xl h-full transition-colors duration-200 hover:border-(--color-border-strong)">
        <div className={`h-11 w-11 rounded-xl ${theme} flex items-center justify-center`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="mt-4">
          <p className="label">{label}</p>
          <h4 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight mt-1 leading-none">
            {value}
          </h4>
          <p className="text-[11px] font-medium text-(--color-text-muted) mt-2">{sub}</p>
        </div>
      </div>
    </CardHover>
  );
}
