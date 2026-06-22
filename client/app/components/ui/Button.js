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
    primary: 'bg-primary text-(--color-on-primary) hover:bg-(--color-primary-hover)',
    secondary: 'bg-(--color-surface-soft) text-(--color-text-primary) hover:bg-(--color-border) border border-(--color-border)',
    outline: 'border border-(--color-border) bg-transparent hover:bg-(--color-hover) text-(--color-text-secondary) hover:text-(--color-text-primary)',
    ghost: 'bg-transparent hover:bg-(--color-hover) text-(--color-text-muted) hover:text-(--color-text-primary)',
    danger: 'bg-danger text-white hover:opacity-90',
    glass: 'bg-(--color-surface-soft) text-(--color-text-primary) border border-(--color-border) hover:bg-(--color-border)'
  };

  return (
    <motion.button
      type={type}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative inline-flex items-center justify-center px-4 py-2.5
        rounded-lg font-semibold text-sm transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed focus-ring
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
    </motion.button>
  );
};
