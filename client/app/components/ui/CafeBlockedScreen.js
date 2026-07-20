'use client';
import { motion } from 'framer-motion';
import { Lock, LogOut } from 'lucide-react';

// What everyone in a blocked cafe sees instead of the dashboard.
//
// Deliberately a dead end: no navigation, no data, no retry button. The cafe is
// frozen server-side, so every request would fail anyway, and offering controls
// that cannot work reads as a bug rather than a lockout. The only thing to do
// here is contact the platform administrator — so that is the only thing said.

export default function CafeBlockedScreen({ cafeName, reason, onLogout }) {
  return (
    <div className="fixed inset-0 z-10002 flex items-center justify-center p-6 bg-(--color-bg)">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-full max-w-md text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-[rgba(var(--color-danger-rgb),0.1)] text-danger mx-auto flex items-center justify-center mb-6">
          <Lock size={30} />
        </div>

        <h1 className="text-xl font-semibold text-(--color-text-primary) mb-3">
          {cafeName ? `${cafeName} is blocked` : 'This cafe is blocked'}
        </h1>

        <p className="text-sm text-(--color-text-secondary) leading-relaxed">
          Your cafe has been blocked by the platform administrator, so nobody here can use
          the dashboard right now.
        </p>

        {reason ? (
          <p className="mt-4 text-sm text-(--color-text-primary) rounded-xl border border-(--color-border) bg-(--color-surface) p-4 leading-relaxed">
            {reason}
          </p>
        ) : null}

        <p className="mt-4 text-sm text-(--color-text-secondary) leading-relaxed">
          Please contact the super admin to have it unblocked.
        </p>

        {onLogout ? (
          <button
            onClick={onLogout}
            className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold uppercase tracking-normal text-(--color-text-secondary) border border-(--color-border) hover:bg-(--color-surface) transition-all"
          >
            <LogOut size={14} />
            Sign out
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}
