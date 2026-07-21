'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { SlidersHorizontal, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Per-chart controls, so a single chart can be narrowed without disturbing the
// rest of the page.
//
// The page-level date filter answers "what period am I looking at". This answers
// the next question — "within that period, show me only these categories / group
// this by month / just the top 5" — which previously had no home at all: every
// chart rendered whatever the API happened to return.
//
// Two pieces, both optional, so a chart only shows the controls it can honour:
//
//   segments  pill row for mutually-exclusive choices (Day / Week / Month / Year,
//             Top 5 / Top 10 / All). Rendered inline — one tap, no menu.
//   filters   a popover with checkbox groups for many-of-N choices (which
//             categories to include). Kept behind a button because these lists
//             can be long and are used less often than the segments.
//
// Both are controlled: this component owns no data, only the popover's open
// state. The parent holds the values and does the filtering, which keeps the
// maths where the data is.

// Group a date-keyed series into day / week / month / year buckets.
// Exported because several charts need the same bucketing and duplicating it
// is how two charts start disagreeing about what "this month" means.
export const GROUP_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Roll a [{ date: 'YYYY-MM-DD', ...numbers }] series up to the chosen grain.
 * Numeric fields are summed; the label becomes the bucket's name.
 *
 * @param {Array}  rows      series with a `date` field
 * @param {String} grain     'day' | 'week' | 'month' | 'year'
 * @param {Array}  sumKeys   numeric fields to add up
 */
export const groupSeries = (rows = [], grain = 'day', sumKeys = []) => {
  if (grain === 'day' || !rows.length) return rows;

  const keyFor = (d) => {
    if (grain === 'year') return String(d.getFullYear());
    if (grain === 'month') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    // Week: label by the Monday that starts it, so buckets are stable.
    const monday = new Date(d);
    const dow = monday.getDay();
    monday.setDate(monday.getDate() - dow + (dow === 0 ? -6 : 1));
    return `${monday.getDate()} ${MONTHS[monday.getMonth()]}`;
  };

  const buckets = new Map();
  rows.forEach((row) => {
    const d = new Date(`${row.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const key = keyFor(d);
    if (!buckets.has(key)) {
      // `date` keeps the chart's dataKey working unchanged after grouping.
      buckets.set(key, { date: key, _sort: d.getTime() });
    }
    const bucket = buckets.get(key);
    sumKeys.forEach((k) => {
      bucket[k] = (bucket[k] || 0) + (Number(row[k]) || 0);
    });
  });

  return [...buckets.values()].sort((a, b) => a._sort - b._sort);
};

const SegmentRow = ({ options, value, onChange }) => (
  <div className="flex items-center gap-0.5 bg-(--color-surface-soft)/70 p-0.5 rounded-lg border border-(--color-border)">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-normal transition-all ${
          value === o.value
            ? 'bg-primary text-(--color-on-primary) shadow-sm'
            : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export default function ChartToolbar({
  /** [{ key, options:[{value,label}], value, onChange }] — inline pill rows */
  segments = [],
  /**
   * [{ key, label, options:[{value,label,count}], selected:[], onChange }]
   * Checkbox groups inside the popover. `selected` empty means "all", which is
   * what an untouched chart should show.
   */
  filters = [],
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Only count groups the user has actually narrowed — an empty selection is
  // "everything", not a filter.
  const activeCount = useMemo(
    () => filters.reduce((n, f) => n + (f.selected?.length > 0 && f.selected.length < f.options.length ? 1 : 0), 0),
    [filters]
  );

  const hasFilters = filters.some((f) => f.options.length > 0);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {segments.map((s) => (
        <SegmentRow key={s.key} options={s.options} value={s.value} onChange={s.onChange} />
      ))}

      {hasFilters && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title="Filter this chart"
            className={`relative flex items-center justify-center h-7 w-7 rounded-lg border transition-colors ${
              activeCount > 0
                ? 'border-primary/40 bg-(--color-primary-soft) text-primary'
                : 'border-(--color-border) bg-(--color-surface-soft)/70 text-(--color-text-muted) hover:text-(--color-text-primary)'
            }`}
          >
            <SlidersHorizontal size={13} />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-(--color-on-primary) text-[8px] font-bold flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="absolute z-50 right-0 mt-1.5 w-60 max-h-80 overflow-y-auto custom-scrollbar bg-(--color-surface) border border-(--color-border) rounded-xl shadow-(--shadow-md) p-2.5 space-y-3"
              >
                {filters.filter((f) => f.options.length > 0).map((f) => {
                  const allOn = !f.selected?.length || f.selected.length === f.options.length;
                  return (
                    <div key={f.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-normal text-(--color-text-muted)">{f.label}</p>
                        {!allOn && (
                          <button
                            type="button"
                            onClick={() => f.onChange([])}
                            className="text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5"
                          >
                            <X size={9} /> Reset
                          </button>
                        )}
                      </div>
                      {f.options.map((o) => {
                        // Empty selection = show everything, so every box reads as ticked.
                        const on = allOn || f.selected.includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => {
                              const base = f.selected?.length ? f.selected : f.options.map((x) => x.value);
                              const next = base.includes(o.value)
                                ? base.filter((v) => v !== o.value)
                                : [...base, o.value];
                              // Never leave a chart with nothing to draw.
                              f.onChange(next.length === 0 ? [] : next);
                            }}
                            className="w-full flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-(--color-surface-soft) transition-colors text-left"
                          >
                            <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-(--color-border-strong)'}`}>
                              {on && <Check size={9} className="text-(--color-on-primary)" strokeWidth={3} />}
                            </span>
                            <span className="text-xs font-medium text-(--color-text-primary) truncate flex-1">{o.label}</span>
                            {o.count != null && (
                              <span className="text-[10px] font-medium text-(--color-text-muted) tabular-nums">{o.count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
