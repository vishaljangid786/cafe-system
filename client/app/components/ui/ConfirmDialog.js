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
            className="fixed inset-0 bg-black/50 z-[10000]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[10001] pointer-events-none">
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full max-w-sm rounded-xl overflow-hidden pointer-events-auto p-7 text-center border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)]"
            >
              <div className={`h-14 w-14 ${type === 'danger' ? 'bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'} rounded-xl mx-auto flex items-center justify-center mb-5`}>
                {type === 'danger' ? <ShieldAlert size={28} /> : <AlertCircle size={28} />}
              </div>

              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>

              {isImpersonating && (
                <div className="bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)] text-xs font-medium py-2 rounded-lg mb-4 border border-[rgba(var(--color-danger-rgb),0.2)] flex items-center justify-center gap-2">
                  <ShieldAlert size={12} />
                  Destructive action during impersonation
                </div>
              )}

              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6 px-2">{message}</p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant={type === 'danger' ? 'danger' : 'primary'}
                  onClick={() => {
                    onConfirm();
                  }}
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
