'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toneText, toneBg, toneSoft, toneBorder } from '../../components/ui/tone';
import { 
  Coffee, 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronRight,
  Zap,
  Timer,
  UtensilsCrossed,
  ArrowRight,
  RefreshCcw
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { LoaderBlock } from '@/app/components/ui/Spinner';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import api from '@/app/services/api';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../components/ui/AnimatedContainer';
import Modal from '../..//components/ui/Modal';
import { Button } from '../..//components/ui/Button';

export default function ChefDashboard() {
  const { user, selectedLocation, socket } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [chefNote, setChefNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeLaneTab, setActiveLaneTab] = useState('incoming');

  const fetchOrders = useCallback(async (silent = false) => {
    if (!selectedLocation) return;
    if (!silent) {
      setLoading(true);
      progress.start();
    }
    try {
      const branchId = selectedLocation._id || selectedLocation;
      const res = await api.get(`/orders?branchId=${branchId}`);
      // Filter out SERVED, COMPLETED, CANCELLED, REJECTED for the active dashboard
      const activeStatuses = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'];
      const activeOrders = res.data.data.filter(o => activeStatuses.includes(o.status));
      setOrders(activeOrders);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      if (!silent) progress.done();
    }
  }, [selectedLocation]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 0);

    if (socket && selectedLocation) {
      // Listeners are now attached to rooms joined in AuthContext
      socket.on('order:new', (data) => {
        toast.success('New Order!', { icon: '🔥', duration: 4000 });
        fetchOrders(true);
      });

      socket.on('order:update', () => fetchOrders(true));
      socket.on('order:cancel', () => {
        toast.error('Order Cancelled by Admin');
        fetchOrders(true);
      });

      return () => {
        clearTimeout(timer);
        socket.off('order:new');
        socket.off('order:update');
        socket.off('order:cancel');
      };
    }

    return () => clearTimeout(timer);
  }, [socket, selectedLocation, fetchOrders]);

  const handleUpdateStatus = async (orderId, endpoint) => {
    const loadToast = toast.loading('Updating status...');
    try {
      await api.patch(`/orders/${orderId}/${endpoint}`, {});
      fetchOrders();
      toast.success('Status updated', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating status', { id: loadToast });
    }
  };

  const handleAddNote = async () => {
    try {
      await api.patch(`/orders/${selectedOrder._id}/note`, { chefNote });
      toast.success('Note saved');
      setShowNoteModal(false);
      setChefNote('');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to attach note');
    }
  };

  const lanes = [
    { 
      id: 'incoming', 
      title: 'New Orders', 
      statuses: ['PLACED'], 
      icon: Zap, 
      color: 'amber',
      action: (order) => (
        <Button 
          variant="primary" 
          size="sm" 
          className="w-full mt-4 !rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal"
          onClick={() => handleUpdateStatus(order._id, 'accept')}
        >
          Accept Order
        </Button>
      )
    },
    { 
      id: 'preparing', 
      title: 'Cooking', 
      statuses: ['ACCEPTED', 'PREPARING'], 
      icon: Timer, 
      color: 'blue',
      action: (order) => (
        <div className="mt-4 flex gap-2">
          {order.status === 'ACCEPTED' ? (
            <Button 
              variant="primary" 
              size="sm" 
              className="flex-1 !rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal"
              onClick={() => handleUpdateStatus(order._id, 'start')}
            >
              Start Prep
            </Button>
          ) : (
            <Button 
              variant="primary" 
              size="sm" 
              className="flex-1 !rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success)] text-[10px] font-bold uppercase tracking-normal"
              onClick={() => handleUpdateStatus(order._id, 'ready')}
            >
              Mark Ready
            </Button>
          )}
          <button 
            onClick={() => { setSelectedOrder(order); setChefNote(order.chefNote || ''); setShowNoteModal(true); }}
            className="h-10 w-10 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      )
    },
    { 
      id: 'ready', 
      title: 'Ready to Serve', 
      statuses: ['READY'], 
      icon: UtensilsCrossed, 
      color: 'emerald',
      action: () => (
        <div className="mt-4 p-3 bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-success)]">Pick up</span>
        </div>
      )
    }
  ];

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8 pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg ">
                <ChefHat size={24} className="text-[var(--color-on-primary)]" />
              </div>
              Kitchen
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 font-medium ml-13">Manage kitchen orders</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all border border-[var(--color-border)] disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="flex items-center gap-2 bg-[var(--color-surface)] p-1.5 rounded-xl border border-[var(--color-border)]">
               <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                 Branch: <span className="text-[var(--color-primary)] ml-1">{selectedLocation?.name}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Mobile Lane Switcher Tabs */}
        <div className="flex lg:hidden bg-[var(--color-surface)] p-1.5 rounded-xl border border-[var(--color-border)] gap-2 mb-4">
          {lanes.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveLaneTab(l.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${activeLaneTab === l.id ? (l.id === 'incoming' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg ' : l.id === 'preparing' ? 'bg-[var(--color-primary)] text-white shadow-lg ' : 'bg-[var(--color-success)] text-white shadow-lg ') : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
            >
              <l.icon size={14} />
              {l.title}
            </button>
          ))}
        </div>

        {/* Lane Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[60vh]">
          {lanes.map((lane) => (
            <div 
              key={lane.id} 
              className={`flex flex-col h-full bg-[var(--color-surface-soft)]/30 rounded-xl border border-[var(--color-border)] overflow-hidden ${activeLaneTab === lane.id ? 'flex' : 'hidden lg:flex'}`}
            >
              <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-xl ${toneSoft(lane.color)} flex items-center justify-center`}>
                    <lane.icon size={16} className={toneText(lane.color)} />
                  </div>
                  <h3 className="text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-normal">{lane.title}</h3>
                </div>
                <div className="h-6 px-2.5 rounded-full bg-[var(--color-bg-soft)] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                    {orders.filter(o => lane.statuses.includes(o.status)).length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {orders
                    .filter(o => lane.statuses.includes(o.status))
                    .map((order) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={order._id}
                        className="glass-card rounded-xl border border-[var(--color-border)] p-5 group hover:border-[var(--color-primary)]/30 transition-all shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-normal mb-1">
                              TABLE {order.table?.tableNumber || '??'}
                            </div>
                            <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">
                              ID: #{order._id.slice(-6)} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {order.status === 'PREPARING' && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] animate-pulse">
                              <Timer size={10} />
                              <span className="text-[8px] font-bold uppercase">Cooking</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between items-center bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 p-2.5 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                              <div className="flex items-center gap-3">
                                <div className="h-6 w-6 rounded-lg bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
                                  {item.quantity}
                                </div>
                                <span className="text-[11px] font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-muted)]">{item.menuItem?.name || 'Custom Item'}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {order.chefNote && (
                          <div className="mt-4 p-3 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)]/50 rounded-xl border-l-2 border-[var(--color-primary)] flex items-start gap-2">
                            <MessageSquare size={12} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                            <p className="text-[9px] font-bold text-[var(--color-text-muted)] leading-relaxed italic">&quot;{order.chefNote}&quot;</p>
                          </div>
                        )}

                        {lane.action(order)}
                      </motion.div>
                    ))}
                </AnimatePresence>

                {orders.filter(o => lane.statuses.includes(o.status)).length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                    <Coffee size={48} strokeWidth={1} />
                    <p className="text-[9px] font-bold uppercase tracking-normal mt-4">All done</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Note Modal */}
        <Modal
          isOpen={showNoteModal}
          onClose={() => setShowNoteModal(false)}
          title="Add Note for Staff"
          maxWidth="max-w-md"
        >
          <div className="space-y-6">
            <div className="p-4 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
               <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-3 block">Note / Message</label>
               <textarea
                 className="w-full bg-[var(--color-surface)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all min-h-[120px] dark:text-white shadow-inner"
                 placeholder="e.g. 5 min delay due to high volume..."
                 value={chefNote}
                 onChange={(e) => setChefNote(e.target.value)}
               />
            </div>
            <div className="flex gap-3">
               <Button 
                 variant="secondary" 
                 className="flex-1 !rounded-xl text-[10px] font-bold uppercase tracking-normal"
                 onClick={() => setShowNoteModal(false)}
               >
                 Cancel
               </Button>
               <Button 
                 variant="primary" 
                 className="flex-1 !rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal shadow-lg "
                 onClick={handleAddNote}
               >
                 Save Note
               </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}
