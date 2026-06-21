"use client"
import { Coffee, Users, Zap, Plus, Clock, Receipt, MessageSquare, Pencil, Trash, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { CardHover } from '../ui/AnimatedContainer';
import { Button } from '../ui/Button';

export default function TableCard({ table, onAssign, onManage, onEdit, onDelete }) {
  const isAvailable = table.status === 'available';
  const isOccupied = table.status === 'occupied' || table.status === 'booked';
  const isReserved = table.status === 'reserved';
  const isAdmin = !!(onEdit || onDelete);

  const statusColors = {
    available: 'bg-[var(--color-success)]',
    booked: 'bg-[var(--color-danger)]', // Occupied
    occupied: 'bg-[var(--color-danger)]',
    ongoing: 'bg-[var(--color-secondary)]',
    reserved: 'bg-[var(--color-primary)]',
  };

  const statusTextColors = {
    available: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
    booked: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
    occupied: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
    ongoing: 'text-[var(--color-secondary)] bg-[var(--color-secondary)]/10',
    reserved: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10',
  };

  // Safe calculation for total amount to avoid NaN
  const safeTotal = Number(table.totalAmount) || 0;

  return (
    <CardHover>
      <div className={`
        glass-card p-8 rounded-xl border relative group transition-all duration-500 flex flex-col h-full min-h-[480px] w-full
        ${isAvailable ? 'border-[var(--color-border)]' : 'border-[var(--color-primary)]/30 shadow-[var(--shadow-premium)]'}
      `}>
        {/* Admin Controls Overlay */}
        {isAdmin && (
          <div className="absolute top-8 left-8 flex items-center gap-2 transition-all z-10">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(table); }}
              className="h-8 w-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 shadow-sm transition-all"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(table._id); }}
              className="h-8 w-8 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/50 shadow-sm transition-all"
            >
              <Trash2 size={14} className="text-[var(--color-danger)]/70" />
            </button>
          </div>
        )}

        {/* Status Indicator */}
        <div className="absolute top-8 right-8 flex items-center gap-2">
          {table.hasActiveNotes && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="h-6 w-6 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] border border-[var(--color-primary)]/20 "
            >
              <MessageSquare size={12} />
            </motion.div>
          )}
          {table.status === 'ongoing' && (
            <span className="text-[8px] font-bold uppercase tracking-normal px-2 py-0.5 rounded-full bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] animate-pulse">Pending Bill</span>
          )}
          <div className={`h-3 w-3 rounded-full ${statusColors[table.status]}  ring-4 ring-[var(--color-surface)]`} />
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal block mb-1">Terminal</span>
            <h3 className="text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">T{table.tableNumber}</h3>
            {table.tableName && (
              <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-tight block mt-1">{table.tableName}</span>
            )}
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mt-1 block opacity-60 truncate">
              {table.locationId?.name || table.locationName}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-normal border border-current opacity-80 ${statusTextColors[table.status]}`}>
              {isOccupied ? 'Occupied' : table.status === 'ongoing' ? 'Session' : table.status}
            </span>
            <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-normal bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] flex items-center gap-1.5">
              <Users size={10} /> {table.capacity || 1} Seater
            </span>
          </div>

          {(isOccupied || table.status === 'ongoing') && table.activeOrdersCount > 0 && (
            <div className="bg-[var(--color-bg-soft)]/50 p-4 rounded-xl border border-[var(--color-border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Culinary Progress</span>
                <span className="text-10px font-bold text-[var(--color-primary)] uppercase tracking-tight">{table.activeOrdersCount} Active Unit{table.activeOrdersCount > 1 ? 's' : ''}</span>
              </div>
              <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '60%' }} // Future: calculate based on status breakdown
                  className="h-full bg-[var(--color-primary)]"
                />
              </div>
              <div className="flex justify-between text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">
                <span>Placed</span>
                <span>Ready</span>
              </div>
            </div>
          )}

          {isOccupied && (
            <div className="pt-6 border-t border-[var(--color-border)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <Clock size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-normal">Active Session</span>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  {table.orders?.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)} Units
                </span>
              </div>
              <div className="flex items-center justify-between bg-[var(--color-bg-soft)]/50 p-4 rounded-xl border border-[var(--color-border)]">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Running Bill</span>
                  <span className="text-2xl font-bold text-[var(--color-primary)] tracking-tight">₹{safeTotal.toLocaleString()}</span>
                </div>
                <Receipt className="text-[var(--color-text-muted)]/30" size={24} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4">
          <Button
            variant={isAvailable ? 'outline' : 'primary'}
            className={`w-full !rounded-[1.5rem] !py-4 text-xs font-bold uppercase tracking-normal transition-all ${isAvailable ? 'hover:bg-[var(--color-surface-soft)]' : 'bg-[var(--color-primary)] text-[var(--color-bg-base)] shadow-lg '}`}
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
