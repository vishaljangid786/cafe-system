'use client';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', hover = true, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? {
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" }
      } : {}}
      className={`
        glass-card rounded-2xl p-6 relative overflow-hidden group
        hover-glow focus-ring
        ${className}
      `}
    >
      {/* Decorative inner glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Subtle border accent */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-lg font-bold tracking-tight text-[var(--color-text-primary)] ${className}`}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-[var(--color-text-muted)] font-medium leading-relaxed ${className}`}>
    {children}
  </p>
);
