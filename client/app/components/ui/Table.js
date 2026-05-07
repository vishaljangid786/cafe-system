'use client';
import { motion } from 'framer-motion';

export const Table = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto custom-scrollbar ${className}`}>
    <table className="w-full min-w-[640px] text-left border-separate border-spacing-0">
      {children}
    </table>
  </div>
);

export const THead = ({ children }) => (
  <thead className="bg-[var(--color-bg-soft)]/50 backdrop-blur-sm sticky top-0 z-10">
    {children}
  </thead>
);

export const TBody = ({ children }) => (
  <tbody className="divide-y divide-[var(--color-border)]">
    {children}
  </tbody>
);

export const TH = ({ children, className = '' }) => (
  <th className={`px-3 sm:px-6 py-3 sm:py-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[var(--color-text-muted)] border-b border-[var(--color-border)] ${className}`}>
    {children}
  </th>
);

export const TR = ({ children, className = '', index = 0 }) => (
  <motion.tr
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3, delay: index * 0.05 }}
    className={`group hover:bg-[var(--color-primary)]/5 transition-colors duration-300 ${className}`}
  >
    {children}
  </motion.tr>
);

export const TD = ({ children, className = '' }) => (
  <td className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[var(--color-text-secondary)] transition-colors ${className}`}>
    {children}
  </td>
);
