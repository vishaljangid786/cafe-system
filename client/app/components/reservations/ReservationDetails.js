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
      case 'confirmed': return { color: 'emerald', icon: CheckCircle2 };
      case 'pending': return { color: 'amber', icon: AlertCircle };
      case 'cancelled': return { color: 'rose', icon: XCircle };
      default: return { color: 'zinc', icon: Hash };
    }
  };

  const statusInfo = getStatusInfo(reservation.status);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reservation Details" maxWidth="max-w-2xl">
      <div className="space-y-8 py-2">
        
        {/* Top Header Card */}
        <div className={`p-6 rounded-3xl bg-${statusInfo.color}-500/5 border border-${statusInfo.color}-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-${statusInfo.color}-500/10 text-${statusInfo.color}-500 border-${statusInfo.color}-500/20`}>
                {reservation.status}
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                {reservation.reservationType === 'full-location' ? 'Full Branch' : 'Table Selective'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">
              {reservation.eventName}
            </h2>
            <p className="text-zinc-500 text-sm mt-1 flex items-center gap-1.5 font-medium">
              <Hash size={14} /> ID: {reservation._id.substring(reservation._id.length - 8).toUpperCase()}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">Fiscal Impact</span>
            <span className="text-3xl font-black text-zinc-900 dark:text-white">
              ${reservation.totalAmount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Scheduling Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-4 flex items-center gap-2">
                <CalendarDays size={14} /> Chrono Protocol
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Scheduled Date</p>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">
                      {format(new Date(reservation.date), 'EEEE, MMMM do, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Time Phase</p>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">
                      {reservation.startTime} — {reservation.endTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Assigned Location</p>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">
                      {reservation.locationId?.name}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources Section */}
            {reservation.reservationType === 'table' && (
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-4 flex items-center gap-2">
                  <Users size={14} /> Resource Allocation
                </h3>
                <div className="flex flex-wrap gap-2">
                  {reservation.tableIds?.map(table => (
                    <div key={table._id} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-sm font-bold">Table #{table.tableNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Client & Fiscal Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-4 flex items-center gap-2">
                <Users size={14} /> Client Identity
              </h3>
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <p className="text-lg font-black text-zinc-900 dark:text-white leading-none mb-1">{reservation.customerName}</p>
                <p className="text-zinc-500 text-sm font-medium flex items-center gap-1.5">
                  <Phone size={14} /> {reservation.customerPhone}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-4 flex items-center gap-2">
                <CreditCard size={14} /> Fiscal Ledger
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/30">
                  <span className="text-xs font-bold text-zinc-500">Advance Commitment</span>
                  <span className="font-black text-amber-500">${reservation.advancePayment}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/30">
                  <span className="text-xs font-bold text-zinc-500">Outstanding Balance</span>
                  <span className="font-black text-zinc-900 dark:text-white">
                    ${reservation.totalAmount - reservation.advancePayment}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/30">
                  <span className="text-xs font-bold text-zinc-500">Payment Status</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${reservation.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {reservation.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {reservation.notes && (
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-3 flex items-center gap-2">
              <FileText size={14} /> Protocol Notes
            </h3>
            <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 italic text-zinc-600 dark:text-zinc-400 text-sm">
              "{reservation.notes}"
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-6 flex items-center justify-end gap-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all"
          >
            Close
          </button>
          {reservation.status !== 'cancelled' && (
            <button
              onClick={() => {
                onClose();
                onModify(reservation);
              }}
              className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black rounded-xl transition-all shadow-lg hover:scale-[1.02]"
            >
              Modify Protocol
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
