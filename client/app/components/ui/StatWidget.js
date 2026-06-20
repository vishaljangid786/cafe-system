'use client';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, HdIcon, PiIcon } from 'lucide-react';

export const StatWidget = ({ label, value, icon: Icon, trend, isUp, color = 'amber', delay = 0 }) => {
  const colorMap = {
    amber: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    green: 'bg-[rgba(var(--color-success-rgb),0.12)] text-[var(--color-success)]',
    blue: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    red: 'bg-[rgba(var(--color-danger-rgb),0.12)] text-[var(--color-danger)]',
    rose: 'bg-[rgba(var(--color-danger-rgb),0.12)] text-[var(--color-danger)]',
    indigo: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="card rounded-xl p-5 relative transition-colors duration-200 hover:border-[var(--color-border-strong)]"
    >
      <div className="flex justify-between items-start">
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          <Icon size={20} />
        </div>

        {trend && (
          <div className={`flex items-center px-2 py-1 rounded-md text-xs font-medium ${isUp
            ? 'bg-[rgba(var(--color-success-rgb),0.1)] text-[var(--color-success)]'
            : 'bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)]'
            }`}>
            {isUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
            {trend}
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="label">
          {label}
        </p>
        <div className="flex items-baseline mt-1 space-x-1">
          <p className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">
            {value}
          </p>
          {trend && (
            <span className={`text-xs ${isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              vs last month
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
