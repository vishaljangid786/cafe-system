// Maps a legacy Tailwind color name (amber/emerald/rose/blue/green/red/zinc…)
// to theme-aware token classes, so status colors work in both light and dark
// without relying on hardcoded palette classes built from template strings
// (which Tailwind cannot generate at build time).

const TONE = {
  primary: {
    text: 'text-[var(--color-primary)]',
    bg: 'bg-[var(--color-primary)]',
    soft: 'bg-[var(--color-primary-soft)]',
    border: 'border-[rgba(var(--color-primary-rgb),0.2)]',
  },
  success: {
    text: 'text-[var(--color-success)]',
    bg: 'bg-[var(--color-success)]',
    soft: 'bg-[rgba(var(--color-success-rgb),0.12)]',
    border: 'border-[rgba(var(--color-success-rgb),0.2)]',
  },
  danger: {
    text: 'text-[var(--color-danger)]',
    bg: 'bg-[var(--color-danger)]',
    soft: 'bg-[rgba(var(--color-danger-rgb),0.12)]',
    border: 'border-[rgba(var(--color-danger-rgb),0.2)]',
  },
  warning: {
    text: 'text-[var(--color-warning)]',
    bg: 'bg-[var(--color-warning)]',
    soft: 'bg-[rgba(var(--color-warning-rgb),0.12)]',
    border: 'border-[rgba(var(--color-warning-rgb),0.2)]',
  },
  muted: {
    text: 'text-[var(--color-text-muted)]',
    bg: 'bg-[var(--color-surface-soft)]',
    soft: 'bg-[var(--color-surface-soft)]',
    border: 'border-[var(--color-border)]',
  },
};

const ALIAS = {
  amber: 'warning', yellow: 'warning', orange: 'warning',
  green: 'success', emerald: 'success', lime: 'success', teal: 'success',
  red: 'danger', rose: 'danger', pink: 'danger',
  blue: 'primary', sky: 'primary', indigo: 'primary', cyan: 'primary', violet: 'primary', purple: 'primary',
  zinc: 'muted', gray: 'muted', slate: 'muted', neutral: 'muted', stone: 'muted',
};

const key = (c) => ALIAS[c] || (TONE[c] ? c : 'primary');

export const toneText = (c) => TONE[key(c)].text;
export const toneBg = (c) => TONE[key(c)].bg;
export const toneSoft = (c) => TONE[key(c)].soft;
export const toneBorder = (c) => TONE[key(c)].border;
