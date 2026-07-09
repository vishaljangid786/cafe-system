'use client';
import { CountUp } from './CountUp';
import { useValueVisibility } from '../../context/ValueVisibilityContext';
import { formatIndianCompact, formatIndianFull } from '../../utils/formatNumber';

const MASK = '•••••';

// The single primitive for every on-screen numeric/money value. It:
//   • compacts to Indian units once the value exceeds 5 digits (₹1.2 L / ₹3.4 Cr),
//   • reveals the exact, fully-grouped value on hover (native title tooltip),
//   • hides behind a dot mask when the global "hide values" toggle is on (money only),
//   • optionally count-up animates (for stat cards).
//
// Props:
//   value      number-like amount
//   currency   prefix ₹ (default true)
//   sensitive  can the privacy toggle mask it? (defaults to `currency` — money is
//              sensitive, plain counts are not)
//   compact    abbreviate large values (default true); false = always full grouped
//   decimals   decimals kept in the compact unit (default 2)
//   animate    count-up animate on mount / value change
//   prefix     text rendered before the ₹ (e.g. '-' or '+' for signed amounts)
//   title      override the hover tooltip
//   as         element/tag to render (default 'span')
export function Money({
  value,
  currency = true,
  sensitive = currency,
  compact = true,
  decimals = 2,
  animate = false,
  duration = 900,
  prefix = '',
  title,
  className = '',
  as: Tag = 'span',
  ...rest
}) {
  const { hidden } = useValueVisibility();
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;

  if (sensitive && hidden) {
    return (
      <Tag className={`cafe-money is-masked ${className}`} {...rest}>
        {prefix}
        {currency ? '₹' : ''}
        {MASK}
      </Tag>
    );
  }

  const full = formatIndianFull(safe, { currency });
  const abbreviated = compact && Math.abs(safe) >= 1e5;
  const resolvedTitle = title ?? (abbreviated ? full : undefined);

  if (animate) {
    return (
      <CountUp
        value={safe}
        duration={duration}
        className={`cafe-money ${className}`}
        title={resolvedTitle}
        format={(v) =>
          `${prefix}${compact ? formatIndianCompact(v, { currency, decimals }) : formatIndianFull(v, { currency })}`
        }
      />
    );
  }

  const shown = compact ? formatIndianCompact(safe, { currency, decimals }) : full;
  return (
    <Tag className={`cafe-money ${className}`} title={resolvedTitle} {...rest}>
      {prefix}
      {shown}
    </Tag>
  );
}

// Non-currency large numbers (counts, totals shown big): compact + hover, but never
// masked by the privacy toggle and no ₹ prefix.
export function Num({ decimals = 0, ...props }) {
  return <Money currency={false} sensitive={false} decimals={decimals} {...props} />;
}

export default Money;
