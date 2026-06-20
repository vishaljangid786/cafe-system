'use client';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', hover = true, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`
        card rounded-xl p-6 relative
        ${hover ? 'transition-colors duration-200 hover:border-[var(--color-border-strong)]' : ''}
        ${className}
      `}
    >
      {children}
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
