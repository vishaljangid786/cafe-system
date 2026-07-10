'use client';
import { useState, useEffect, useRef } from 'react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { ListSkeleton } from '@/app/components/ui/Skeleton';
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
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
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
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const query = new URLSearchParams({
        page,
        limit: 15,
        status: filters.status !== 'all' ? filters.status : '',
        type: filters.type,
        search: filters.search,
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      const res = await api.get(`/notifications?${query.toString()}`);
      setNotifications(res?.data?.data || []);
      setPagination(res?.data?.pagination || { page: 1, pages: 1 });
    } catch (err) {
      console.error('Could not load notifications');
      console.error('Failed to sync archival records:', err.response?.data || err.message);
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
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
        targetId: replyingTo.sender._id,
        replyTo: replyingTo._id
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

  // Any filter change resets to page 1; the pagination buttons call fetchHistory
  // directly, so page number is intentionally not a dependency here.
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory(1);
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high': return 'bg-danger/10 text-danger border-danger/20';
      case 'medium': return 'bg-primary/10 text-primary border-primary/20';
      case 'low': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-(--color-text-muted)/10 text-(--color-text-muted) border-(--color-text-muted)/20';
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

    const systemTypes = ['user_action', 'table_action', 'expense', 'order_action', 'activity'];
    const isSystem = systemTypes.includes(notif.type);
    
    if (filters.activeTab === 'system') {
      return isSystem;
    } else {
      // General tab shows everything else
      return !isSystem;
    }
  });

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="relative group overflow-hidden bg-(--color-surface) rounded-xl p-5 border border-(--color-border) shadow-sm">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
            <Bell size={160} className="text-primary" strokeWidth={1} />
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-6 w-6 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Bell size={16} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-(--color-text-primary)">
                    Notifications
                  </h1>
                  <p className="text-(--color-text-muted) font-medium mt-1 text-sm">
                    See and manage all your alerts and messages.
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
        <div className="flex items-center gap-6 border-b border-(--color-border) mb-2">
          <button
            onClick={() => setFilters(prev => ({ ...prev, activeTab: 'all' }))}
            className={`pb-4 px-1 text-sm font-medium transition-all relative ${
              filters.activeTab === 'all' 
                ? 'text-primary' 
                : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
            }`}
          >
            All
            {filters.activeTab === 'all' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, activeTab: 'general' }))}
            className={`pb-4 px-1 text-sm font-medium transition-all relative ${
              filters.activeTab === 'general' 
                ? 'text-primary' 
                : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
            }`}
          >
            General Alerts
            {filters.activeTab === 'general' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, activeTab: 'system' }))}
            className={`pb-4 px-1 text-sm font-medium transition-all relative ${
              filters.activeTab === 'system' 
                ? 'text-primary' 
                : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
            }`}
          >
            Activity
            {filters.activeTab === 'system' && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        <div className="bg-(--color-surface) p-4 rounded-xl border border-(--color-border) shadow-sm">
  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 items-center">

    {/* 🔍 Search */}
    <div className="relative group md:col-span-1">
      {/* Glow */}
      <div className="absolute inset-0 rounded-xl bg-primary/0 group-focus-within:bg-primary/10 blur-lg transition-all" />

      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition"
        size={15}
      />

      <input
        type="text"
        placeholder="Search notifications..."
        value={filters.search}
        onChange={(e) =>
          setFilters((prev) => ({ ...prev, search: e.target.value }))
        }
        className="relative w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-primary) focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
      />

      {/* Clear */}
      {filters.search && (
        <button
          onClick={() =>
            setFilters((prev) => ({ ...prev, search: '' }))
          }
          className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) hover:text-danger transition"
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
        { label: 'Order Actions', value: 'order_action' },
        { label: 'Activity', value: 'activity' },
        { label: 'Announcements', value: 'announcement' },
        { label: 'Alerts', value: 'alert' },
        { label: 'Messages', value: 'message' }
      ]}
      className="w-full"
    />

    {/* 📅 Start Date */}
    <div className="relative group">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary"
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
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-primary) focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
      />
    </div>

    {/* 📅 End Date */}
    <div className="relative group">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary"
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
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-primary) focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
      />
    </div>

  </div>
</div>

        {/* Results Section */}
        <div className="space-y-4">
          {refetching ? (
            <ListSkeleton rows={6} />
          ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notif, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={notif._id}
                  className={`group relative bg-(--color-surface) border ${notif.isRead ? 'border-(--color-border)' : 'border-primary/20 shadow-sm '} rounded-xl p-5 transition-all hover:shadow-md`}
                >
                  <div className="flex flex-col md:flex-row gap-5">
                    <div className={`h-6 w-6 rounded-xl shrink-0 flex items-center justify-center border ${getPriorityStyles(notif.priority)}`}>
                      {notif.type === 'alert' ? <AlertTriangle size={14} /> :
                       notif.type === 'message' ? <MessageSquare size={14} /> :
                       <Bell size={14} />}
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className={`font-semibold text-lg ${notif.isRead ? 'text-(--color-text-muted)' : 'text-(--color-text-primary)'}`}>
                            {notif.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-medium text-(--color-text-muted) flex items-center gap-1.5">
                              <Calendar size={12} />
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs font-medium text-(--color-text-muted)">•</span>
                            <span className="text-xs font-medium text-(--color-text-muted)">
                              {new Date(notif.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider border ${getPriorityStyles(notif.priority)}`}>
                            {notif.priority} Priority
                          </span>
                          
                          <div className="h-8 w-[1px] bg-(--color-border) mx-1" />

                          {notif.sender && (
                            <button 
                              onClick={() => setReplyingTo(notif)}
                              className="flex items-center gap-2 px-4 py-2 bg-(--color-surface-soft) text-primary text-xs font-medium rounded-xl hover:bg-primary/10 transition-all border border-primary/20"
                            >
                              <Reply size={14} />
                              Reply
                            </button>
                          )}

                          {!notif.isRead ? (
                            <button 
                              onClick={() => handleMarkAsRead(notif._id)}
                              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-sm "
                            >
                              <CheckCircle2 size={14} />
                              Mark as Read
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleMarkAsUnread(notif._id)}
                              className="flex items-center gap-2 px-4 py-2 bg-(--color-surface-soft) text-(--color-text-muted) text-xs font-medium rounded-xl hover:bg-(--color-border) transition-all border border-(--color-border)"
                            >
                              <Bell size={14} />
                              Mark as Unread
                            </button>
                          )}
                        </div>
                      </div>

                      <p className={`text-sm leading-relaxed max-w-3xl ${notif.isRead ? 'text-(--color-text-muted)' : 'text-(--color-text-secondary)'}`}>
                        {notif.message}
                      </p>

                      <div className="pt-2 flex items-center gap-4 border-t border-(--color-border)">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-(--color-surface-soft) flex items-center justify-center">
                            <User size={12} className="text-(--color-text-muted)" />
                          </div>
                          <span className="text-xs font-medium text-(--color-text-secondary)">{notif.sender?.name || 'System'}</span>
                        </div>
                        <span className="h-1 w-1 bg-(--color-border) rounded-full" />
                        <span className="text-xs font-medium text-(--color-text-muted) tracking-normal">{notif.type}</span>
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
                <div className="h-20 w-20 rounded-full bg-(--color-surface-soft) flex items-center justify-center mb-6">
                  <Bell size={40} className="text-(--color-text-muted)/40" />
                </div>
                <h3 className="text-xl font-semibold text-(--color-text-primary) mb-2">No notifications found</h3>
                <p className="text-(--color-text-muted) max-w-sm">
                  We couldn&apos;t find any notifications matching your current filters. Try adjusting your search criteria.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          )}

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
                    className={`h-10 w-10 rounded-xl text-sm font-medium transition-all ${
                      pagination.page === i + 1 
                        ? 'bg-primary text-white'
                        : 'bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-surface-soft) border border-(--color-border)'
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
            <div className="p-4 bg-(--color-surface-soft) rounded-xl border border-(--color-border)">
              <p className="text-[11px] font-medium uppercase text-(--color-text-muted) mb-2">Original Message</p>
              <p className="text-sm text-(--color-text-secondary)">&ldquo;{replyingTo?.message}&rdquo;</p>
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-medium uppercase text-(--color-text-muted) ml-1">Your Reply</label>
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your response here..."
                className="w-full min-h-[150px] p-4 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-sm text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
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
