// Compact Indian-style number formatting for dense dashboards.
//
// Uses Indian units: L = lakh (1e5), Cr = crore (1e7). Below 1 lakh the full
// Indian-grouped number is kept (e.g. ₹45,000) since those aren't "big". Very large
// crore values are themselves Indian-grouped (e.g. ₹12,34,568 Cr) so they stay
// readable instead of turning into a 14-digit wall.

const trimDecimals = (x, decimals) => Number(x.toFixed(decimals)).toString();

export function formatIndianCompact(value, { currency = false, decimals = 2 } = {}) {
  const n = Number(value);
  const cur = currency ? '₹' : '';
  if (!Number.isFinite(n)) return `${cur}0`;

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  if (abs >= 1e7) {
    const cr = abs / 1e7;
    // Keep huge crore figures grouped rather than a long decimal.
    const str = cr >= 1000 ? Math.round(cr).toLocaleString('en-IN') : trimDecimals(cr, decimals);
    return `${sign}${cur}${str} Cr`;
  }
  if (abs >= 1e5) {
    return `${sign}${cur}${trimDecimals(abs / 1e5, decimals)} L`;
  }
  // Under a lakh — show the full number with Indian grouping (no unit suffix).
  return `${sign}${cur}${Math.round(abs).toLocaleString('en-IN')}`;
}

// Convenience wrapper for money stat cards (prefixes ₹).
export const formatCompactCurrency = (value) => formatIndianCompact(value, { currency: true });
