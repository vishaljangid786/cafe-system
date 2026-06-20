'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationPanel from './NotificationPanel';
import {
  Bell, User as UserIcon, Sun, Moon,
  Menu, MapPin, Zap, Search,
  ChevronLeft, ChevronRight, RefreshCw, Check, ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from './ui/PremiumSelect';

const Navbar = ({ onToggleSidebar, sidebarExpanded, isMobile }) => {
  const router = useRouter();
  const { user, selectedLocation, selectedLocationIds, switchLocation, switchLocationIds, locations, refreshLocations, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [modifierKey, setModifierKey] = useState('');
  const [showBranchPanel, setShowBranchPanel] = useState(false);
  const [pendingIds, setPendingIds] = useState([]); // draft selection inside the panel
  const branchPanelRef = useRef(null);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const isMac = typeof window !== 'undefined' && navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;
      setModifierKey(isMac ? '⌘' : 'Ctrl');
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const notificationRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);

    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (branchPanelRef.current && !branchPanelRef.current.contains(event.target)) {
        setShowBranchPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const canViewAllBranches = ['admin', 'super_admin'].includes(user?.role);

  const availableBranches = useMemo(() => {
    if (canViewAllBranches) return locations || [];

    const branches = [];
    const addBranch = (branch) => {
      if (!branch) return;
      const branchId = branch._id || branch;
      if (!branchId || branches.some((item) => (item._id || item) === branchId)) return;
      branches.push(branch);
    };

    if (Array.isArray(user?.accessibleLocations)) {
      user.accessibleLocations.forEach(addBranch);
    }
    addBranch(user?.assignedLocation);

    return branches;
  }, [canViewAllBranches, locations, user]);

  useEffect(() => {
    if (canViewAllBranches && locations.length === 0) {
      refreshLocations();
    }
  }, [canViewAllBranches, locations.length, refreshLocations]);

  const selectedLocationId = selectedLocation === 'all'
    ? 'all'
    : selectedLocation?._id || selectedLocation || (canViewAllBranches ? 'all' : '');

  // Label shown on the multi-select button for admin/super_admin
  const multiBranchLabel = selectedLocationIds.length === 0
    ? 'All Branches'
    : selectedLocationIds.length === 1
      ? (availableBranches.find(b => (b._id || b) === selectedLocationIds[0])?.name || '1 Branch')
      : `${selectedLocationIds.length} Branches`;

  const branchOptions = [
    ...(canViewAllBranches ? [{ label: 'All Branches', value: 'all' }] : []),
    ...availableBranches.map((branch) => ({
      label: branch.city && branch.name ? `${branch.city} - ${branch.name}` : branch.name || branch.city || 'Assigned Branch',
      value: branch._id || branch,
    })),
  ];

  if (!user) return null;

  return (
    <header className={`h-20 px-3 gap-2 sm:px-4 md:px-8 flex items-center justify-between z-[200] sticky top-0 transition-all duration-300 ${isScrolled
      ? 'glass bg-[var(--color-bg)]/60 backdrop-blur-xl border-b border-[var(--color-border)] shadow-[var(--shadow-premium)]'
      : 'bg-transparent border-b border-transparent'
      }`}>
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-[var(--color-text-muted)] hover:text-primary hover:bg-[var(--color-bg-soft)] transition-all rounded-xl border border-transparent hover:border-[var(--color-border)]"
        >
          {isMobile ? (
            <Menu size={20} />
          ) : (
            sidebarExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />
          )}
        </button>

        {!isMobile && (
          <button 
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'k', 
              ctrlKey: true, 
              metaKey: true,
              bubbles: true 
             }))}
            className="hidden lg:flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/30 hover:border-primary/50 transition-all text-[var(--color-text-muted)] group min-w-[280px] shadow-sm backdrop-blur-sm"
          >
            <Search size={16} className="group-hover:text-primary transition-colors" />
            <span className="text-[11px] font-bold">Search system or switch user...</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg-soft)] border border-[var(--color-border)] text-[10px] font-black text-[var(--color-text-muted)]">
                {modifierKey}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg-soft)] border border-[var(--color-border)] text-[10px] font-black text-[var(--color-text-muted)]">K</span>
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Location Selector */}
        {!isMobile && (
          <div className="relative" ref={branchPanelRef}>
            {canViewAllBranches ? (
              /* Multi-select panel for admin / super_admin */
              <>
                <button
                  onClick={() => {
                    setPendingIds(selectedLocationIds);
                    setShowBranchPanel(v => !v);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/30 hover:border-primary/50 transition-all text-sm font-bold text-[var(--color-text-primary)] min-w-[200px] shadow-sm backdrop-blur-sm"
                >
                  <MapPin size={15} className="text-[var(--color-primary)] shrink-0" />
                  <span className="flex-1 text-left truncate text-[11px] font-black uppercase tracking-wider">{multiBranchLabel}</span>
                  <ChevronDown size={14} className={`text-[var(--color-text-muted)] transition-transform ${showBranchPanel ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showBranchPanel && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-[300] overflow-hidden"
                    >
                      <div className="p-2 border-b border-[var(--color-border)]">
                        <button
                          onClick={() => setPendingIds([])}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${pendingIds.length === 0 ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'}`}
                        >
                          <Check size={13} className={pendingIds.length === 0 ? 'opacity-100' : 'opacity-0'} />
                          All Branches
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                        {availableBranches.map(branch => {
                          const id = branch._id || branch;
                          const checked = pendingIds.includes(id);
                          return (
                            <button
                              key={id}
                              onClick={() => setPendingIds(prev =>
                                checked ? prev.filter(x => x !== id) : [...prev, id]
                              )}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all ${checked ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'}`}
                            >
                              <span className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>
                                {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                              </span>
                              <span className="truncate">{branch.city && branch.name ? `${branch.city} — ${branch.name}` : branch.name || branch.city}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-[var(--color-border)]">
                        <button
                          onClick={() => {
                            switchLocationIds(pendingIds);
                            setShowBranchPanel(false);
                          }}
                          className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                        >
                          Apply
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              /* Single-select for branch_admin / location_admin */
              <div className="w-[220px]">
                <PremiumSelect
                  icon={MapPin}
                  label="Active Branch"
                  value={selectedLocationId}
                  onChange={(value) => {
                    const nextLocation = availableBranches.find((branch) => (branch._id || branch) === value);
                    switchLocation(nextLocation || value);
                  }}
                  options={branchOptions}
                  placeholder="Assigned Branch"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="relative flex items-center gap-2 bg-[var(--color-bg-soft)]/50 p-1.5 rounded-2xl border border-[var(--color-border)] shadow-inner backdrop-blur-sm">
          <button
            onClick={toggleTheme}
            className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all rounded-xl hover:bg-[var(--color-bg)] hover:shadow-sm"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
          <button
            onClick={() => window.location.reload()}
            className="p-2.5 text-[var(--color-text-muted)] hover:text-primary transition-all rounded-xl hover:bg-[var(--color-bg)] hover:shadow-sm group"
            title="Refresh Page"
          >
            <RefreshCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
          </button>
          <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2.5 relative transition-all rounded-xl hover:bg-[var(--color-bg)] hover:shadow-sm ${showNotifications ? 'text-primary bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-[var(--color-danger)] rounded-full ring-2 ring-[var(--color-bg)] animate-pulse" />
            )}
          </button>

          <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>

        {/* User Identity Section */}
        <div className="flex items-center gap-4 pl-4 border-l border-[var(--color-border)]">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-xs font-black text-[var(--color-text-primary)]">{user.name}</span>
            <span className="text-[9px] font-black text-[var(--color-success)] uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
              <span className="h-1 w-1 bg-[var(--color-success)] rounded-full animate-ping" /> Active Staff
            </span>
          </div>
          <Link
            href="/dashboard/profile"
            className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-blue-600 p-[1.5px] group cursor-pointer shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all active:scale-95 overflow-hidden"
          >
            <div className="h-full w-full rounded-[0.9rem] bg-[var(--color-bg)] flex items-center justify-center text-primary overflow-hidden">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.name}
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              ) : (
                <UserIcon size={20} />
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
