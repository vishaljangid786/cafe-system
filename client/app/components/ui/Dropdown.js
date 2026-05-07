'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Dropdown = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Select Option",
  className = "",
  icon: Icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options.find(opt => opt.id === value);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2.5 ml-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300
          ${isOpen
            ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/50 shadow-lg shadow-[var(--color-primary)]/5'
            : 'bg-[var(--color-surface-soft)]/50 border-[var(--color-border)] hover:border-[var(--color-primary)]/30'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && <Icon size={16} className={isOpen ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />}
          <span className={`text-sm font-bold truncate ${selectedOption ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {selectedOption ? (selectedOption.label || selectedOption.name || selectedOption.city) : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform duration-500 ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-[110] w-full mt-2 bg-[var(--color-surface)]/95 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden p-1.5"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((option) => {
                const optValue = option.value || option.id || option._id;
                const isSelected = value === optValue;

                return (
                  <button
                    key={optValue}
                    type="button"
                    onClick={() => {
                      onChange(optValue);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs transition-all duration-200
                      ${isSelected
                        ? 'bg-[var(--color-primary)] text-[var(--color-bg-base)] font-black'
                        : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}
                    `}
                  >
                    <span className="truncate">{option.label || option.name || option.city}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;
