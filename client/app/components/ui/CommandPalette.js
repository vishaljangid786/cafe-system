'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, User, FileSpreadsheet, Navigation, 
  ChevronRight, Command, X, Shield, Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { user: currentUser, impersonate } = useAuth();
  const router = useRouter();
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        setSearch('');
        setSelectedIndex(0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        // Search local navigation and users
        const navItems = [
          { type: 'nav', name: 'Go to Dashboard', path: '/dashboard/admin', icon: Navigation },
          { type: 'nav', name: 'Staff List', path: '/dashboard/admin/users', icon: User },
          { type: 'nav', name: 'Menu & Items', path: '/dashboard/admin/menu', icon: FileSpreadsheet },
          { type: 'nav', name: 'Expenses', path: '/dashboard/admin/expenses', icon: Shield },
        ].filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

        let userResults = [];
        if (currentUser?.role === 'super_admin' && !currentUser.impersonatedBy) {
          const res = await api.get(`/users?search=${search}`);
          userResults = res.data.data.slice(0, 5).map(u => ({
            type: 'user',
            name: `Impersonate: ${u.name}`,
            subtext: u.role,
            id: u._id,
            icon: User,
            fullAccess: true
          }));
          
          const viewOnlyResults = res.data.data.slice(0, 5).map(u => ({
            type: 'user',
            name: `View: ${u.name} (View-Only)`,
            subtext: u.role,
            id: u._id,
            icon: Eye,
            fullAccess: false
          }));
          userResults = [...userResults, ...viewOnlyResults];
        }

        setResults([...navItems, ...userResults]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [search, currentUser]);

  const handleSelect = async (item) => {
    if (item.type === 'nav') {
      router.push(item.path);
    } else if (item.type === 'user') {
      if (confirm(`Initiate ${item.fullAccess ? 'FULL-ACCESS' : 'VIEW-ONLY'} impersonation for ${item.name}?`)) {
        await impersonate(item.id, !item.fullAccess);
      }
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 z-[9998]"
          />
          <div className="fixed inset-0 flex items-start justify-center sm:pt-[15vh] pt-4 p-4 z-[9999] pointer-events-none">
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: -8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="bg-[var(--color-surface)] w-full max-w-xl rounded-xl overflow-hidden shadow-[var(--shadow-md)] border border-[var(--color-border)] pointer-events-auto flex flex-col max-h-[85vh] sm:max-h-[60vh]"
            >
              <div className="flex items-center px-5 border-b border-[var(--color-border)]">
                <Search className="text-[var(--color-text-muted)] mr-3" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a command or search users..."
                  className="flex-1 py-4 bg-transparent border-none outline-none text-base font-medium text-[var(--color-text-primary)]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-surface-soft)] rounded-md">
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)]">ESC</span>
                </div>
              </div>
 
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {loading && (
                  <div className="p-4 text-center text-[var(--color-text-muted)] text-sm font-medium">Searching...</div>
                )}
                
                {!loading && results.length === 0 && search && (
                  <div className="p-8 text-center space-y-2">
                    <div className="text-[var(--color-text-primary)] font-bold">No results found</div>
                    <div className="text-[var(--color-text-muted)] text-xs">Try searching for &apos;Expenses&apos; or a user&apos;s name</div>
                  </div>
                )}
 
                {!loading && !search && (
                  <div className="p-2 space-y-3">
                    <div className="label px-2">Quick Navigation</div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { name: 'Staff List', path: '/dashboard/admin/users', icon: User },
                        { name: 'Dashboard', path: '/dashboard/admin', icon: Navigation },
                        { name: 'Expenses', path: '/dashboard/admin/expenses', icon: Shield },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelect({ type: 'nav', path: item.path })}
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors text-left"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-soft)] flex items-center justify-center text-[var(--color-text-muted)]">
                            <item.icon size={18} />
                          </div>
                          <span className="text-sm font-medium text-[var(--color-text-secondary)]">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {results.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between w-full p-2.5 rounded-lg transition-colors ${idx === selectedIndex ? 'bg-[var(--color-primary-soft)] border border-[rgba(var(--color-primary-rgb),0.2)]' : 'border border-transparent hover:bg-[var(--color-surface-soft)]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.type === 'user' ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}>
                        <item.icon size={18} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.name}</div>
                        {item.subtext && <div className="text-xs text-[var(--color-text-muted)]">{item.subtext}</div>}
                      </div>
                    </div>
                    {idx === selectedIndex && <ChevronRight size={16} className="text-[var(--color-primary)]" />}
                  </button>
                ))}
              </div>

              <div className="p-3 border-t border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded text-[10px]">↵</kbd>
                    <span>Select</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded text-[10px]">↑↓</kbd>
                    <span>Navigate</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                  <Command size={12} />
                  Cafe Management v1.0
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
