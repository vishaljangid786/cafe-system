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
        <label className="label block mb-1.5 ml-0.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-colors duration-200
          ${isOpen
            ? 'bg-[var(--color-surface)] border-[var(--color-primary)]'
            : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]'}
        `}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          {Icon && <Icon size={16} className={isOpen ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />}
          <span className={`text-sm font-medium truncate ${selectedOption ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            {selectedOption ? (selectedOption.label || selectedOption.name || selectedOption.city) : placeholder}
          </span>
        </div>
        <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-[110] w-full mt-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-md)] overflow-hidden p-1.5"
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
                      w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors duration-150
                      ${isSelected
                        ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium'
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
