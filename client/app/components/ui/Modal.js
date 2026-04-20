'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-[9998]"
          />
          
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass-card w-full max-w-xl rounded-3xl overflow-hidden pointer-events-auto shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)]"
            >
              <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
                <button
                  onClick={onClose}
                  className="h-10 w-10 rounded-xl bg-muted hover:bg-zinc-800 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
