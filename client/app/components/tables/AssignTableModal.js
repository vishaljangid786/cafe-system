"use client"
import { useState, useEffect } from 'react';
import { Users, User, ArrowRight } from 'lucide-react';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';

export default function AssignTableModal({ isOpen, onClose, onConfirm, table }) {
  const [members, setMembers] = useState(table?.capacity || 1);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (table) {
      setMembers(table.capacity || 1);
    }
  }, [table]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (members <= 0) return;
    onConfirm({ numberOfPeople: members, customerName });
    onClose();
    setMembers(table?.capacity || 1);
    setCustomerName('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Terminal T${table?.tableNumber}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Number of Members</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="number"
                min="1"
                required
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-sm"
                value={members}
                onChange={(e) => setMembers(Number(e.target.value))}
                placeholder="e.g. 4"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Customer Name (Optional)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all font-bold text-sm"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 !rounded-2xl"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1 !rounded-2xl shadow-lg shadow-amber-500/20"
            icon={ArrowRight}
          >
            Start Session
          </Button>
        </div>
      </form>
    </Modal>
  );
}
