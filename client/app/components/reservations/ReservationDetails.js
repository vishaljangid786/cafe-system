'use client';
import { 
  X, Calendar, Clock, Users, 
  MapPin, Phone, CreditCard, 
  CheckCircle2, XCircle, AlertCircle,
  FileText, Hash, DollarSign, CalendarDays
} from 'lucide-react';
import Modal from '../ui/Modal';
import { format } from 'date-fns';

export default function ReservationDetails({ isOpen, onClose, reservation, onModify }) {
  if (!reservation) return null;

  const getStatusInfo = (status) => {
    switch (status) {
      case 'confirmed': return { color: 'var(--color-success)', icon: CheckCircle2 };
      case 'pending': return { color: 'var(--color-primary)', icon: AlertCircle };
      case 'cancelled': return { color: 'var(--color-danger)', icon: XCircle };
      default: return { color: 'var(--color-text-muted)', icon: Hash };
    }
  };

  const statusInfo = getStatusInfo(reservation.status);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reservation Details" maxWidth="max-w-2xl">
      <div className="space-y-8 py-2">
        
        {/* Top Header Card */}
        <div className="p-6 rounded-xl bg-[var(--color-bg-soft)]/50 border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-normal border bg-[var(--color-surface)] shadow-sm`} style={{ color: statusInfo.color, borderColor: `${statusInfo.color}40` }}>
                {reservation.status}
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-normal border bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]">
                {reservation.reservationType === 'full-location' ? 'Full Branch' : 'Table Booking'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight">
              {reservation.eventName}
            </h2>
            <p className="text-[var(--color-text-muted)] text-sm mt-1 flex items-center gap-1.5 font-medium">
              <Hash size={14} /> ID: {reservation._id.substring(reservation._id.length - 8).toUpperCase()}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">Total Amount</span>
            <span className="text-3xl font-bold text-[var(--color-text-primary)]">
              ₹{reservation.totalAmount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Scheduling Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-4 flex items-center gap-2">
                <CalendarDays size={14} /> Timing
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Date</p>
                    <p className="font-bold text-[var(--color-text-primary)]">
                      {format(new Date(reservation.date), 'EEEE, MMMM do, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Time</p>
                    <p className="font-bold text-[var(--color-text-primary)]">
                      {reservation.startTime} — {reservation.endTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Location</p>
                    <p className="font-bold text-[var(--color-text-primary)]">
                      {reservation.locationId?.name}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources Section */}
            {reservation.reservationType === 'table' && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-4 flex items-center gap-2">
                  <Users size={14} /> Tables
                </h3>
                <div className="flex flex-wrap gap-2">
                  {reservation.tableIds?.map(table => (
                    <div key={table._id} className="px-4 py-2 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                      <span className="text-sm font-bold text-[var(--color-text-primary)]">Table #{table.tableNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Client & Fiscal Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-4 flex items-center gap-2">
                <Users size={14} /> Customer
              </h3>
              <div className="p-4 rounded-xl bg-[var(--color-bg-soft)]/50 border border-[var(--color-border)]">
                <p className="text-lg font-bold text-[var(--color-text-primary)] leading-none mb-1">{reservation.customerName}</p>
                <p className="text-[var(--color-text-muted)] text-sm font-medium flex items-center gap-1.5">
                  <Phone size={14} /> {reservation.customerPhone}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-4 flex items-center gap-2">
                <CreditCard size={14} /> Payment
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-soft)]/30">
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">Advance Paid</span>
                  <span className="font-bold text-[var(--color-primary)]">₹{reservation.advancePayment}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-soft)]/30">
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">Pending Amount</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    ₹{reservation.totalAmount - reservation.advancePayment}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-soft)]/30">
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">Payment Status</span>
                  <span className={`text-[10px] font-bold uppercase tracking-normal ${reservation.paymentStatus === 'paid' ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'}`}>
                    {reservation.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {reservation.notes && (
          <div className="pt-6 border-t border-[var(--color-border)]">
            <h3 className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-3 flex items-center gap-2">
              <FileText size={14} /> Notes
            </h3>
            <div className="p-4 rounded-xl bg-[var(--color-bg-soft)]/50 border border-[var(--color-border)] italic text-[var(--color-text-muted)] text-sm">
              &quot;{reservation.notes}&quot;
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-6 flex items-center justify-end gap-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
          >
            Close
          </button>
          {reservation.status !== 'cancelled' && (
            <button
              onClick={() => {
                onClose();
                onModify(reservation);
              }}
              className="px-8 py-3 bg-[var(--color-text-primary)] text-[var(--color-bg)] font-bold rounded-xl transition-all shadow-[var(--shadow-premium)] "
            >
              Edit Reservation
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
