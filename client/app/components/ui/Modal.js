'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--color-bg-deep)]/60 backdrop-blur-sm z-[9998]"
          />

          <div className="fixed inset-0 flex items-center justify-center p-0 sm:p-4 z-[9999] pointer-events-none overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 50 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className={`glass-card w-full ${maxWidth} max-h-[100vh] sm:max-h-[90vh] sm:rounded-2xl rounded-t-[2.5rem] pointer-events-auto shadow-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-2xl relative flex flex-col mt-auto sm:mt-0`}
            >
              <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">Details</h3>
                  <p className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] tracking-tight line-clamp-1">{title}</p>
                </div>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all hover:border-[var(--color-primary)]/30 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
