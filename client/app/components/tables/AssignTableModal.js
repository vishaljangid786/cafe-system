"use client"
import { useState, useEffect } from 'react';
import { Users, User, ArrowRight } from 'lucide-react';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';
import PremiumSelect from '../ui/PremiumSelect';

export default function AssignTableModal({ isOpen, onClose, onConfirm, table }) {
  const [members, setMembers] = useState(table?.capacity || 1);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    const initMembers = () => {
      if (table) {
        setMembers(table.capacity || 1);
      }
    };
    initMembers();
  }, [table]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (members <= 0) return;
    if (members > (table?.capacity || 4)) {
      toast.error(`Table capacity is ${table?.capacity || 4} members max!`);
      return;
    }
    onConfirm({ numberOfPeople: members, customerName });
    onClose();
    setMembers(table?.capacity || 1);
    setCustomerName('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Table T${table?.tableNumber}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <PremiumSelect
              label="Number of Members"
              placeholder="Select Members"
              options={Array.from({ length: Number(table?.capacity) || 4 }, (_, i) => ({
                value: i + 1,
                label: `${i + 1} ${i + 1 === 1 ? 'Guest' : 'Guests'}`
              }))}
              value={members || 1}
              onChange={(val) => setMembers(val)}
              icon={Users}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Customer Name (Optional)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 !rounded-xl"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1 !rounded-xl shadow-lg "
            icon={ArrowRight}
          >
            Start Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
