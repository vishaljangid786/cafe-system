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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          />

          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-none overflow-y-auto custom-scrollbar">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`glass-card w-full ${maxWidth} sm:rounded-2xl rounded-t-[2.5rem] rounded-b-2xl pointer-events-auto shadow-2xl border border-zinc-200 dark:border-zinc-800/50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl relative my-auto`}
            >
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">System Protocol</h3>
                  <p className="text-lg font-bold text-zinc-700 dark:text-slate-200 tracking-tight">{title}</p>
                </div>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 md:p-8">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
