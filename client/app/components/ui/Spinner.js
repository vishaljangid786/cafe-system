'use client';

/**
 * Unified spinner primitives — replaces the dozens of ad-hoc
 * `border-2 border-t-... animate-spin` divs and stray `<Loader2 className="animate-spin">`
 * usages scattered across the app so every spinner looks identical.
 */

const SIZES = {
  xs: 'h-4 w-4 border-2',
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-[3px]',
  xl: 'h-16 w-16 border-4',
};

/** A single ring spinner. Use `label` to stack a caption underneath. */
export function Spinner({ size = 'md', label, className = '', labelClassName = '' }) {
  const ring = (
    <span
      className={`inline-block rounded-full border-[var(--color-primary)]/15 border-t-[var(--color-primary)] animate-spin ${SIZES[size] || SIZES.md} ${className}`}
    />
  );

  if (!label) return ring;

  return (
    <div className="inline-flex flex-col items-center gap-3">
      {ring}
      <span
        className={`text-[10px] font-black uppercase tracking-[0.35em] text-[var(--color-text-muted)] animate-pulse ${labelClassName}`}
      >
        {label}
      </span>
    </div>
  );
}

/** Three bouncing dots — a lighter-weight inline loader. */
export function DotsLoader({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[var(--color-primary)] animate-loader-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

/**
 * Centered spinner block for filling a card / section / panel while its
 * contents load. Drop-in replacement for one-off "centered spinner" markup.
 */
export function LoaderBlock({ label = 'Loading', size = 'lg', className = '', minHeight = '16rem' }) {
  return (
    <div
      className={`w-full flex items-center justify-center ${className}`}
      style={{ minHeight }}
    >
      <Spinner size={size} label={label} />
    </div>
  );
}

export default Spinner;
