import Modal from '../../../../components/ui/Modal';
import { Eye } from 'lucide-react';

export default function WatchlistModal({ isOpen, onClose, delayedOrders, handleOrderSignalProbe }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Critical Watchlist: Global Surveillance"
      maxWidth="max-w-3xl"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between mb-4 px-2">
          <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-danger)]">Total Delayed Signals: {delayedOrders?.length || 0}</p>
          <div className="h-1 w-20 bg-[var(--color-danger)]/20 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 p-1">
          {delayedOrders?.map((delay, idx) => (
            <div
              key={idx}
              className="p-6 bg-[var(--color-surface-soft)] border border-[var(--color-border)] hover:border-[var(--color-danger)]/30 rounded-xl flex items-center justify-between group transition-all cursor-pointer shadow-sm"
              onClick={() => handleOrderSignalProbe(delay.id)}
            >
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-xl bg-[var(--color-danger)]/10 flex items-center justify-center text-[var(--color-danger)] font-bold text-xl border border-[var(--color-danger)]/20 shadow-inner">
                  {delay.table}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--color-danger)] uppercase tracking-normal">{delay.status}</p>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mt-1 tracking-tight">{delay.duration}m Delay</p>
                  <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-1 italic opacity-60">ID: {delay.id.substring(delay.id.length - 8)}</p>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-danger)] group-hover:bg-[var(--color-danger)] group-hover:text-white transition-all shadow-sm">
                <Eye size={16} />
              </div>
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-10 py-4 bg-[var(--color-surface)] text-[var(--color-text-primary)] text-[10px] font-bold uppercase tracking-normal rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-soft)] transition-all"
          >
            Close Surveillance
          </button>
        </div>
      </div>
    </Modal>
  );
}
