'use client';
import { useState, useEffect } from 'react';
import { 
  Bell, Search, Filter, Calendar, 
  CheckCircle2, Trash2, ChevronLeft, 
  ChevronRight, Info, AlertTriangle, 
  MessageSquare, Sparkles, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';
import PageTransition from '../../components/ui/PageTransition';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

const NotificationsPage = () => {
  const { markAsRead, markAllAsRead, refresh } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [filters, setFilters] = useState({
    status: 'all',
    type: '',
    startDate: '',
    endDate: '',
    search: ''
  });

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

  useEffect(() => {
    fetchHistory(pagination.page);
  }, [filters, pagination.page]);

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'high': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const filteredNotifications = notifications.filter(n => 
    n.title.toLowerCase().includes(filters.search.toLowerCase()) || 
    n.message.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="space-y-8 pb-24">
        {/* Cinematic Header */}
        <div className="relative group overflow-hidden bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
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
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    Notifications
                  </h1>
                  <p className="text-zinc-500 font-medium mt-1 text-sm">
                    Track and manage your system alerts and communications.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button 
                variant="secondary" 
                icon={CheckCircle2}
                onClick={markAllAsRead}
                className="!rounded-xl !py-3 px-6"
              >
                Mark all as read
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={16} />
            <input 
              type="text"
              placeholder="Search notifications..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all text-sm"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <select 
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all text-sm appearance-none"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">All Status</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read Only</option>
            </select>
          </div>

          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="date"
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all text-sm"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input 
              type="date"
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all text-sm"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
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
                  className={`group relative bg-white dark:bg-zinc-900 border ${notif.isRead ? 'border-zinc-100 dark:border-zinc-800' : 'border-[var(--color-primary)]/20 shadow-lg shadow-[var(--color-primary)]/5'} rounded-2xl p-6 transition-all hover:shadow-md`}
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
                          <h3 className={`font-bold text-lg ${notif.isRead ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                            {notif.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                              <Calendar size={12} />
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs font-medium text-zinc-400">•</span>
                            <span className="text-xs font-medium text-zinc-400">
                              {new Date(notif.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityStyles(notif.priority)}`}>
                            {notif.priority} Priority
                          </span>
                          {!notif.isRead && (
                            <button 
                              onClick={() => markAsRead(notif._id)}
                              className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                              title="Mark as read"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className={`text-sm leading-relaxed max-w-3xl ${notif.isRead ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-300'}`}>
                        {notif.message}
                      </p>

                      <div className="pt-2 flex items-center gap-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <User size={12} className="text-zinc-400" />
                          </div>
                          <span className="text-xs font-bold text-zinc-500">{notif.sender?.name || 'System'}</span>
                        </div>
                        <span className="h-1 w-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{notif.type}</span>
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
                <div className="h-20 w-20 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mb-6">
                  <Bell size={40} className="text-zinc-200 dark:text-zinc-700" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No notifications found</h3>
                <p className="text-zinc-500 max-w-sm">
                  We couldn't find any notifications matching your current filters. Try adjusting your search criteria.
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
                        : 'bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
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
      </div>
    </PageTransition>
  );
};

export default NotificationsPage;
