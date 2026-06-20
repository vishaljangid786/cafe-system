'use client';

/**
 * Global top progress bar — a single thin gradient bar pinned to the very top
 * of the viewport that trickles forward while work is happening and snaps to
 * 100% when it finishes (YouTube / NProgress style).
 *
 * It is driven two ways:
 *   1. Automatically  — starts on internal link clicks + programmatic route
 *      changes, completes when the new pathname renders.
 *   2. Manually       — any module can call `progress.start()` / `progress.done()`
 *      (or `progress.set(n)`) to tie the bar to a real async operation such as a
 *      data fetch. Calls are reference-counted so concurrent fetches behave.
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// ---- Module-level singleton store -----------------------------------------
const listeners = new Set();
let state = { active: false, value: 0 };
let pending = 0; // reference count of in-flight start() calls
let trickleTimer = null;
let doneTimer = null;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const emit = () => listeners.forEach((l) => l(state));

const setState = (next) => {
  state = next;
  emit();
};

const stopTrickle = () => {
  if (trickleTimer) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
};

const startTrickle = () => {
  stopTrickle();
  trickleTimer = setInterval(() => {
    if (state.value < 92) progress.inc();
    else stopTrickle();
  }, 320);
};

export const progress = {
  /** Begin (or join) a loading cycle. Reference-counted. */
  start() {
    pending += 1;
    if (state.active) return;
    if (doneTimer) {
      clearTimeout(doneTimer);
      doneTimer = null;
    }
    setState({ active: true, value: 8 });
    startTrickle();
  },

  /** Nudge the bar forward by a diminishing amount. */
  inc(amount) {
    if (!state.active) return;
    const v = state.value;
    const delta =
      amount ?? (v < 25 ? 9 : v < 50 ? 5 : v < 75 ? 3 : v < 90 ? 1.2 : 0.4);
    progress.set(v + delta);
  },

  /** Jump to an explicit percentage (never moves backwards while active). */
  set(v) {
    if (!state.active) setState({ active: true, value: clamp(v, 0, 99) });
    else setState({ active: true, value: clamp(Math.max(state.value, v), 0, 99) });
  },

  /** Finish one loading cycle; only completes once all are done. */
  done(force = false) {
    pending = force ? 0 : Math.max(0, pending - 1);
    if (pending > 0) return;
    stopTrickle();
    setState({ active: true, value: 100 });
    if (doneTimer) clearTimeout(doneTimer);
    doneTimer = setTimeout(() => setState({ active: false, value: 0 }), 380);
  },
};

/**
 * Wrap a promise so the bar runs for its lifetime:
 *   const data = await progress.track(api.get('/x'));
 */
progress.track = (promiseLike) => {
  progress.start();
  return Promise.resolve(promiseLike).finally(() => progress.done());
};

// ---- Bar component ---------------------------------------------------------
export default function TopProgressBar() {
  const [s, setS] = useState(state);

  useEffect(() => {
    const l = (next) => setS({ ...next });
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);

  // Keep the node mounted briefly after completion so the fade-out is visible.
  const visible = s.active || s.value > 0;
  if (!visible) return null;

  const finishing = s.value >= 100;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px]"
    >
      <div
        className="relative h-full origin-left bg-[var(--color-primary)]"
        style={{
          width: `${s.value}%`,
          opacity: finishing ? 0 : 1,
          transition: finishing
            ? 'width 200ms ease-out, opacity 350ms ease-in 150ms'
            : 'width 220ms cubic-bezier(0.65,0,0.35,1)',
        }}
      />
    </div>
  );
}

/**
 * Mount once (in the root layout). Starts the bar on internal navigations and
 * completes it whenever the pathname changes.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  // Complete on every pathname change (after the initial mount).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    progress.done(true);
  }, [pathname]);

  // Start as soon as the user clicks an internal link — instant feedback,
  // before Next.js has finished rendering the destination.
  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      progress.start();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
