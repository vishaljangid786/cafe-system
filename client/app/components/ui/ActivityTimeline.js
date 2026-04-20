'use client';
import { motion } from 'framer-motion';

export const ActivityTimeline = ({ items }) => {
  return (
    <div className="space-y-6">
      {items.map((item, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex gap-4 relative"
        >
          {idx !== items.length - 1 && (
            <div className="absolute left-[19px] top-8 bottom-[-24px] w-0.5 bg-border" />
          )}
          
          <div className={`
            h-10 w-10 rounded-xl shrink-0 flex items-center justify-center z-10
            ${item.type === 'order' ? 'bg-amber-500/10 text-amber-500' : 
              item.type === 'system' ? 'bg-blue-500/10 text-blue-500' : 
              'bg-green-500/10 text-green-500'}
          `}>
            {item.icon}
          </div>
          
          <div className="flex flex-col pt-1">
            <h4 className="text-sm font-bold text-foreground leading-none">{item.title}</h4>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">
              {item.description}
            </p>
            <span className="text-[10px] text-muted-foreground/60 mt-2 font-bold uppercase tracking-widest">
              {item.time}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
