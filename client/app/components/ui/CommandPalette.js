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
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearch('');
      setSelectedIndex(0);
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
          { type: 'nav', name: 'Personnel Matrix', path: '/dashboard/admin/users', icon: User },
          { type: 'nav', name: 'Menu & Inventory', path: '/dashboard/admin/menu', icon: FileSpreadsheet },
          { type: 'nav', name: 'Expense Logs', path: '/dashboard/admin/expenses', icon: Shield },
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
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[9998]"
          />
          <div className="fixed inset-0 flex items-start justify-center sm:pt-[15vh] pt-4 p-4 z-[9999] pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -20 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-xl sm:rounded-3xl rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 pointer-events-auto flex flex-col max-h-[85vh] sm:max-h-[60vh]"
            >
              <div className="flex items-center px-6 border-b border-zinc-100 dark:border-zinc-800">
                <Search className="text-zinc-400 mr-4" size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a command or search users..."
                  className="flex-1 py-6 bg-transparent border-none outline-none text-base font-medium text-zinc-900 dark:text-zinc-100"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <span className="text-[10px] font-black text-zinc-500 uppercase">ESC</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {loading && (
                  <div className="p-4 text-center text-zinc-400 text-sm font-medium">Synchronizing matrix...</div>
                )}
                
                {!loading && results.length === 0 && search && (
                  <div className="p-8 text-center space-y-2">
                    <div className="text-zinc-900 dark:text-zinc-100 font-bold">No results found</div>
                    <div className="text-zinc-400 text-xs">Try searching for 'Expenses' or a user's name</div>
                  </div>
                )}

                {!loading && !search && (
                  <div className="p-4 space-y-4">
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Quick Navigation</div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { name: 'Personnel Matrix', path: '/dashboard/admin/users', icon: User },
                        { name: 'Analytics Terminal', path: '/dashboard/admin', icon: Navigation },
                        { name: 'Financial Logs', path: '/dashboard/admin/expenses', icon: Shield },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelect({ type: 'nav', path: item.path })}
                          className="flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-left"
                        >
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                            <item.icon size={18} />
                          </div>
                          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {results.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(item)}
                    className={`flex items-center justify-between w-full p-4 rounded-2xl transition-all ${idx === selectedIndex ? 'bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20' : 'border border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'user' ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/10' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
                        <item.icon size={18} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                        {item.subtext && <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{item.subtext}</div>}
                      </div>
                    </div>
                    {idx === selectedIndex && <ChevronRight size={16} className="text-amber-500" />}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px]">↵</kbd>
                    <span>Select</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-[10px]">↑↓</kbd>
                    <span>Navigate</span>
                  </div>
                </div>
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Command size={12} />
                  Enterprise Matrix v1.0
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
