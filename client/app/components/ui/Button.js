'use client';
import { motion } from 'framer-motion';

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon: Icon,
  disabled = false,
  type = 'button',
  loading = false
}) => {
  const variants = {
    primary: 'bg-[var(--color-primary)] text-[var(--color-bg-base)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-primary-dark)]',
    secondary: 'bg-[var(--color-surface-soft)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] border border-[var(--color-border)]',
    outline: 'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
    ghost: 'bg-transparent hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
    danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] hover:text-[var(--color-bg-base)] shadow-[var(--shadow-soft)]',
    glass: 'glass-morphism text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]'
  };

  return (
    <motion.button
      type={type}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center px-5 py-2.5 
        rounded-xl font-semibold text-sm tracking-wide transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden focus-ring
        ${variants[variant]}
        ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Processing...</span>
        </div>
      ) : (
        <>
          {Icon && <Icon size={18} className={children ? 'mr-2' : ''} />}
          {children}
        </>
      )}

      {/* Shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
    </motion.button>
  );
};
