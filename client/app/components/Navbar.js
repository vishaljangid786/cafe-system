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

  const canUseBranchPanel = canViewAllBranches || (user?.role === 'branch_admin' && availableBranches.length > 1);

  useEffect(() => {
    if ((canViewAllBranches || user?.role === 'branch_admin') && locations.length === 0) {
      refreshLocations();
    }
  }, [canViewAllBranches, locations.length, refreshLocations, user?.role]);

  const selectedLocationId = selectedLocation === 'all'
    ? 'all'
    : selectedLocation?._id || selectedLocation || (canUseBranchPanel ? 'all' : '');

  // Label shown on the multi-select button for admin/super_admin
  const multiBranchLabel = (() => {
    if (selectedLocationIds.length === 0) {
      if (selectedLocation) {
        const selectedId = selectedLocation._id || selectedLocation;
        return availableBranches.find(b => (b._id || b) === selectedId)?.name || '1 Branch';
      }
      return canViewAllBranches ? 'All Branches' : 'All Assigned Branches';
    }
    if (selectedLocationIds.length === 1) {
      return availableBranches.find(b => (b._id || b) === selectedLocationIds[0])?.name || '1 Branch';
    }
    return `${selectedLocationIds.length} Branches`;
  })();

  const branchOptions = [
    ...(canUseBranchPanel ? [{ label: canViewAllBranches ? 'All Branches' : 'All Assigned Branches', value: 'all' }] : []),
    ...availableBranches.map((branch) => ({
      label: branch.city && branch.name ? `${branch.city} - ${branch.name}` : branch.name || branch.city || 'Assigned Branch',
      value: branch._id || branch,
    })),
  ];

  if (!user) return null;

  return (
    <header className={`h-16 px-3 gap-2 sm:px-4 md:px-8 flex items-center justify-between z-[200] sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-shadow duration-300 ${isScrolled ? 'shadow-[var(--shadow-sm)]' : ''}`}>
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-soft)] transition-colors rounded-lg"
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
            className="hidden lg:flex items-center gap-3 px-3.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors text-[var(--color-text-muted)] group min-w-[280px]"
          >
            <Search size={16} className="group-hover:text-[var(--color-text-primary)] transition-colors" />
            <span className="text-sm">Search or switch user...</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-muted)]">
                {modifierKey}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-muted)]">K</span>
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Location Selector */}
        {!isMobile && (
          <div className="relative" ref={branchPanelRef}>
            {canUseBranchPanel ? (
              /* Multi-select panel for admin / super_admin / multi-branch branch_admin */
              <>
                <button
                  onClick={() => {
                    setPendingIds(selectedLocationIds.length > 0 ? selectedLocationIds : (selectedLocation ? [selectedLocation._id || selectedLocation] : []));
                    setShowBranchPanel(v => !v);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors text-sm font-medium text-[var(--color-text-primary)] min-w-[200px]"
                >
                  <MapPin size={15} className="text-[var(--color-primary)] shrink-0" />
                  <span className="flex-1 text-left truncate text-sm font-medium">{multiBranchLabel}</span>
                  <ChevronDown size={14} className={`text-[var(--color-text-muted)] transition-transform ${showBranchPanel ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showBranchPanel && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-md)] z-[300] overflow-hidden"
                    >
                      <div className="p-2 border-b border-[var(--color-border)]">
                        <button
                          onClick={() => setPendingIds([])}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${pendingIds.length === 0 ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'}`}
                        >
                          <Check size={13} className={pendingIds.length === 0 ? 'opacity-100' : 'opacity-0'} />
                          {canViewAllBranches ? 'All Branches' : 'All Assigned Branches'}
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
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${checked ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-soft)] text-[var(--color-text-primary)]'}`}
                            >
                              <span className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border-strong)]'}`}>
                                {checked && <Check size={10} className="text-[var(--color-on-primary)]" strokeWidth={3} />}
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
                          className="w-full py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
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
        <div className="relative flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors rounded-lg hover:bg-[var(--color-surface-soft)]"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="p-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors rounded-lg hover:bg-[var(--color-surface-soft)] group"
            title="Refresh Page"
          >
            <RefreshCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
          </button>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2.5 relative transition-colors rounded-lg hover:bg-[var(--color-surface-soft)] ${showNotifications ? 'text-[var(--color-primary)] bg-[var(--color-surface-soft)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 bg-[var(--color-danger)] rounded-full ring-2 ring-[var(--color-bg)]" />
            )}
          </button>

          <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>

        {/* User Identity Section */}
        <div className="flex items-center gap-3 pl-3 border-l border-[var(--color-border)]">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{user.name}</span>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-[var(--color-success)] rounded-full" /> Active
            </span>
          </div>
          <Link
            href="/dashboard/profile"
            className="h-10 w-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-primary)] group cursor-pointer hover:border-[var(--color-border-strong)] transition-colors active:scale-95 overflow-hidden"
          >
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon size={20} />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
