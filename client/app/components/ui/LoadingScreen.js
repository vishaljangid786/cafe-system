'use client';

/**
 * LoadingScreen — the premium, branded full-page loader used for auth/initial
 * loads and any "the whole view is loading" moment.
 *
 * Shows the CafeOS mark inside a sweeping orbit ring plus a real, animated
 * progress bar with a live percentage. Because most callers only have a boolean
 * `loading` flag (no true %), the bar eases toward ~90% and snaps to 100% the
 * instant it unmounts — the same trick NProgress uses to feel responsive.
 */

import { useEffect, useRef, useState } from 'react';
import { Coffee } from 'lucide-react';

const DEFAULT_STAGES = [
  'Establishing secure link',
  'Authenticating session',
  'Loading workspace',
  'Syncing live data',
  'Almost there',
];

export default function LoadingScreen({
  message,
  stages = DEFAULT_STAGES,
  fullScreen = true,
  className = '',
}) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const startRef = useRef(null);

  // Smoothly ease toward 90% — decelerating as it climbs, never quite arriving.
  useEffect(() => {
    let raf;
    const tick = (t) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      // Asymptotic curve: fast at first, crawls near the top.
      const target = 90 * (1 - Math.exp(-elapsed / 1100));
      setProgress((prev) => (target > prev ? target : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Rotate the status line through the provided stages.
  useEffect(() => {
    if (message || stages.length <= 1) return;
    const id = setInterval(
      () => setStageIndex((i) => (i + 1) % stages.length),
      1400
    );
    return () => clearInterval(id);
  }, [message, stages.length]);

  const label = message ?? stages[stageIndex] ?? 'Loading';
  const pct = Math.min(99, Math.round(progress));

  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen' : 'min-h-[60vh] rounded-[2rem]'
      } w-full bg-[var(--color-bg-base)] flex items-center justify-center relative overflow-hidden ${className}`}
    >
      {/* Cinematic ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-[var(--color-primary)]/10 blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-[var(--color-secondary)]/10 blur-[150px] animate-pulse-slow" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 w-full max-w-sm">
        {/* Branded mark with sweeping orbit ring */}
        <div className="relative h-24 w-24 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-[1.75rem] animate-loader-orbit"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, var(--color-primary) 300deg, transparent 360deg)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              WebkitMask:
                'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
            }}
          />
          <div className="h-16 w-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-bg-base)] shadow-2xl shadow-[var(--color-primary)]/30 animate-loader-glow">
            <Coffee size={30} strokeWidth={2.5} />
          </div>
        </div>

        {/* Wordmark */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tighter text-[var(--color-text-primary)] leading-none">
            Cafe<span className="text-[var(--color-primary)]">OS</span>
          </h1>
          <p
            key={label}
            className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--color-text-muted)] animate-pulse"
          >
            {label}
          </p>
        </div>

        {/* Determinate progress bar + live percentage */}
        <div className="w-full space-y-2.5">
          <div className="relative h-1.5 w-full rounded-full bg-[var(--color-surface-soft)] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] transition-[width] duration-200 ease-out"
              style={{ width: `${pct}%` }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            <span>Loading</span>
            <span className="tabular-nums text-[var(--color-primary)]">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
