'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// One global, styled tooltip for the whole app.
//
// Icon-only action buttons (edit / block / delete / view …) are unlabelled by
// design, so the user can't tell them apart without hovering. The browser's
// native `title` tooltip technically does that, but it's slow (~1s), unstyled,
// and invisible on touch. This layer upgrades EVERY such control at once, with
// no per-button wiring: it delegates hover on the document, reads the control's
// `title` (or an explicit `data-tooltip`), suppresses the native bubble, and
// shows a themed tooltip positioned next to the control.
//
// A control opts in simply by having a `title` — which 140+ of ours already do
// — or an explicit `data-tooltip`. `aria-label` is used as a fallback so a
// button that's accessible but untitled still gets a hint. Nothing to import at
// each call site; mounting this once is the whole integration.

const OPEN_DELAY = 120;   // ms — long enough to ignore a pointer just passing over
const OFFSET = 8;         // gap between control and tooltip

// Which elements deserve a tooltip: interactive controls only. A plain <div
// title="…"> (rare, usually decorative) is left to the native behaviour.
const INTERACTIVE = 'button, a, [role="button"], [role="tab"], label, summary';

export default function TooltipLayer() {
  const [tip, setTip] = useState(null); // { text, x, y, placement }
  const timer = useRef(null);
  const currentTarget = useRef(null);

  useEffect(() => {
    // A control's tooltip text: explicit data-tooltip wins, then title, then
    // aria-label. Empty/whitespace is treated as "no tooltip".
    const textFor = (el) => {
      const t = el.getAttribute('data-tooltip') || el.getAttribute('title') || el.getAttribute('aria-label');
      return t && t.trim() ? t.trim() : null;
    };

    // Suppress the native title bubble while we show our own. We stash it on a
    // data attribute and restore it on leave, so screen readers / other tooling
    // that read `title` still work when the pointer isn't hovering.
    const stashTitle = (el) => {
      if (el.hasAttribute('title')) {
        el.setAttribute('data-native-title', el.getAttribute('title'));
        el.removeAttribute('title');
      }
    };
    const restoreTitle = (el) => {
      if (el && el.hasAttribute('data-native-title')) {
        el.setAttribute('title', el.getAttribute('data-native-title'));
        el.removeAttribute('data-native-title');
      }
    };

    const place = (el, text) => {
      const r = el.getBoundingClientRect();
      // Prefer above; flip below when there isn't room near the top.
      const above = r.top > 44;
      setTip({
        text,
        x: Math.round(r.left + r.width / 2),
        y: above ? Math.round(r.top - OFFSET) : Math.round(r.bottom + OFFSET),
        placement: above ? 'top' : 'bottom',
      });
    };

    const open = (el) => {
      const text = textFor(el);
      if (!text) return;
      currentTarget.current = el;
      stashTitle(el);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        // The control may have moved/left during the delay — re-check.
        if (currentTarget.current === el && el.isConnected) place(el, text);
      }, OPEN_DELAY);
    };

    const close = () => {
      clearTimeout(timer.current);
      restoreTitle(currentTarget.current);
      currentTarget.current = null;
      setTip(null);
    };

    const onOver = (e) => {
      const el = e.target.closest?.(INTERACTIVE);
      if (!el) return;
      if (el === currentTarget.current) return;
      // Moving from one control straight to another: close the old, open the new.
      if (currentTarget.current) close();
      open(el);
    };

    const onOut = (e) => {
      if (!currentTarget.current) return;
      // Only close when the pointer actually leaves the current control's subtree.
      const to = e.relatedTarget;
      if (to && currentTarget.current.contains(to)) return;
      if (e.target.closest?.(INTERACTIVE) !== currentTarget.current) return;
      close();
    };

    // A click, scroll or key should dismiss immediately — the label has served
    // its purpose and a lingering tooltip over a now-changed view looks stuck.
    const onDismiss = () => { if (currentTarget.current) close(); };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('focusin', onOver, true);
    document.addEventListener('focusout', onOut, true);
    document.addEventListener('click', onDismiss, true);
    window.addEventListener('scroll', onDismiss, true);
    window.addEventListener('keydown', onDismiss, true);

    return () => {
      clearTimeout(timer.current);
      restoreTitle(currentTarget.current);
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('focusin', onOver, true);
      document.removeEventListener('focusout', onOut, true);
      document.removeEventListener('click', onDismiss, true);
      window.removeEventListener('scroll', onDismiss, true);
      window.removeEventListener('keydown', onDismiss, true);
    };
  }, []);

  if (!tip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y,
        transform: `translate(-50%, ${tip.placement === 'top' ? '-100%' : '0'})`,
        zIndex: 2147483000, // above every modal/drawer in the app
        pointerEvents: 'none',
      }}
      className="max-w-xs px-2.5 py-1.5 rounded-lg bg-(--color-text-primary) text-(--color-surface) text-[11px] font-semibold leading-tight shadow-[var(--shadow-md)] whitespace-nowrap animate-[tooltipIn_0.12s_ease-out]"
    >
      {tip.text}
    </div>,
    document.body
  );
}
