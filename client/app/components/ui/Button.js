'use client';
import { motion } from 'framer-motion';

export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  icon: Icon,
  disabled = false,
  type = 'button'
}) => {
  const variants = {
    primary: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20',
    secondary: 'bg-muted text-foreground hover:bg-muted/80',
    outline: 'border-2 border-border bg-transparent hover:bg-muted text-foreground',
    ghost: 'bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
  };

  return (
    <motion.button
      type={type}
      whileHover={!disabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center px-6 py-2.5 
        rounded-2xl font-bold text-sm tracking-tight transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${className}
      `}
    >
      {Icon && <Icon size={18} className={children ? 'mr-2' : ''} />}
      {children}
    </motion.button>
  );
};
