// Maps a legacy Tailwind color name (amber/emerald/rose/blue/green/red/zinc…)
// to theme-aware token classes, so status colors work in both light and dark
// without relying on hardcoded palette classes built from template strings
// (which Tailwind cannot generate at build time).

const TONE = {
  primary: {
    text: 'text-primary',
    bg: 'bg-primary',
    soft: 'bg-(--color-primary-soft)',
    border: 'border-[rgba(var(--color-primary-rgb),0.2)]',
  },
  success: {
    text: 'text-success',
    bg: 'bg-success',
    soft: 'bg-[rgba(var(--color-success-rgb),0.12)]',
    border: 'border-[rgba(var(--color-success-rgb),0.2)]',
  },
  danger: {
    text: 'text-danger',
    bg: 'bg-danger',
    soft: 'bg-[rgba(var(--color-danger-rgb),0.12)]',
    border: 'border-[rgba(var(--color-danger-rgb),0.2)]',
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning',
    soft: 'bg-[rgba(var(--color-warning-rgb),0.12)]',
    border: 'border-[rgba(var(--color-warning-rgb),0.2)]',
  },
  muted: {
    text: 'text-(--color-text-muted)',
    bg: 'bg-(--color-surface-soft)',
    soft: 'bg-(--color-surface-soft)',
    border: 'border-(--color-border)',
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
