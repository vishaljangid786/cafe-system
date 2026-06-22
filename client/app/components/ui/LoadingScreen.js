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
  'Connecting securely',
  'Signing you in',
  'Loading your workspace',
  'Getting the latest data',
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
        fullScreen ? 'min-h-screen' : 'min-h-[60vh] rounded-xl'
      } w-full bg-(--color-bg-base) flex items-center justify-center relative overflow-hidden ${className}`}
    >
      <div className="relative z-10 flex flex-col items-center gap-7 px-8 w-full max-w-sm">
        {/* Branded mark with a simple spinner ring */}
        <div className="relative h-20 w-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-(--color-border) border-t-primary animate-loader-orbit" />
          <div className="h-14 w-14 rounded-xl bg-primary flex items-center justify-center text-(--color-on-primary)">
            <Coffee size={26} strokeWidth={2.5} />
          </div>
        </div>

        {/* Wordmark */}
        <div className="text-center space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-(--color-text-primary) leading-none">
            Cafe<span className="text-primary">OS</span>
          </h1>
          <p key={label} className="text-sm text-(--color-text-muted)">
            {label}
          </p>
        </div>

        {/* Determinate progress bar + live percentage */}
        <div className="w-full space-y-2">
          <div className="relative h-1.5 w-full rounded-full bg-(--color-surface-soft) overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-(--color-text-muted)">
            <span>Loading</span>
            <span className="tabular-nums text-primary font-medium">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
