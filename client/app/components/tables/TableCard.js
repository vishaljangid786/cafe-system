"use client"
import { Coffee, Users, Zap, Plus, Clock, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';
import { CardHover } from '../ui/AnimatedContainer';
import { Button } from '../ui/Button';

export default function TableCard({ table, onAssign, onManage }) {
  const isAvailable = table.status === 'available';
  const isOccupied = table.status === 'occupied' || table.status === 'booked';
  const isReserved = table.status === 'reserved';

  const statusColors = {
    available: 'bg-emerald-500',
    booked: 'bg-rose-500', // Occupied
    occupied: 'bg-rose-500',
    reserved: 'bg-amber-500',
  };

  const statusTextColors = {
    available: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
    booked: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400',
    occupied: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400',
    reserved: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400',
  };

  // Safe calculation for total amount to avoid NaN
  const safeTotal = Number(table.totalAmount) || 0;

  return (
    <CardHover>
      <div className={`
        bg-white dark:bg-zinc-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border relative group transition-all duration-500 flex flex-col h-full
        ${isAvailable ? 'border-zinc-200 dark:border-zinc-800' : 'border-amber-500/30 shadow-lg shadow-amber-500/5'}
      `}>
        {/* Status Indicator */}
        <div className="absolute top-8 right-8 flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${statusColors[table.status]} shadow-[0_0_12px_rgba(0,0,0,0.1)] ring-4 ring-white dark:ring-zinc-900`} />
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block mb-1">Terminal</span>
            <h3 className="text-5xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">T{table.tableNumber}</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current opacity-80 ${statusTextColors[table.status]}`}>
              {isOccupied ? 'Occupied' : table.status}
            </span>
            {isOccupied && (
              <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center gap-1.5">
                <Users size={10} /> {table.numberOfPeople || 0} Members
              </span>
            )}
          </div>

          {isOccupied && (
            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Clock size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Active Session</span>
                </div>
                <span className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                  {table.orders?.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)} Units
                </span>
              </div>
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Running Bill</span>
                  <span className="text-2xl font-black text-amber-600 tracking-tight">₹{safeTotal.toLocaleString()}</span>
                </div>
                <Receipt className="text-zinc-300 dark:text-zinc-700" size={24} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4">
          <Button
            variant={isAvailable ? 'outline' : 'primary'}
            className={`w-full !rounded-[1.5rem] !py-4 text-xs font-black uppercase tracking-widest transition-all ${isAvailable ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800' : 'shadow-lg shadow-amber-500/20'}`}
            icon={isAvailable ? Plus : Zap}
            onClick={() => isAvailable ? onAssign(table) : onManage(table)}
          >
            {isAvailable ? 'Assign Table' : 'Manage Session'}
          </Button>
        </div>
      </div>
    </CardHover>
  );
}
