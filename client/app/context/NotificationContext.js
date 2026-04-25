'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user, socket } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get('/notifications?limit=20');
      setNotifications(res?.data?.data || []);
      setUnreadCount(res?.data?.pagination?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to sync notifications:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (socket) {
      const handleNewNotification = (notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        
        // Dynamic Toast based on priority
        const toastOptions = {
          icon: '🔔',
          duration: notification.priority === 'high' ? 6000 : 4000,
        };

        if (notification.priority === 'high') {
          toast.error(
            <div className="flex flex-col gap-1">
              <span className="font-black text-[10px] uppercase tracking-widest text-rose-500">Urgent Transmission</span>
              <span className="font-bold text-sm">{notification.title}</span>
            </div>,
            toastOptions
          );
        } else {
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-black text-[10px] uppercase tracking-widest text-emerald-500">New Alert</span>
              <span className="font-bold text-sm">{notification.title}</span>
            </div>,
            toastOptions
          );
        }
      };

      socket.on('new_notification', handleNewNotification);
      return () => socket.off('new_notification', handleNewNotification);
    }
  }, [socket]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err.response?.data || err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications cleared');
    } catch (err) {
      console.error('Failed to clear notifications:', err.response?.data || err.message);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      loading, 
      markAsRead, 
      markAllAsRead, 
      refresh: fetchNotifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
