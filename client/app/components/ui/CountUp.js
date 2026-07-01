'use client';
import { useEffect, useRef, useState } from 'react';

// Animates a number from its previous value up to `value` (starts at 0 on first
// mount) using an ease-out curve via requestAnimationFrame. Renders a <span> so it
// can be dropped straight into a stat card's value slot.
export function CountUp({ value = 0, duration = 900, prefix = '', suffix = '', decimals = 0, locale = 'en-IN', format, className }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) { setDisplay(to); return; }
    let startTs = null;
    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  // A custom `format` function (e.g. compact ₹2.42 Cr) takes over the whole render
  // — it already produces the final string including any unit/currency.
  if (typeof format === 'function') {
    return <span className={className}>{format(Number(display))}</span>;
  }

  const formatted = Number(display).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}

export default CountUp;
