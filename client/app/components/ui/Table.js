'use client';
import { motion } from 'framer-motion';

export const Table = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto custom-scrollbar ${className}`}>
    <table className="w-full text-left border-separate border-spacing-0">
      {children}
    </table>
  </div>
);

export const THead = ({ children }) => (
  <thead className="bg-zinc-100/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
    {children}
  </thead>
);

export const TBody = ({ children }) => (
  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
    {children}
  </tbody>
);

export const TH = ({ children, className = '' }) => (
  <th className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 ${className}`}>
    {children}
  </th>
);

export const TR = ({ children, className = '', index = 0 }) => (
  <motion.tr
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3, delay: index * 0.05 }}
    className={`group hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors duration-200 ${className}`}
  >
    {children}
  </motion.tr>
);

export const TD = ({ children, className = '' }) => (
  <td className={`px-6 py-4 text-sm text-zinc-700 dark:text-zinc-300 transition-colors ${className}`}>
    {children}
  </td>
);
