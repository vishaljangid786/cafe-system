"use client"
import { useState, useEffect } from 'react';
import { Users, User, Phone, ArrowRight } from 'lucide-react';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';
import PremiumSelect from '../ui/PremiumSelect';

export default function AssignTableModal({ isOpen, onClose, onConfirm, table }) {
  // Default the party size to 1, not the table's full capacity. Pre-filling a
  // 6-seat table with 6 guests silently overstated headcount (and the capacity
  // maths that depends on it) whenever staff accepted the default.
  const DEFAULT_PARTY_SIZE = 1;
  const [members, setMembers] = useState(DEFAULT_PARTY_SIZE);
  const [customerName, setCustomerName] = useState('');
  // Phone is now required: it is the key that links this order to a CRM identity
  // (and therefore to the new-customer discount and loyalty).
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    const initMembers = () => {
      if (table) {
        setMembers(DEFAULT_PARTY_SIZE);
      }
    };
    initMembers();
  }, [table]);

  const phoneDigits = (customerPhone || '').replace(/\D/g, '');
  const canSubmit = customerName.trim().length > 0 && phoneDigits.length >= 10;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (members <= 0) return;
    if (members > (table?.capacity || 4)) {
      toast.error(`Table capacity is ${table?.capacity || 4} members max!`);
      return;
    }
    if (!canSubmit) {
      toast.error('Customer name and a 10-digit mobile number are required');
      return;
    }
    onConfirm({ numberOfPeople: members, customerName: customerName.trim(), customerPhone: phoneDigits });
    onClose();
    setMembers(DEFAULT_PARTY_SIZE);
    setCustomerName('');
    setCustomerPhone('');
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
            <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Customer Name</label>
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

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
              <input
                type="tel"
                inputMode="numeric"
                className="w-full pl-12 pr-4 py-4 bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-sm"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="10-digit mobile number"
              />
            </div>
            <p className="text-[10px] text-(--color-text-muted) ml-1">
              Links the order to the customer&apos;s rewards and any new-customer offer.
            </p>
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
            disabled={!canSubmit}
            className="flex-1 !rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            icon={ArrowRight}
          >
            Start Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}
