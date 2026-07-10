'use client';

/**
 * LoadingScreen — the premium, branded full-page loader used for auth/initial
 * loads and any "the whole view is loading" moment.
 *
 * Shows the CafeOS mark inside a spinning gradient orbit with a soft pulsing
 * glow, the wordmark, a rotating status line, and a real animated progress bar
 * with a live percentage. Because most callers only have a boolean `loading`
 * flag (no true %), the bar eases toward ~92% and the caller unmounts it the
 * instant data arrives — the same trick NProgress uses to feel responsive.
 */

import { useEffect, useRef, useState } from 'react';
import { Coffee } from 'lucide-react';
import { CardSkeleton, StatGridSkeleton, PageHeaderSkeleton } from './Skeleton';

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

  // Smoothly ease toward ~92% — fast at first, crawling near the top, never
  // quite arriving until the caller unmounts us.
  useEffect(() => {
    let raf;
    const tick = (t) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const target = 92 * (1 - Math.exp(-elapsed / 1000));
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
      1500
    );
    return () => clearInterval(id);
  }, [message, stages.length]);

  const label = message ?? stages[stageIndex] ?? 'Loading';
  const pct = Math.min(99, Math.round(progress));

  // In-page loading (fullScreen=false) shows a skeleton of the view instead of a
  // spinner — it reads as "content is arriving" rather than "everything stopped".
  // The branded orbit loader is reserved for the full-screen auth/initial splash.
  if (!fullScreen) {
    return (
      <div className={`w-full space-y-6 ${className}`}>
        <PageHeaderSkeleton />
        <StatGridSkeleton count={4} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen' : 'min-h-[60vh] rounded-2xl border border-(--color-border)'
      } w-full bg-(--color-bg-base) flex items-center justify-center relative overflow-hidden ${className}`}
    >
      <style>{`
        @keyframes cos-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes cos-spin { to { transform: rotate(360deg) } }
        @keyframes cos-glow { 0%,100%{opacity:.30;transform:scale(1)} 50%{opacity:.55;transform:scale(1.12)} }
        @keyframes cos-shimmer { 0%{transform:translateX(-120%)} 100%{transform:translateX(360%)} }
        @keyframes cos-fade { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-primary/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-primary/10 blur-[130px]" />

      <div className="relative z-10 flex flex-col items-center gap-8 px-8 w-full max-w-sm">
        {/* Branded mark inside a spinning gradient orbit + soft glow */}
        <div
          className="relative h-24 w-24 flex items-center justify-center"
          style={{ animation: 'cos-float 3s ease-in-out infinite' }}
        >
          {/* pulsing glow */}
          <div
            aria-hidden
            className="absolute inset-1 rounded-[28px] bg-primary blur-2xl"
            style={{ animation: 'cos-glow 2.4s ease-in-out infinite' }}
          />
          {/* static track ring */}
          <div aria-hidden className="absolute inset-0 rounded-full border-2 border-(--color-border)" />
          {/* spinning gradient arc ring (conic + ring mask) */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, transparent 210deg, var(--color-primary) 360deg)',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              animation: 'cos-spin 1.1s linear infinite',
            }}
          />
          {/* mark */}
          <div className="relative h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-(--color-on-primary) shadow-lg shadow-primary/30">
            <Coffee size={30} strokeWidth={2.5} />
          </div>
        </div>

        {/* Wordmark + rotating status */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-(--color-text-primary) leading-none">
            Cafe<span className="text-primary">OS</span>
          </h1>
          <p
            key={label}
            className="text-sm text-(--color-text-muted)"
            style={{ animation: 'cos-fade .45s ease' }}
          >
            {label}
          </p>
        </div>

        {/* Determinate progress bar with a shimmer sweep + live percentage */}
        <div className="w-full space-y-2.5">
          <div className="relative h-2 w-full rounded-full bg-(--color-surface-soft) overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 55%, white))',
              }}
            />
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent)',
                animation: 'cos-shimmer 1.6s ease-in-out infinite',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-(--color-text-muted) font-medium">Loading</span>
            <span className="tabular-nums text-primary font-semibold">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
