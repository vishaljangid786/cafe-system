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
            <div className="absolute left-[19px] top-10 bottom-[-32px] w-[1px] bg-gradient-to-b from-(--color-border) via-(--color-border)/50 to-transparent" />
          )}

          {/* Icon Container */}
          <div className={`
            h-10 w-10 rounded-lg shrink-0 flex items-center justify-center z-10
            ${item.type === 'order' ? 'bg-(--color-primary-soft) text-primary' :
              item.type === 'system' ? 'bg-(--color-surface-soft) text-(--color-text-muted)' :
                'bg-[rgba(var(--color-success-rgb),0.12)] text-success'}
          `}>
            {item.icon}
          </div>

          {/* Content */}
          <div className="flex flex-col pt-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-(--color-text-primary) leading-none">
                {item.title}
              </h4>
              <span className="h-1 w-1 rounded-full bg-(--color-border-strong)" />
              <span className="text-xs text-(--color-text-muted)">
                {item.time}
              </span>
            </div>
            <p className="text-xs text-(--color-text-secondary) mt-1.5 leading-relaxed max-w-[240px]">
              {item.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
