'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Calendar, ChevronDown, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const startOfWeek = (base) => {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Monday
  return d;
};
// Indian financial year starts April 1. Returns the FY's starting calendar year.
const fyStartYear = (d) => (d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear());

// A "value" is a small tagged object we can serialise to { startDate, endDate }.
// kinds: today | yesterday | week | month | quarter | fy | rolling12 | custom | all
const computeRange = (value) => {
  const now = new Date();
  const today = fmt(now);
  switch (value?.kind) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const y = new Date(); y.setDate(now.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'week': {
      const start = startOfWeek(now);
      return { startDate: fmt(start), endDate: today };
    }
    case 'month': {
      const start = new Date(value.y, value.m, 1);
      const isCurrent = value.y === now.getFullYear() && value.m === now.getMonth();
      const end = isCurrent ? now : new Date(value.y, value.m + 1, 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'quarter': {
      const start = new Date(value.y, value.q * 3, 1);
      const isCurrent = value.y === now.getFullYear() && value.q === Math.floor(now.getMonth() / 3);
      const end = isCurrent ? now : new Date(value.y, value.q * 3 + 3, 0);
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'fy': {
      const start = new Date(value.startYear, 3, 1); // Apr 1
      const isCurrent = value.startYear === fyStartYear(now);
      const end = isCurrent ? now : new Date(value.startYear + 1, 2, 31); // Mar 31
      return { startDate: fmt(start), endDate: fmt(end) };
    }
    case 'rolling12': {
      const start = new Date(); start.setMonth(now.getMonth() - 11); start.setDate(1);
      return { startDate: fmt(start), endDate: today };
    }
    case 'custom':
      return { startDate: value.start || '', endDate: value.end || '' };
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
};

const labelFor = (value) => {
  const now = new Date();
  switch (value?.kind) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'week': return 'Week';
    case 'month': return `${MONTHS[value.m]} ${value.y}`;
    case 'quarter': return `Q${value.q + 1} ${value.y}`;
    case 'fy': return `FY ${String(value.startYear).slice(2)}–${String(value.startYear + 1).slice(2)}`;
    case 'rolling12': return '12M';
    case 'custom': return 'Custom';
    case 'all': return 'All time';
    default: return '';
  }
};

// Map the legacy `defaultFilter` string onto an initial value object so existing
// callers keep the range they used to request.
const initialValueFromDefault = (def) => {
  const now = new Date();
  switch (def) {
    case 'today': return { kind: 'today' };
    case 'yesterday': return { kind: 'yesterday' };
    case 'this_week': case '7d': return { kind: 'week' };
    case 'this_month': case '30d': case 'last_month':
      return { kind: 'month', y: now.getFullYear(), m: now.getMonth() };
    case '3m': case '6m': case 'this_quarter':
      return { kind: 'quarter', y: now.getFullYear(), q: Math.floor(now.getMonth() / 3) };
    case 'financial_year': case 'this_year':
      return { kind: 'fy', startYear: fyStartYear(now) };
    case '12m': return { kind: 'rolling12' };
    case 'all': default: return { kind: 'all' };
  }
};

// ── Option generators for the dropdowns ──────────────────────────────────────
const monthOptions = () => {
  const now = new Date();
  const out = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ value: { kind: 'month', y: d.getFullYear(), m: d.getMonth() }, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
};
const quarterOptions = () => {
  const now = new Date();
  const out = [];
  let y = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3);
  for (let i = 0; i < 6; i++) {
    const startM = MONTHS[q * 3];
    const endM = MONTHS[q * 3 + 2];
    out.push({ value: { kind: 'quarter', y, q }, label: `Q${q + 1} ${y} · ${startM}–${endM}` });
    q -= 1; if (q < 0) { q = 3; y -= 1; }
  }
  return out;
};
const fyOptions = () => {
  const now = new Date();
  const cur = fyStartYear(now);
  const out = [];
  for (let i = 0; i < 5; i++) {
    const s = cur - i;
    out.push({ value: { kind: 'fy', startYear: s }, label: `FY ${s}–${String(s + 1).slice(2)}` });
  }
  return out;
};

// ── Small popover dropdown ───────────────────────────────────────────────────
function Dropdown({ label, active, options, onPick, isSelected }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
          ${active ? 'text-primary' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
      >
        <span className={active ? 'border-b-2 border-primary pb-0.5' : ''}>{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-1 left-0 min-w-52 max-h-72 overflow-y-auto custom-scrollbar bg-(--color-surface) border border-(--color-border) rounded-xl shadow-(--shadow-md) p-1.5"
          >
            {options.map((opt) => {
              const selected = isSelected(opt.value);
              return (
                <li key={opt.label}>
                  <button
                    type="button"
                    onClick={() => { onPick(opt.value); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors
                      ${selected ? 'bg-(--color-primary-soft) text-primary font-semibold' : 'text-(--color-text-secondary) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {selected && <Check size={15} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main filter ──────────────────────────────────────────────────────────────
export default function UniversalDateFilter({
  onFilterChange,
  loading = false,
  className = '',
  defaultFilter = 'all',
  // 'solid' renders its own pill container; 'ghost' drops the box (for callers
  // that already place the filter inside a styled bar).
  variant = 'solid',
}) {
  const [value, setValue] = useState(() => initialValueFromDefault(defaultFilter));
  const [showCustom, setShowCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState({ start: '', end: '' });
  const customRef = useRef(null);

  const months = useMemo(() => monthOptions(), []);
  const quarters = useMemo(() => quarterOptions(), []);
  const fys = useMemo(() => fyOptions(), []);
  const today = fmt(new Date());

  // Emit on every committed value change. Keep the legacy payload shape
  // ({ startDate, endDate, filterType }) and add a human `label`.
  const emit = useCallback((v) => {
    const { startDate, endDate } = computeRange(v);
    onFilterChange?.({ startDate, endDate, filterType: v.kind, label: labelFor(v) });
  }, [onFilterChange]);

  // Fire once on mount so consumers get their initial range (matches old behaviour).
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    emit(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (v) => {
    setShowCustom(false);
    setValue(v);
    emit(v);
  };

  // Double-clicking the filter clears it back to "All time" (empty range) — the
  // same reset the Custom popover's "All time (clear)" does, but reachable from
  // anywhere on the control. No-op when nothing is filtered.
  const clearAll = () => {
    if (value.kind === 'all') return;
    pick({ kind: 'all' });
  };

  useEffect(() => {
    if (!showCustom) return undefined;
    const onDoc = (e) => { if (customRef.current && !customRef.current.contains(e.target)) setShowCustom(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showCustom]);

  const applyCustom = (start, end) => {
    setCustomDraft({ start, end });
    if (start && end) {
      const v = { kind: 'custom', start, end };
      setValue(v);
      emit(v);
    }
  };

  const is = (kind) => value.kind === kind;
  const eqValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // Render a preset pill (plain helper, not a nested component, so it doesn't
  // remount on every render).
  const renderPill = (kind, label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
        ${is(kind) ? 'text-primary' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
    >
      <span className={is(kind) ? 'border-b-2 border-primary pb-0.5' : ''}>{label}</span>
    </button>
  );

  return (
    <div
      onDoubleClick={clearAll}
      title={value.kind !== 'all' ? 'Double-click to clear (show all time)' : undefined}
      className={`inline-flex flex-wrap items-center gap-0.5 ${
        variant === 'ghost' ? '' : 'px-2 py-1 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm'
      } ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin text-primary ml-1 mr-0.5" />}

      {renderPill('today', 'Today', () => pick({ kind: 'today' }))}
      {renderPill('yesterday', 'Yesterday', () => pick({ kind: 'yesterday' }))}
      {renderPill('week', 'Week', () => pick({ kind: 'week' }))}

      <Dropdown
        label={is('month') ? labelFor(value) : 'Month'}
        active={is('month')}
        options={months}
        onPick={pick}
        isSelected={(v) => eqValue(v, value)}
      />
      <Dropdown
        label={is('quarter') ? labelFor(value) : 'Quarter'}
        active={is('quarter')}
        options={quarters}
        onPick={pick}
        isSelected={(v) => eqValue(v, value)}
      />
      <Dropdown
        label={is('fy') ? labelFor(value) : 'FY'}
        active={is('fy')}
        options={fys}
        onPick={pick}
        isSelected={(v) => eqValue(v, value)}
      />

      {renderPill('rolling12', '12M', () => pick({ kind: 'rolling12' }))}

      {/* Custom range */}
      <div className="relative" ref={customRef}>
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
            ${is('custom') ? 'text-primary' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
        >
          <Calendar size={14} />
          <span className={is('custom') ? 'border-b-2 border-primary pb-0.5' : ''}>Custom</span>
        </button>
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
              className="absolute z-50 mt-1 right-0 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-(--shadow-md) p-3 space-y-2 w-64"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-(--color-text-muted) w-10">From</span>
                <input
                  type="date"
                  value={customDraft.start}
                  max={customDraft.end || today}
                  onChange={(e) => applyCustom(e.target.value, customDraft.end)}
                  className="flex-1 bg-(--color-surface-soft) border border-(--color-border) rounded-lg px-2.5 py-1.5 text-xs outline-none text-(--color-text-primary) focus:border-primary/40"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-(--color-text-muted) w-10">To</span>
                <input
                  type="date"
                  value={customDraft.end}
                  min={customDraft.start || undefined}
                  max={today}
                  onChange={(e) => applyCustom(customDraft.start, e.target.value)}
                  className="flex-1 bg-(--color-surface-soft) border border-(--color-border) rounded-lg px-2.5 py-1.5 text-xs outline-none text-(--color-text-primary) focus:border-primary/40"
                />
              </div>
              <button
                type="button"
                onClick={() => { pick({ kind: 'all' }); setCustomDraft({ start: '', end: '' }); }}
                className={`w-full text-center text-xs font-medium py-1.5 rounded-lg transition-colors
                  ${is('all') ? 'bg-(--color-primary-soft) text-primary' : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}`}
              >
                All time (clear)
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
