'use client';
import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';

const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    // Global Number Input Validation Protocols
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        const forbiddenKeys = {
          '-': 'Negative values are strictly prohibited',
          '.': 'Decimals are not permitted in this field',
          'e': 'Scientific notation is disabled',
          'E': 'Scientific notation is disabled'
        };

        if (forbiddenKeys[e.key]) {
          e.preventDefault();
          toast.error(forbiddenKeys[e.key], {
            id: 'global-input-lock',
            duration: 2000
          });
        }
      }
    };

    const handlePaste = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
        const paste = e.clipboardData.getData('text');
        if (/[-.eE]/.test(paste)) {
          e.preventDefault();
          toast.error('Only positive integers are acceptable', {
            id: 'global-input-lock',
            duration: 2000
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const value = useMemo(() => ({
    theme: mounted ? theme : 'dark',
    toggleTheme
  }), [theme, mounted]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return { theme: 'dark', toggleTheme: () => {} };
  }
  return context;
}
