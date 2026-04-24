'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Bell, User as UserIcon, Sun, Moon,
  Menu, MapPin, Zap, Search,

} from 'lucide-react';
import Link from 'next/link';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const Navbar = ({ onToggleSidebar, sidebarExpanded, isMobile }) => {
  const { user, selectedLocation, logout, socket } = useAuth(); const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [modifierKey, setModifierKey] = useState('⌘');
  
  useEffect(() => {
    const isMac = typeof window !== 'undefined' && navigator?.platform?.toUpperCase().indexOf('MAC') >= 0;
    setModifierKey(isMac ? '⌘' : 'Ctrl');
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

    if (user) {
      const fetchNotifications = async () => {
        try {
          const res = await api.get('/notifications?limit=5');
          setNotifications(res.data.data);
          const countRes = await api.get('/notifications/unread-count');
          setUnreadCount(countRes.data.count);
        } catch (err) { }
      };

      fetchNotifications();

      if (socket) {
        socket.on('new_notification', (notification) => {
          setNotifications(prev => [notification, ...prev].slice(0, 5));
          setUnreadCount(prev => prev + 1);
          toast.success('New update received', { icon: '🔔' });
        });
      }
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      if (socket) socket.off('new_notification');
    };
  }, [user, socket]);

  if (!user) return null;

  const currentLocationLabel = selectedLocation
    ? `${selectedLocation.city} - ${selectedLocation.name}`
    : (['admin', 'super_admin'].includes(user.role) ? 'Select Branch' : 'Assigned Branch');

  return (
    <header className={`h-20 px-3 gap-2 sm:px-4 md:px-8 flex items-center justify-between  z-[90] sticky top-0 transition-all duration-300  ${isScrolled
      ? 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-b border-zinc-200 dark:border-zinc-800 shadow-lg shadow-black/5'
      : 'bg-transparent border-b border-zinc-200 dark:border-zinc-800'
      }`}>
      <div className="flex items-center gap-2 md:gap-6">
        {isMobile && (
          <button
            onClick={onToggleSidebar}
            className="p-2 text-zinc-500 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all rounded-xl"
          >
            <Menu size={20} />
          </button>
        )}

        {!isMobile && (
          <button 
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { 
              key: 'k', 
              ctrlKey: true, 
              metaKey: true,
              bubbles: true 
            }))}
            className="hidden lg:flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-amber-500/50 transition-all text-zinc-400 group min-w-[280px] shadow-sm"
          >
            <Search size={16} className="group-hover:text-amber-500 transition-colors" />
            <span className="text-[11px] font-bold">Search system or switch user...</span>
            <div className="ml-auto flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black text-zinc-500">
                {modifierKey}
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-black text-zinc-500">K</span>
            </div>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Location Selector Dropdown */}
        {!isMobile && <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 rounded-2xl border 
  bg-zinc-100/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800">

          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <MapPin size={14} />
          </div>

          <div className="flex flex-col items-start leading-none pr-1">
            <span className="hidden sm:inline text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">
              Active Node
            </span>

            <span className="text-[10px] md:text-xs font-black text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">
              {selectedLocation
                ? `${selectedLocation.city} - ${selectedLocation.name}`
                : (['admin', 'super_admin'].includes(user.role)
                  ? 'Global Cafe'
                  : 'Assigned Branch')}
            </span>
          </div>
        </div>}

        {/* Action Controls */}
        <div className="flex items-center gap-2 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
          <button
            onClick={toggleTheme}
            className="p-2.5 text-zinc-500 hover:text-amber-500 transition-all rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm"
            title="Toggle Protocol"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2.5 relative transition-all rounded-xl hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm ${showNotifications ? 'text-amber-500 bg-white dark:bg-zinc-800 shadow-sm' : 'text-zinc-500'}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
            )}
          </button>

          {/* Notification Panel */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-20 top-16 w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[100]"
                ref={notificationRef}
              >
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                    <Bell size={12} className="text-amber-500" /> Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await api.patch('/notifications/read-all');
                          setUnreadCount(0);
                          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                        } catch (err) { }
                      }}
                      className="text-[9px] font-black text-amber-500 uppercase tracking-tight hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif._id}
                        className={`px-5 py-4 border-b border-zinc-50 dark:border-zinc-800/50 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${notif.isRead ? 'opacity-60' : ''}`}
                        onClick={async () => {
                          if (!notif.isRead) {
                            try {
                              await api.patch(`/notifications/${notif._id}/read`);
                              setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
                              setUnreadCount(prev => Math.max(0, prev - 1));
                            } catch (err) { }
                          }
                        }}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${notif.isRead ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                          <div>
                            <p className={`text-xs font-black tracking-tight leading-none mb-1 ${notif.isRead ? 'text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                              {notif.title}
                            </p>
                            <p className="text-[10px] font-medium text-zinc-400 leading-relaxed mb-2">
                              {notif.message}
                            </p>
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {notif.type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-8 py-12 text-center opacity-30">
                      <Zap size={32} className="mx-auto mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Protocol Clear</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Identity Section */}
        <div className="flex items-center gap-4 pl-4 border-l border-zinc-200 dark:border-zinc-800">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">{user.name}</span>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
              <span className="h-1 w-1 bg-emerald-500 rounded-full animate-ping" /> Authorized
            </span>
          </div>
          <Link
            href="/dashboard/profile"
            className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-[1.5px] group cursor-pointer shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all active:scale-95 overflow-hidden"
          >
            <div className="h-full w-full rounded-[0.9rem] bg-white dark:bg-zinc-950 flex items-center justify-center text-amber-500 overflow-hidden">
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
