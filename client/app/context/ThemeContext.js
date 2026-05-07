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
    const mountedTimer = setTimeout(() => {
      setMounted(true);
    }, 0);
    
    const initializeTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const initialTheme = savedTheme || systemTheme;
      
      setTheme(initialTheme);
      document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    };

    initializeTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Global Number Input Validation System Rules
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
      clearTimeout(mountedTimer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
      mediaQuery.removeEventListener('change', handleChange);
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
