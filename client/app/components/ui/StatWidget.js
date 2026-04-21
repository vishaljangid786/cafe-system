'use client';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';

export const StatWidget = ({ label, value, icon: Icon, trend, isUp, color = 'amber', delay = 0 }) => {
  const colorMap = {
    amber: 'from-amber-500/20 to-amber-600/5 text-amber-500 border-amber-500/20',
    green: 'from-emerald-500/20 to-emerald-600/5 text-emerald-500 border-emerald-500/20',
    blue: 'from-blue-500/20 to-blue-600/5 text-blue-500 border-blue-500/20',
    red: 'from-rose-500/20 to-rose-600/5 text-rose-500 border-rose-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="glass-card rounded-2xl p-5 relative overflow-hidden group border border-white/5 dark:border-zinc-800/50"
    >
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${colorMap[color]} group-hover:scale-110 transition-transform duration-500 shadow-lg`}>
          <Icon size={20} />
        </div>

        {trend && (
          <div className={`flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${isUp
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
            }`}>
            {isUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
            {trend}
          </div>
        )}
      </div>

      <div className="mt-5 relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <div className="flex items-baseline mt-1 space-x-1">
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {value}
          </p>
          {trend && (
            <span className={`text-[10px] font-medium ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
              vs last month
            </span>
          )}
        </div>
      </div>

      {/* Decorative inner glow */}
      <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-[40px] opacity-10 transition-opacity duration-500 group-hover:opacity-30 pointer-events-none ${color === 'amber' ? 'bg-amber-500' : color === 'green' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-500' : 'bg-rose-500'
        }`} />
    </motion.div>
  );
};
