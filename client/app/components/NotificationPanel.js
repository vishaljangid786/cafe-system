'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Zap, AlertTriangle, MessageSquare, ExternalLink, RefreshCcw } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import Link from 'next/link';

const NotificationPanel = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading, refresh } = useNotifications();

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high': return 'bg-[rgba(var(--color-danger-rgb),0.1)] text-danger border-[rgba(var(--color-danger-rgb),0.2)]';
      case 'medium': return 'bg-(--color-primary-soft) text-primary border-[rgba(var(--color-primary-rgb),0.2)]';
      case 'low': return 'bg-[rgba(var(--color-success-rgb),0.1)] text-success border-[rgba(var(--color-success-rgb),0.2)]';
      default: return 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)';
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
            className="fixed inset-0 z-999"
          />
          
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute top-full right-0 mt-3 w-96 max-h-[600px] bg-(--color-surface) border border-(--color-border) shadow-[var(--shadow-md)] rounded-xl z-1000 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-(--color-border) flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-(--color-primary-soft) text-primary flex items-center justify-center relative">
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-danger rounded-full border-2 border-(--color-surface) text-[10px] font-semibold text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-semibold text-(--color-text-primary) leading-none">Notifications</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={refresh}
                  className="p-2 hover:bg-(--color-surface-soft) hover:text-(--color-text-primary) rounded-lg transition-colors text-(--color-text-muted)"
                  title="Refresh"
                >
                  <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-(--color-surface-soft) hover:text-(--color-text-primary) rounded-lg transition-colors text-(--color-text-muted)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <h3 className="label">Recent Activity</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs font-medium text-primary hover:underline transition-colors">
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length > 0 ? (
                notifications.map((notif, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    key={notif._id}
                    className={`relative p-3 rounded-lg border transition-colors duration-200 group ${notif.isRead ? 'bg-(--color-surface-soft) border-(--color-border) opacity-70' : 'bg-(--color-surface) border-(--color-border) hover:border-(--color-border-strong)'}`}
                  >
                    <div className="flex gap-3">
                      <div className={`h-9 w-9 rounded-lg shrink-0 flex items-center justify-center border ${getPriorityStyles(notif.priority)}`}>
                        {notif.type === 'alert' ? <AlertTriangle size={16} /> :
                         notif.type === 'message' ? <MessageSquare size={16} /> :
                         <Bell size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-sm font-semibold truncate ${notif.isRead ? 'text-(--color-text-muted)' : 'text-(--color-text-primary)'}`}>
                            {notif.title}
                          </p>
                          <span className="text-[11px] text-(--color-text-muted) whitespace-nowrap">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed line-clamp-2 mb-2 ${notif.isRead ? 'text-(--color-text-muted)' : 'text-(--color-text-secondary)'}`}>
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-(--color-text-muted)">
                            {notif.sender?.name || 'System'} • {notif.type}
                          </span>
                          {!notif.isRead && (
                            <button
                              onClick={() => markAsRead(notif._id)}
                              className="text-[11px] font-medium text-primary hover:underline transition-opacity"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-(--color-text-muted)">
                  <div className="h-14 w-14 rounded-xl bg-(--color-surface-soft) flex items-center justify-center mb-3">
                    <Zap size={28} className="opacity-30" />
                  </div>
                  <p className="text-sm">No new notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-(--color-border)">
              <Link
                href="/dashboard/notifications"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-(--color-on-primary) text-sm font-semibold hover:bg-(--color-primary-hover) transition-colors group"
              >
                View All Notifications
                <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
