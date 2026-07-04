'use client';

import { Calendar, X, Loader2 } from 'lucide-react';

// Always-visible "From – To" date range. Fires onChange({ startDate, endDate }) on every
// edit so the parent can re-query immediately — there is no Apply button. Empty on both
// sides means "no date filter" (all time). The global DateInputEnhancer opens the native
// picker on click, so tapping anywhere on an input surfaces the calendar.
export default function DateRangeFilter({
  startDate = '',
  endDate = '',
  onChange,
  loading = false,
  iconClassName = 'text-primary',
  className = '',
}) {
  const hasValue = Boolean(startDate || endDate);

  return (
    <div className={`inline-flex items-center gap-1 p-1 pl-3 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm ${className}`}>
      {loading ? (
        <Loader2 size={16} className={`animate-spin ${iconClassName}`} />
      ) : (
        <Calendar size={16} className={iconClassName} />
      )}

      <div className="flex items-center gap-1.5 pl-2">
        <span className="text-[11px] font-medium text-(--color-text-muted)">From</span>
        <input
          type="date"
          value={startDate || ''}
          max={endDate || undefined}
          onChange={(e) => onChange?.({ startDate: e.target.value, endDate })}
          className="bg-transparent text-xs font-medium outline-none text-(--color-text-primary) w-32 cursor-pointer"
        />
      </div>

      <span className="text-(--color-text-muted) px-0.5">–</span>

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-(--color-text-muted)">To</span>
        <input
          type="date"
          value={endDate || ''}
          min={startDate || undefined}
          onChange={(e) => onChange?.({ startDate, endDate: e.target.value })}
          className="bg-transparent text-xs font-medium outline-none text-(--color-text-primary) w-32 cursor-pointer"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange?.({ startDate: '', endDate: '' })}
        aria-label="Clear date range"
        className={`ml-1 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center transition-all ${hasValue ? 'text-(--color-text-muted) hover:text-danger hover:bg-danger/10' : 'opacity-0 pointer-events-none'}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
