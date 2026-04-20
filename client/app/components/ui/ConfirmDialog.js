'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export default function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  type = 'danger' 
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
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-[10000]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[10001] pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass-card w-full max-w-md rounded-[2.5rem] overflow-hidden pointer-events-auto p-10 text-center shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)]"
            >
              <div className={`h-20 w-20 ${type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'} rounded-3xl mx-auto flex items-center justify-center mb-8 border border-current/10`}>
                <AlertCircle size={40} strokeWidth={2.5} />
              </div>
              
              <h3 className="text-2xl font-black text-foreground tracking-tight mb-3">{title}</h3>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-10 px-4">{message}</p>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="secondary"
                  onClick={onClose}
                  className="!py-4"
                >
                  Cancel
                </Button>
                <Button
                  variant={type === 'danger' ? 'danger' : 'primary'}
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="!py-4"
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
