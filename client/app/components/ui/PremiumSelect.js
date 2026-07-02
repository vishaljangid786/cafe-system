'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export default function PremiumSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select option',
  label,
  error,
  icon: Icon,
  className = "",
  multiple = false,
  wrapOptions = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const autoSelectedRef = useRef(null);

  // Convenience: when a single-select has exactly ONE option and nothing has been
  // chosen yet, pick it automatically so the user doesn't have to. The ref makes it
  // fire once per distinct option value (no re-select loop, and a real user choice
  // is never overridden — we only act when the current value is empty).
  useEffect(() => {
    if (multiple || typeof onChange !== 'function' || options.length !== 1) {
      autoSelectedRef.current = null;
      return;
    }
    const only = typeof options[0] === 'object' ? options[0].value : options[0];
    const isEmpty = value === undefined || value === null || value === '';
    if (isEmpty && only !== '' && only != null && autoSelectedRef.current !== only) {
      autoSelectedRef.current = only;
      onChange(only);
    }
  }, [options, value, multiple, onChange]);
  const [coords, setCoords] = useState({ top: 0, bottom: 0, left: 0, width: 0, openUp: false, maxHeight: 256 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const updateCoords = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const GAP = 8;
    const MAX = 256; // design max dropdown height (was max-h-64)
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    // Flip up only when there isn't enough room below AND there's more above.
    // Either way we cap the menu to the space actually available so its options
    // never spill past the viewport (where a fixed-position menu can't scroll).
    const openUp = spaceBelow < Math.min(MAX, 200) && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    setCoords({
      top: rect.bottom + GAP,
      bottom: window.innerHeight - rect.top + GAP,
      left: rect.left,
      width: rect.width,
      openUp,
      maxHeight: Math.max(140, Math.min(MAX, available)),
    });
  };

  // Open/close the menu. When opening we measure the trigger synchronously and
  // set the coords in the SAME render pass as `isOpen`, so the portal never
  // paints its first frame at (0,0)/width:0 and then jumps — which read as a
  // flash / "loading" glitch.
  const toggleOpen = () => {
    setIsOpen((prev) => {
      if (!prev) updateCoords();
      return !prev;
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  let displayLabel = placeholder;
  if (multiple && Array.isArray(value)) {
    displayLabel = value.length > 0 ? `${value.length} Selected` : placeholder;
  } else {
    const selectedOption = options.find(opt => opt.value === value) || options.find(opt => opt === value);
    displayLabel = selectedOption ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption) : placeholder;
  }

  const dropdownMenu = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: 5, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: coords.openUp ? 'auto' : coords.top,
            bottom: coords.openUp ? coords.bottom : 'auto',
            left: coords.left,
            width: coords.width,
            zIndex: 999999
          }}
          className="bg-(--color-surface) rounded-lg border border-(--color-border) shadow-[var(--shadow-md)] overflow-hidden"
        >
          <div className="overflow-y-auto custom-scrollbar p-1.5 space-y-1" style={{ maxHeight: coords.maxHeight }}>
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-(--color-text-muted) text-center">No options available</div>
            ) : (
              options.map((option, idx) => {
                const optValue = typeof option === 'object' ? option.value : option;
                const optLabel = typeof option === 'object' ? option.label : option;
                const isSelected = multiple 
                  ? (Array.isArray(value) && value.includes(optValue))
                  : optValue === value;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (multiple) {
                        const newValue = Array.isArray(value) ? [...value] : [];
                        const index = newValue.indexOf(optValue);
                        if (index > -1) newValue.splice(index, 1);
                        else newValue.push(optValue);
                        onChange(newValue);
                      } else {
                        onChange(optValue);
                        setIsOpen(false);
                      }
                    }}
                    className={`w-full flex justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${wrapOptions ? 'items-start gap-2' : 'items-center'} ${isSelected
                        ? 'bg-primary text-(--color-on-primary)'
                        : 'text-(--color-text-secondary) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'
                      }`}
                  >
                    <span className={wrapOptions ? 'flex-1 text-left whitespace-normal wrap-break-word' : 'truncate pr-4'}>{optLabel}</span>
                    {isSelected && <Check size={14} strokeWidth={3} className={wrapOptions ? 'shrink-0 mt-0.5' : undefined} />}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="label block mb-1.5 ml-0.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-colors duration-200 text-left relative ${error
            ? 'bg-(--color-surface) border-danger'
            : isOpen
            ? 'bg-(--color-surface) border-primary'
            : 'bg-(--color-surface) border-(--color-border) hover:border-(--color-border-strong)'
          } ${Icon ? 'pl-11' : 'pl-3.5'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && (
            <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${isOpen ? 'text-primary' : 'text-(--color-text-muted)'}`}>
              <Icon size={18} />
            </div>
          )}
          <span className={`text-sm font-medium truncate ${!value ? 'text-(--color-text-muted)' : 'text-(--color-text-primary)'}`}>
            {displayLabel || placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-(--color-text-muted) transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}
        />
      </button>

      {mounted && createPortal(dropdownMenu, document.body)}

      {error && (
        <p className="mt-1.5 ml-0.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
