'use client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

// KPI tile for the overview dashboards. Styled to match the Cash Flow card's
// tiles: a soft colour wash over the surface, a tinted icon chip, an uppercase
// label and a bold value.
const TONES = {
  amber: { chip: 'bg-primary/15 text-primary', border: 'border-primary/20', grad: 'from-primary/8' },
  green: { chip: 'bg-success/15 text-success', border: 'border-success/20', grad: 'from-success/8' },
  blue: { chip: 'bg-primary/15 text-primary', border: 'border-primary/20', grad: 'from-primary/8' },
  red: { chip: 'bg-danger/15 text-danger', border: 'border-danger/20', grad: 'from-danger/8' },
  rose: { chip: 'bg-danger/15 text-danger', border: 'border-danger/20', grad: 'from-danger/8' },
  indigo: { chip: 'bg-primary/15 text-primary', border: 'border-primary/20', grad: 'from-primary/8' },
};

export const StatWidget = ({ label, value, sub, icon: Icon, trend, isUp, color = 'amber', delay = 0 }) => {
  const tone = TONES[color] || TONES.amber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`rounded-xl border ${tone.border} bg-(--color-surface) bg-linear-to-br ${tone.grad} to-transparent p-5 shadow-sm relative transition-shadow duration-200 hover:shadow-md`}
    >
      <div className="flex justify-between items-start">
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tone.chip}`}>
          <Icon size={20} strokeWidth={2.2} />
        </span>

        {trend && (
          <div className={`flex items-center px-2 py-1 rounded-md text-xs font-semibold ${isUp
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger'
            }`}>
            {isUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
            {trend}
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-muted)">
          {label}
        </p>
        <div className="flex items-baseline mt-1.5 gap-1.5">
          <p className="text-2xl font-bold text-(--color-text-primary) tracking-tight">
            {value}
          </p>
          {trend && (
            <span className={`text-xs ${isUp ? 'text-success' : 'text-danger'}`}>
              vs last month
            </span>
          )}
        </div>
        {sub && (
          <p className="mt-1 text-[11px] font-medium text-(--color-text-muted)">
            {sub}
          </p>
        )}
      </div>
    </motion.div>
  );
};
