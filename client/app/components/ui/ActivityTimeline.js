'use client';
import { motion } from 'framer-motion';

export const ActivityTimeline = ({ items }) => {
  return (
    <div className="space-y-8 relative">
      {items.map((item, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1, duration: 0.5 }}
          className="flex gap-6 relative group"
        >
          {/* Timeline Line */}
          {idx !== items.length - 1 && (
            <div className="absolute left-[19px] top-10 bottom-[-32px] w-[1px] bg-gradient-to-b from-[var(--color-border)] via-[var(--color-border)]/50 to-transparent" />
          )}

          {/* Icon Container */}
          <div className={`
            h-10 w-10 rounded-xl shrink-0 flex items-center justify-center z-10 
            border border-[var(--color-border)] shadow-lg
            transition-transform duration-300 group-hover:scale-110
            ${item.type === 'order' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' :
              item.type === 'system' ? 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]' :
                'bg-[var(--color-success)]/10 text-[var(--color-success)]'}
          `}>
            {item.icon}
          </div>

          {/* Content */}
          <div className="flex flex-col pt-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[var(--color-text-primary)] leading-none group-hover:text-[var(--color-primary)] transition-colors">
                {item.title}
              </h4>
              <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">
                {item.time}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 font-medium leading-relaxed max-w-[240px]">
              {item.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
