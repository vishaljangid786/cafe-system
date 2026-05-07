'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationPanel from './NotificationPanel';
import {
  Bell, User as UserIcon, Sun, Moon,
  Menu, MapPin, Zap, Search,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Navbar = ({ onToggleSidebar, sidebarExpanded, isMobile }) => {
  const { user, selectedLocation, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [modifierKey, setModifierKey] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const isMac = typeof window !== 'undefined' && navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;
      setModifierKey(isMac ? '⌘' : 'Ctrl');
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const locationRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);

    const handleClickOutside = (event) => {
      if (locationRef.current && !locationRef.current.contains(event.target)) {
        setShowLocationSelector(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!user) return null;

  const currentLocationLabel = selectedLocation
    ? `${selectedLocation.city} - ${selectedLocation.name}`
    : (['admin', 'super_admin'].includes(user.role) ? 'Select Branch' : 'Assigned Branch');

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
        {/* Location Selector Dropdown */}
        {!isMobile && <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 rounded-2xl border bg-[var(--color-bg-soft)]/50 border-[var(--color-border)] backdrop-blur-sm">

          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <MapPin size={14} />
          </div>

          <div className="flex flex-col items-start leading-none pr-1">
            <span className="hidden sm:inline text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-1">
              Active Branch
            </span>

            <span className="text-[10px] md:text-xs font-black text-[var(--color-text-primary)] max-w-[120px] truncate">
              {selectedLocation
                ? `${selectedLocation.city} - ${selectedLocation.name}`
                : (['admin', 'super_admin'].includes(user.role)
                  ? 'Global Cafe'
                  : 'Assigned Branch')}
            </span>
          </div>
        </div>}

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
              <span className="h-1 w-1 bg-[var(--color-success)] rounded-full animate-ping" /> Authorized
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
