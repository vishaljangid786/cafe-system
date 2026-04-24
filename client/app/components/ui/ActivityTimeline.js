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
            <div className="absolute left-[19px] top-10 bottom-[-32px] w-[1px] bg-gradient-to-b from-zinc-200 dark:from-zinc-800 via-zinc-200/50 dark:via-zinc-800/50 to-transparent" />
          )}

          {/* Icon Container */}
          <div className={`
            h-10 w-10 rounded-xl shrink-0 flex items-center justify-center z-10 
            border border-zinc-200 dark:border-zinc-800/50 shadow-lg
            transition-transform duration-300 group-hover:scale-110
            ${item.type === 'order' ? 'bg-amber-500/10 text-amber-500' :
              item.type === 'system' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400' :
                'bg-emerald-500/10 text-emerald-500'}
          `}>
            {item.icon}
          </div>

          {/* Content */}
          <div className="flex flex-col pt-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none group-hover:text-amber-500 transition-colors">
                {item.title}
              </h4>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                {item.time}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium leading-relaxed max-w-[240px]">
              {item.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
