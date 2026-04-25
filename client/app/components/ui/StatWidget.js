'use client';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, HdIcon } from 'lucide-react';

export const StatWidget = ({ label, value, icon: Icon, trend, isUp, color = 'amber', delay = 0 }) => {
  const colorMap = {
    amber: 'from-primary/20 to-primary-dark/5 text-primary border-primary/20',
    green: 'from-[var(--color-success)]/20 to-[var(--color-success)]/5 text-[var(--color-success)] border-[var(--color-success)]/20',
    blue: 'from-[var(--color-secondary)]/20 to-[var(--color-secondary-dark)]/5 text-[var(--color-secondary)] border-[var(--color-secondary)]/20',
    red: 'from-[var(--color-danger)]/20 to-[var(--color-danger)]/5 text-[var(--color-danger)] border-[var(--color-danger)]/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      className="glass-card rounded-2xl p-5 relative overflow-hidden group border border-[var(--color-border)]/50 hover-glow focus-ring"
    >
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${colorMap[color]} group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
          <HdIcon size={20} />
        </div>

        {trend && (
          <div className={`flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${isUp
            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20'
            : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20'
            }`}>
            {isUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
            {trend}
          </div>
        )}
      </div>

      <div className="mt-5 relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          {label}
        </p>
        <div className="flex items-baseline mt-1 space-x-1">
          <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {value}
          </p>
          {trend && (
            <span className={`text-[10px] font-medium ${isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              vs last month
            </span>
          )}
        </div>
      </div>

      {/* Decorative inner glow */}
      <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-[40px] opacity-10 transition-opacity duration-500 group-hover:opacity-30 pointer-events-none ${color === 'amber' ? 'bg-primary' : color === 'green' ? 'bg-[var(--color-success)]' : color === 'blue' ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-danger)]'
        }`} />
    </motion.div>
  );
};
