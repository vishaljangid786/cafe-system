'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

// A single ⋮ button that opens a floating action menu. The menu is rendered in a
// portal at a fixed position next to the button, so it never shifts the row/table
// layout and never gets clipped by an overflow container. Closes on outside click,
// scroll, resize or Escape.
//
// items: [{ key, icon, label, onClick, danger?, show? }]  — items with show===false are hidden.
export default function RowActionsMenu({ items = [], size = 18, buttonClassName = '', label = 'Actions' }) {
  const visible = items.filter((i) => i && i.show !== false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 208 });

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuW = 212;
    const estH = Math.min(visible.length, 9) * 40 + 12;
    let top = r.bottom + 6;
    if (top + estH > window.innerHeight - 8) top = Math.max(8, r.top - estH - 6); // flip up when cramped
    let left = r.right - menuW;
    if (left < 8) left = 8;
    setPos({ top, left, width: menuW });
  }, [visible.length]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!open) place();
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!visible.length) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`p-2.5 rounded-xl transition-all ${open ? 'bg-primary/10 text-primary' : 'text-(--color-text-muted) hover:text-primary hover:bg-primary/10'} ${buttonClassName}`}
      >
        <MoreVertical size={size} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="rounded-xl border border-(--color-border) bg-(--color-surface) shadow-lg py-1.5 overflow-hidden"
        >
          {visible.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick?.(e); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-left transition-colors ${
                  it.danger
                    ? 'text-danger hover:bg-danger/10'
                    : 'text-(--color-text-secondary) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'
                }`}
              >
                {Icon && <Icon size={15} className="shrink-0" />}
                <span className="truncate">{it.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
