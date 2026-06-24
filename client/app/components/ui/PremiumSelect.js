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
  multiple = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
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
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
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
            top: coords.top + 8,
            left: coords.left,
            width: coords.width,
            zIndex: 999999
          }}
          className="bg-(--color-surface) rounded-lg border border-(--color-border) shadow-[var(--shadow-md)] overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${isSelected
                        ? 'bg-primary text-(--color-on-primary)'
                        : 'text-(--color-text-secondary) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'
                      }`}
                  >
                    <span className="truncate pr-4">{optLabel}</span>
                    {isSelected && <Check size={14} strokeWidth={3} />}
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
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-colors duration-200 text-left relative ${isOpen
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
