'use client';
import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

// Global "hide values" (privacy) toggle. When on, every money/sensitive figure
// rendered through <Money> is replaced with a dot mask (₹•••••) app-wide. The
// choice is persisted in localStorage and mirrored on <html class="values-hidden">
// so an inline head script can prevent a flash of real numbers on reload.
const ValueVisibilityContext = createContext({
  hidden: false,
  toggle: () => {},
  setHidden: () => {},
});

const STORAGE_KEY = 'cafe:valuesHidden';

export function ValueVisibilityProvider({ children }) {
  const [hidden, setHiddenState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read the persisted preference on the client only (avoids SSR/hydration mismatch).
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const isHidden = saved === '1';
      setHiddenState(isHidden);
      document.documentElement.classList.toggle('values-hidden', isHidden);
    } catch {
      /* localStorage unavailable — default to shown */
    }
  }, []);

  const setHidden = useCallback((next) => {
    setHiddenState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
        document.documentElement.classList.toggle('values-hidden', value);
      } catch {
        /* ignore persistence errors */
      }
      return value;
    });
  }, []);

  const toggle = useCallback(() => setHidden((v) => !v), [setHidden]);

  const value = useMemo(
    () => ({ hidden: mounted ? hidden : false, toggle, setHidden }),
    [hidden, mounted, toggle, setHidden]
  );

  return (
    <ValueVisibilityContext.Provider value={value}>
      {children}
    </ValueVisibilityContext.Provider>
  );
}

export function useValueVisibility() {
  return useContext(ValueVisibilityContext);
}
