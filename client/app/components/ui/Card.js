'use client';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', hover = true }) => {
  return (
    <motion.div
      whileHover={hover ? { y: -5, shadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' } : {}}
      className={`
        glass-card rounded-3xl p-6 transition-all duration-300
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
};

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-xl font-black tracking-tight text-foreground ${className}`}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-sm text-muted-foreground font-medium ${className}`}>
    {children}
  </p>
);
