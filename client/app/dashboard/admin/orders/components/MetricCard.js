import { CardHover } from '../../../../components/ui/AnimatedContainer';

export default function MetricCard({ label, value, sub, icon: Icon, color }) {
  const themes = {
    primary: 'text-primary bg-primary/10 border-primary/20 shadow-primary/10',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-rose-500/10',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10'
  };

  const theme = themes[color] || themes.primary;

  return (
    <CardHover>
      <div className="relative bg-[var(--color-surface)]/60 backdrop-blur-md p-8 rounded-[2.5rem] border border-[var(--color-border)] flex flex-col items-center text-center group hover:border-primary/40 transition-all duration-500 shadow-xl overflow-hidden h-full">
        <div className={`h-16 w-16 rounded-2xl ${theme} flex items-center justify-center mb-6 border-2 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl`}>
          <Icon size={28} strokeWidth={2.5} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-text-muted)] mb-3">{label}</p>
        <h4 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter mb-1 relative">
          {value}
          <span className="absolute -top-1 -right-4 h-1.5 w-1.5 rounded-full bg-primary animate-ping opacity-0 group-hover:opacity-100 transition-opacity" />
        </h4>
        <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight mt-1 opacity-60">{sub}</p>
      </div>
    </CardHover>
  );
}
