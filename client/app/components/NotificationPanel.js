'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Zap, AlertTriangle, MessageSquare, ExternalLink, RefreshCcw } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import Link from 'next/link';

const NotificationPanel = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading, refresh } = useNotifications();

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Transparent backdrop for closing on outside click */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[999]"
          />
          
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute top-full right-0 mt-4 w-96 max-h-[600px] bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-3xl z-[1000] flex flex-col overflow-hidden backdrop-blur-xl bg-opacity-95"
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg-soft)]">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center relative shadow-inner">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 rounded-full border-2 border-[var(--color-surface)] text-[10px] font-black text-white flex items-center justify-center animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-widest leading-none">Notifications</h2>
                  <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
                    <span className="h-1 w-1 bg-amber-500 rounded-full" /> Recent Updates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={refresh}
                  className="p-2 hover:bg-amber-500/10 hover:text-amber-500 rounded-xl transition-all text-[var(--color-text-muted)]"
                  title="Refresh"
                >
                  <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all text-[var(--color-text-muted)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-opacity-50">
              <div className="flex items-center justify-between px-2 mb-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Recent Activity</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[9px] font-black text-amber-500 hover:text-amber-600 uppercase tracking-widest transition-colors">
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length > 0 ? (
                notifications.map((notif, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={notif._id}
                    className={`relative p-4 rounded-2xl border transition-all duration-300 group ${notif.isRead ? 'bg-[var(--color-bg-soft)]/30 border-[var(--color-border)] opacity-60' : 'bg-[var(--color-surface)] border-amber-500/10 shadow-sm hover:border-amber-500/30'}`}
                  >
                    <div className="flex gap-4">
                      <div className={`h-9 w-9 rounded-xl shrink-0 flex items-center justify-center border ${getPriorityStyles(notif.priority)} shadow-sm`}>
                        {notif.type === 'alert' ? <AlertTriangle size={16} /> : 
                         notif.type === 'message' ? <MessageSquare size={16} /> :
                         <Bell size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-xs font-black truncate ${notif.isRead ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[9px] font-bold text-[var(--color-text-muted)] whitespace-nowrap bg-[var(--color-bg-soft)] px-2 py-0.5 rounded-md uppercase tracking-widest">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed line-clamp-2 mb-3 font-medium ${notif.isRead ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)]" />
                            {notif.sender?.name || 'System'} • {notif.type}
                          </span>
                          {!notif.isRead && (
                            <button 
                              onClick={() => markAsRead(notif._id)}
                              className="text-[9px] font-black text-amber-500 uppercase tracking-widest hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--color-text-muted)]">
                  <div className="h-16 w-16 rounded-3xl bg-[var(--color-bg-soft)] flex items-center justify-center mb-4 shadow-inner">
                    <Zap size={32} className="opacity-20" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">No new notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              <Link 
                href="/dashboard/notifications" 
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black dark:hover:bg-zinc-700 transition-all shadow-xl shadow-zinc-900/10 group"
              >
                View All Notifications
                <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
