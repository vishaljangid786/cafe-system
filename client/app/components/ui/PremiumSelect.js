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
          className="bg-[var(--color-surface)]/90 backdrop-blur-xl rounded-2xl border border-[var(--color-border)] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-xs font-bold text-[var(--color-text-muted)] italic text-center">No options available</div>
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
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${isSelected
                        ? 'bg-[var(--color-primary)] text-black shadow-lg shadow-[var(--color-primary)]/20'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'
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
        <label className="block text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-2.5 ml-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 text-left relative ${isOpen
            ? 'bg-[var(--color-surface)] border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/10 shadow-lg'
            : 'bg-[var(--color-surface-soft)]/50 border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
          } ${Icon ? 'pl-12' : 'pl-5'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && (
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isOpen ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
              <Icon size={18} />
            </div>
          )}
          <span className={`text-sm font-bold truncate ${!value ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
            {displayLabel || placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--color-text-muted)] transition-transform duration-500 ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`}
        />
      </button>

      {mounted && createPortal(dropdownMenu, document.body)}

      {error && (
        <p className="mt-2 ml-1 text-[10px] font-black text-[var(--color-danger)] uppercase tracking-widest italic">
          {error}
        </p>
      )}
    </div>
  );
}
