'use client';

/**
 * Skeleton system. Every skeleton shares the same animated shine sweep
 * (the `shimmer` keyframe — now defined in globals.css; it previously did not
 * exist, so all skeletons sat completely static). Variants below mirror the
 * real layouts they stand in for so loading states match the loaded view.
 */

export const Skeleton = ({ className = '', style }) => {
  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-[var(--color-surface-soft)] rounded-lg ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-[var(--color-text-primary)]/[0.08] to-transparent" />
    </div>
  );
};

/** A single stat / KPI card placeholder. */
export const CardSkeleton = () => (
  <div className="glass-card p-6 rounded-2xl space-y-4 border border-[var(--color-border)]">
    <div className="flex justify-between items-start">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-5 w-14 rounded-lg" />
    </div>
    <div className="space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-36" />
    </div>
  </div>
);

/** Responsive grid of stat cards. */
export const StatGridSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

/** Table placeholder with a header row + body rows. */
export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="glass-card rounded-2xl overflow-hidden border border-[var(--color-border)]">
    <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]/50">
      <Skeleton className="h-5 w-40" />
    </div>
    <div className="space-y-4 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-6">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-8 rounded-lg ${j === 0 ? 'w-24' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/** Chart / graph panel placeholder with faux bars. */
export const ChartSkeleton = ({ height = 280, title = true }) => (
  <div className="glass-card rounded-2xl p-6 border border-[var(--color-border)] space-y-6">
    {title && (
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    )}
    <div className="flex items-end gap-3" style={{ height }}>
      {Array.from({ length: 12 }).map((_, i) => {
        // Deterministic, varied bar heights (no Math.random → SSR-safe).
        const h = 35 + ((i * 37) % 60);
        return (
          <div key={i} className="flex-1 flex items-end h-full">
            <Skeleton className="w-full rounded-t-lg" style={{ height: `${h}%` }} />
          </div>
        );
      })}
    </div>
  </div>
);

/** Vertical list of rows (avatar + two lines + trailing value). */
export const ListSkeleton = ({ rows = 6 }) => (
  <div className="glass-card rounded-2xl p-6 border border-[var(--color-border)] space-y-5">
    <Skeleton className="h-5 w-40 mb-2" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
    ))}
  </div>
);

/** Page header placeholder (title + subtitle + action). */
export const PageHeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="flex items-center gap-4">
      <Skeleton className="h-14 w-14 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <Skeleton className="h-11 w-40 rounded-xl" />
  </div>
);

/**
 * Full dashboard page placeholder: header → stat grid → two charts.
 * A sensible default for any analytics/overview page that is loading.
 */
export const DashboardSkeleton = () => (
  <div className="space-y-8">
    <PageHeaderSkeleton />
    <StatGridSkeleton />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ChartSkeleton height={300} />
      </div>
      <ListSkeleton rows={5} />
    </div>
  </div>
);
