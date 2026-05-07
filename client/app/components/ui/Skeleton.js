'use client';

export const Skeleton = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-[var(--color-surface-soft)] rounded-lg ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-[var(--color-text-primary)]/5 to-transparent" />
    </div>
  );
};

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
