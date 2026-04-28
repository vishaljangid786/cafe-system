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
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
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
          initial={{ opacity: 0, y: 5, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 5, scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: coords.top - window.scrollY + 8,
            left: coords.left - window.scrollX,
            width: coords.width,
            zIndex: 999999
          }}
          className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-xs font-bold text-zinc-400 italic text-center">No options available</div>
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
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
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
        <label className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-2.5 ml-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-300 text-left relative ${isOpen
            ? 'bg-white dark:bg-zinc-900 border-amber-500 ring-4 ring-amber-500/10 shadow-lg'
            : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-amber-500/30'
          } ${Icon ? 'pl-12' : 'pl-5'}`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && (
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isOpen ? 'text-amber-500' : 'text-zinc-400'}`}>
              <Icon size={18} />
            </div>
          )}
          <span className={`text-sm font-bold truncate ${!value ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {displayLabel || placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-zinc-400 transition-transform duration-500 ${isOpen ? 'rotate-180 text-amber-500' : ''}`}
        />
      </button>

      {mounted && createPortal(dropdownMenu, document.body)}

      {error && (
        <p className="mt-2 ml-1 text-[10px] font-black text-rose-500 uppercase tracking-widest italic">
          {error}
        </p>
      )}
    </div>
  );
}
