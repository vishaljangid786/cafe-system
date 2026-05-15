'use client';
import { useState, useEffect } from 'react';
import { 
  Bell, Search, Calendar,
  CheckCircle2, ChevronLeft,
  ChevronRight, AlertTriangle,
  MessageSquare, User, Reply, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';
import PageTransition from '../../components/ui/PageTransition';
import { Button } from '../../components/ui/Button';
import PremiumSelect from '../../components/ui/PremiumSelect';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const NotificationsPage = () => {
  const { markAsRead, markAsUnread, markAllAsRead, refresh } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [filters, setFilters] = useState({
    status: 'all',
    type: '',
    startDate: '',
    endDate: '',
    search: '',
    activeTab: 'all'
  });
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchHistory = async (page = 1) => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page,
        limit: 15,
        status: filters.status !== 'all' ? filters.status : '',
        type: filters.type,
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      const res = await api.get(`/notifications?${query.toString()}`);
      setNotifications(res?.data?.data || []);
      setPagination(res?.data?.pagination || { page: 1, pages: 1 });
    } catch (err) {
      toast.error('Failed to sync archival records');
      console.error('Failed to sync archival records:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    await markAsRead(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAsUnread = async (id) => {
    await markAsUnread(id);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: false } : n));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return toast.error('Please enter a message');
    
    try {
      setSendingReply(true);
      await api.post('/notifications', {
        title: `Reply to: ${replyingTo.title}`,
        message: replyMessage,
        type: 'message',
        priority: 'medium',
        targetType: 'individual',
        targetId: replyingTo.sender._id
      });
      
      toast.success('Reply sent successfully');
      setReplyingTo(null);
      setReplyMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory(pagination.page);
    }, 0);

    return () => clearTimeout(timer);
  }, [filters, pagination.page]);

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high': return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20';
      case 'medium': return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20';
      case 'low': return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20';
      default: return 'bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)] border-[var(--color-text-muted)]/20';
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    const searchLower = (filters.search || '').toLowerCase();
    const matchesSearch = !searchLower || 
                         (notif.title || '').toLowerCase().includes(searchLower) || 
                         (notif.message || '').toLowerCase().includes(searchLower);
    
    if (!matchesSearch) return false;

    // If a specific type is chosen via dropdown, we prioritize that and ignore tabs
    if (filters.type) return true;

    if (filters.activeTab === 'all') return true;

    const systemTypes = ['user_action', 'table_action', 'expense'];
    const isSystem = systemTypes.includes(notif.type);
    
    if (filters.activeTab === 'system') {
      return isSystem;
    } else {
      // General tab shows everything else
      return !isSystem;
    }
  });

  return (
    <PageTransition>
      <div className="space-y-8 pb-24">
        {/* Cinematic Header */}
        <div className="relative group overflow-hidden bg-[var(--color-surface)] rounded-[2rem] p-8 border border-[var(--color-border)] shadow-sm">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
            <Bell size={160} className="text-[var(--color-primary)]" strokeWidth={1} />
          </div>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)]">
                  <Bell size={28} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                    Notifications
                  </h1>
                  <p className="text-[var(--color-text-muted)] font-medium mt-1 text-sm">
                    Track and manage your system alerts and communications.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button 
                variant="secondary" 
                icon={CheckCircle2}
                onClick={handleMarkAllAsRead}
                className="!rounded-xl !py-3 px-6"
              >
                Mark all as read
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-6 border-b border-[var(--color-border)] mb-2">
          <button
            onClick={() => setFilters(prev => ({ ...prev, activeTab: 'all' }))}
            className={`pb-4 px-1 text-sm font-bold transition-all relative ${
              filters.activeTab === 'all' 
                ? 'text-[var(--color-primary)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            All
            {filters.activeTab === 'all' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, activeTab: 'general' }))}
            className={`pb-4 px-1 text-sm font-bold transition-all relative ${
              filters.activeTab === 'general' 
                ? 'text-[var(--color-primary)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            General Alerts
            {filters.activeTab === 'general' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, activeTab: 'system' }))}
            className={`pb-4 px-1 text-sm font-bold transition-all relative ${
              filters.activeTab === 'system' 
                ? 'text-[var(--color-primary)]' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            System Logs
            {filters.activeTab === 'system' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-full" />
            )}
          </button>
        </div>

        <div className="bg-[var(--color-surface)] p-4 rounded-2xl border border-[var(--color-border)] shadow-sm">
  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-center">

    {/* 🔍 Search */}
    <div className="relative group md:col-span-1">
      {/* Glow */}
      <div className="absolute inset-0 rounded-xl bg-[var(--color-primary)]/0 group-focus-within:bg-[var(--color-primary)]/10 blur-lg transition-all" />

      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition"
        size={15}
      />

      <input
        type="text"
        placeholder="Search notifications..."
        value={filters.search}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, search: e.target.value }))
        }
        className="relative w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
      />

      {/* Clear */}
      {filters.search && (
        <button
          onClick={() =>
            setFilters((prev) => ({ ...prev, search: '' }))
          }
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition"
        >
          ✕
        </button>
      )}
    </div>

    <PremiumSelect
      value={filters.status}
      onChange={(val) =>
        setFilters((prev) => ({ ...prev, status: val }))
      }
      options={[
        { label: 'All Status', value: 'all' },
        { label: 'Unread', value: 'unread' },
        { label: 'Read', value: 'read' }
      ]}
      className="w-full"
    />

    {/* 📂 Category */}
    <PremiumSelect
      value={filters.type}
      onChange={(val) =>
        setFilters((prev) => ({ ...prev, type: val }))
      }
      options={[
        { label: 'All Types', value: '' },
        { label: 'Expenses', value: 'expense' },
        { label: 'User Actions', value: 'user_action' },
        { label: 'Table Actions', value: 'table_action' },
        { label: 'Announcements', value: 'announcement' },
        { label: 'Alerts', value: 'alert' },
        { label: 'Messages', value: 'message' }
      ]}
      className="w-full"
    />

    {/* 📅 Start Date */}
    <div className="relative group">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)]"
        size={15}
      />

      <input
        type="date"
        value={filters.startDate}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            startDate: e.target.value
          }))
        }
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
      />
    </div>

    {/* 📅 End Date */}
    <div className="relative group">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)]"
        size={15}
      />

      <input
        type="date"
        value={filters.endDate}
        onChange={(e) =>
          setFilters((prev) => ({
            ...prev,
            endDate: e.target.value
          }))
        }
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
      />
    </div>

  </div>
</div>

        {/* Results Section */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notif, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={notif._id}
                  className={`group relative bg-[var(--color-surface)] border ${notif.isRead ? 'border-[var(--color-border)]' : 'border-[var(--color-primary)]/20 shadow-lg shadow-[var(--color-primary)]/5'} rounded-2xl p-6 transition-all hover:shadow-md`}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className={`h-12 w-12 rounded-xl shrink-0 flex items-center justify-center border ${getPriorityStyles(notif.priority)}`}>
                      {notif.type === 'alert' ? <AlertTriangle size={20} /> : 
                       notif.type === 'message' ? <MessageSquare size={20} /> :
                       <Bell size={20} />}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className={`font-bold text-lg ${notif.isRead ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                            {notif.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                              <Calendar size={12} />
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs font-medium text-[var(--color-text-muted)]">•</span>
                            <span className="text-xs font-medium text-[var(--color-text-muted)]">
                              {new Date(notif.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityStyles(notif.priority)}`}>
                            {notif.priority} Priority
                          </span>
                          
                          <div className="h-8 w-[1px] bg-[var(--color-border)] mx-1" />

                          {notif.sender && (
                            <button 
                              onClick={() => setReplyingTo(notif)}
                              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-soft)] text-[var(--color-primary)] text-xs font-bold rounded-xl hover:bg-[var(--color-primary)]/10 transition-all border border-[var(--color-primary)]/20"
                            >
                              <Reply size={14} />
                              Reply
                            </button>
                          )}

                          {!notif.isRead ? (
                            <button 
                              onClick={() => handleMarkAsRead(notif._id)}
                              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-bold rounded-xl hover:bg-[var(--color-primary-dark)] transition-all shadow-sm shadow-[var(--color-primary)]/20"
                            >
                              <CheckCircle2 size={14} />
                              Mark as Read
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleMarkAsUnread(notif._id)}
                              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] text-xs font-bold rounded-xl hover:bg-[var(--color-border)] transition-all border border-[var(--color-border)]"
                            >
                              <Bell size={14} />
                              Mark as Unread
                            </button>
                          )}
                        </div>
                      </div>

                      <p className={`text-sm leading-relaxed max-w-3xl ${notif.isRead ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-secondary)]'}`}>
                        {notif.message}
                      </p>

                      <div className="pt-2 flex items-center gap-4 border-t border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-[var(--color-surface-soft)] flex items-center justify-center">
                            <User size={12} className="text-[var(--color-text-muted)]" />
                          </div>
                          <span className="text-xs font-bold text-[var(--color-text-secondary)]">{notif.sender?.name || 'System'}</span>
                        </div>
                        <span className="h-1 w-1 bg-[var(--color-border)] rounded-full" />
                        <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{notif.type}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-32 text-center"
              >
                <div className="h-20 w-20 rounded-full bg-[var(--color-surface-soft)] flex items-center justify-center mb-6">
                  <Bell size={40} className="text-[var(--color-text-muted)]/40" />
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">No notifications found</h3>
                <p className="text-[var(--color-text-muted)] max-w-sm">
                  We couldn&apos;t find any notifications matching your current filters. Try adjusting your search criteria.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination Component */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-8">
              <Button
                variant="secondary"
                icon={ChevronLeft}
                disabled={pagination.page === 1}
                onClick={() => fetchHistory(pagination.page - 1)}
                className="!rounded-xl"
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {[...Array(pagination.pages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => fetchHistory(i + 1)}
                    className={`h-10 w-10 rounded-xl text-sm font-bold transition-all ${
                      pagination.page === i + 1 
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] border border-[var(--color-border)]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                icon={ChevronRight}
                iconPosition="right"
                disabled={pagination.page === pagination.pages}
                onClick={() => fetchHistory(pagination.page + 1)}
                className="!rounded-xl"
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Reply Modal */}
        <Modal
          isOpen={!!replyingTo}
          onClose={() => {
            setReplyingTo(null);
            setReplyMessage('');
          }}
          title={replyingTo ? `Replying to ${replyingTo.sender?.name || 'System'}` : 'Reply'}
        >
          <div className="space-y-6">
            <div className="p-4 bg-[var(--color-surface-soft)] rounded-xl border border-[var(--color-border)]">
              <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] mb-2">Original Message</p>
              <p className="text-sm italic text-[var(--color-text-secondary)]">"{replyingTo?.message}"</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-[var(--color-text-muted)] ml-1">Your Reply</label>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your response here..."
                className="w-full min-h-[150px] p-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none"
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyMessage('');
                }}
                disabled={sendingReply}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Send}
                loading={sendingReply}
                onClick={handleSendReply}
              >
                Send Reply
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

export default NotificationsPage;
