'use client';

export const Skeleton = ({ className }) => {
  return (
    <div className={`animate-pulse bg-muted dark:bg-zinc-800/50 rounded-2xl ${className}`}></div>
  );
};

export const CardSkeleton = () => (
  <div className="glass-card p-6 rounded-3xl space-y-4">
    <div className="flex justify-between items-start">
      <Skeleton className="h-12 w-12 rounded-xl" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="glass-card rounded-3xl overflow-hidden">
    <div className="px-6 py-4 border-b border-border bg-muted/20">
      <Skeleton className="h-6 w-32" />
    </div>
    <div className="space-y-4 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  </div>
);
