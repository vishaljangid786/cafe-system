'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { Button } from './Button';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Proceed',
  type = 'danger',
  loading = false,
  isImpersonating = false
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[10001] pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="glass-card w-full max-w-sm rounded-2xl overflow-hidden pointer-events-auto p-8 text-center border border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-2xl shadow-2xl"
            >
              <div className={`h-16 w-16 ${type === 'danger' ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'} rounded-2xl mx-auto flex items-center justify-center mb-6 border border-current/20 shadow-lg shadow-current/5`}>
                {type === 'danger' ? <ShieldAlert size={32} /> : <AlertCircle size={32} />}
              </div>

              <div className="space-y-1 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Security Override</span>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">{title}</h3>
              </div>
              
              {isImpersonating && (
                <div className="bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[9px] font-black uppercase tracking-[0.1em] py-2.5 rounded-xl mb-4 border border-[var(--color-danger)]/20 flex items-center justify-center gap-2">
                  <ShieldAlert size={12} />
                  Destructive Action during Impersonation
                </div>
              )}

              <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-relaxed mb-8 px-2">{message}</p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="!rounded-xl border-[var(--color-border)] text-[var(--color-text-muted)]"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant={type === 'danger' ? 'danger' : 'primary'}
                  onClick={() => {
                    onConfirm();
                  }}
                  className="!rounded-xl"
                  loading={loading}
                >
                  {confirmText}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
