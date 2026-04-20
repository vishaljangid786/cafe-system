'use client';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const StatWidget = ({ label, value, icon: Icon, trend, isUp, color = 'amber' }) => {
  const colorMap = {
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="glass-card rounded-3xl p-6 relative overflow-hidden group"
    >
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-3 rounded-2xl border ${colorMap[color]} group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-black px-2 py-1 rounded-full ${isUp ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {isUp ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
            {trend}
          </div>
        )}
      </div>
      
      <div className="mt-6 relative z-10">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <p className="text-3xl font-black text-foreground mt-1 tracking-tighter">{value}</p>
      </div>

      {/* Decorative Gradient Background */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-20 transition-opacity duration-300 group-hover:opacity-40 ${colorMap[color].split(' ')[1].replace('text-', 'bg-')}`} />
    </motion.div>
  );
};
