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
  RefreshCcw,
  Check
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { LoaderBlock } from '@/app/components/ui/Spinner';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import api from '@/app/services/api';
import toast from 'react-hot-toast';
import { PageTransition, SlideIn } from '../../components/ui/AnimatedContainer';
import Modal from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export default function ChefDashboard() {
  const { user, selectedLocation, socket } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [chefNote, setChefNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeLaneTab, setActiveLaneTab] = useState('incoming');
  // Ticking clock so KDS aging timers update live without a refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!selectedLocation) { setLoading(false); return; }
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
      console.error('Could not load orders. Please try again.');
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
      // Listeners are now attached to rooms joined in AuthContext.
      // Keep stable handler references so we only remove OUR listeners on cleanup
      // (socket.off('event') with no handler would wipe every listener for that event).
      const handleOrderNew = (data) => {
        toast.success('New Order!', { icon: '🔥', duration: 4000 });
        fetchOrders(true);
      };
      const handleOrderUpdate = () => fetchOrders(true);
      const handleOrderCancel = () => {
        toast.error('Order cancelled by admin');
        fetchOrders(true);
      };

      socket.on('order:new', handleOrderNew);
      socket.on('order:update', handleOrderUpdate);
      socket.on('order:cancel', handleOrderCancel);

      return () => {
        clearTimeout(timer);
        socket.off('order:new', handleOrderNew);
        socket.off('order:update', handleOrderUpdate);
        socket.off('order:cancel', handleOrderCancel);
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
      toast.error(error.response?.data?.message || 'Could not update status. Please try again.', { id: loadToast });
    }
  };

  // Per-item kitchen status (KOT): mark a single dish ready/preparing.
  const handleItemStatus = async (orderId, itemId, status) => {
    try {
      await api.patch(`/orders/${orderId}/item-status`, { itemId, status });
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not update item');
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
      toast.error('Could not save the note. Please try again.');
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
          className="w-full mt-4 !rounded-xl bg-primary hover:bg-primary text-[11px] font-semibold"
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
              className="flex-1 !rounded-xl bg-primary hover:bg-primary text-[11px] font-semibold"
              onClick={() => handleUpdateStatus(order._id, 'start')}
            >
              Start Prep
            </Button>
          ) : (
            <Button 
              variant="primary" 
              size="sm" 
              className="flex-1 !rounded-xl bg-success hover:bg-success text-[11px] font-semibold"
              onClick={() => handleUpdateStatus(order._id, 'ready')}
            >
              Mark Ready
            </Button>
          )}
          <button 
            onClick={() => { setSelectedOrder(order); setChefNote(order.chefNote || ''); setShowNoteModal(true); }}
            className="h-10 w-10 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) flex items-center justify-center text-(--color-text-muted) hover:text-primary transition-all"
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
        <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl text-center">
          <span className="text-[11px] font-medium text-success">Pick up</span>
        </div>
      )
    }
  ];

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                <ChefHat size={20} className="text-(--color-on-primary)" />
              </div>
              Kitchen
            </h1>
            <p className="text-xs text-(--color-text-muted) mt-1 font-medium ml-13">Manage kitchen orders</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-(--color-surface) text-(--color-text-muted) hover:text-primary hover:bg-primary/10 transition-all border border-(--color-border) disabled:opacity-50"
            >
              <RefreshCcw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="flex items-center gap-2 bg-(--color-surface) p-1.5 rounded-xl border border-(--color-border)">
               <div className="px-4 py-2 text-[11px] font-medium text-(--color-text-muted)">
                 Branch: <span className="text-primary ml-1">{selectedLocation?.name}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Mobile Lane Switcher Tabs */}
        <div className="flex lg:hidden bg-(--color-surface) p-1.5 rounded-xl border border-(--color-border) gap-2 mb-4">
          {lanes.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveLaneTab(l.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-300 ${activeLaneTab === l.id ? (l.id === 'incoming' ? 'bg-primary text-(--color-on-primary)' : l.id === 'preparing' ? 'bg-primary text-white' : 'bg-success text-white') : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
            >
              <l.icon size={14} />
              {l.title}
            </button>
          ))}
        </div>

        {/* Lane Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[60vh]">
          {lanes.map((lane) => (
            <div 
              key={lane.id} 
              className={`flex flex-col h-full bg-(--color-surface-soft)/30 rounded-xl border border-(--color-border) overflow-hidden ${activeLaneTab === lane.id ? 'flex' : 'hidden lg:flex'}`}
            >
              <div className="p-5 border-b border-(--color-border) bg-(--color-surface) flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-xl ${toneSoft(lane.color)} flex items-center justify-center`}>
                    <lane.icon size={16} className={toneText(lane.color)} />
                  </div>
                  <h3 className="text-[11px] font-semibold text-(--color-text-primary) uppercase tracking-normal">{lane.title}</h3>
                </div>
                <div className="h-6 px-2.5 rounded-full bg-(--color-bg-soft) flex items-center justify-center">
                  <span className="text-[11px] font-medium text-(--color-text-muted)">
                    {orders.filter(o => lane.statuses.includes(o.status)).length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
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
                        className="glass-card rounded-xl border border-(--color-border) p-5 group hover:border-primary/30 transition-all shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-[11px] font-semibold text-primary mb-1">
                              Table {order.table?.tableNumber || '??'}
                            </div>
                            <div className="text-[11px] font-medium text-(--color-text-muted)">
                              ID: #{order._id.slice(-6)} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {order.status === 'PREPARING' && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                                <Timer size={10} />
                                <span className="text-[10px] font-medium">Cooking</span>
                              </div>
                            )}
                            {(() => {
                              // KDS aging: minutes since the order was placed, colour-coded
                              // so the kitchen can prioritise overdue tickets.
                              const mins = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60000));
                              const tone = mins >= 20 ? 'bg-danger/15 text-danger' : mins >= 10 ? 'bg-amber-500/15 text-amber-500' : 'bg-success/15 text-success';
                              return (
                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${tone}`} title="Time since placed">
                                  <Timer size={10} />
                                  <span className="text-[10px] font-medium">{mins}m</span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {order.items.map((item, i) => {
                            const isReady = item.status === 'ready' || item.status === 'served';
                            const canToggle = !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(order.status);
                            return (
                            <div key={item._id || i} className={`flex justify-between items-center p-2.5 rounded-xl border transition-colors ${isReady ? 'bg-success/10 border-success/20' : 'bg-(--color-surface-soft) dark:bg-(--color-surface)/50 border-(--color-border) dark:border-(--color-border)'}`}>
                              <div className="flex items-center gap-3">
                                <div className="h-6 w-6 rounded-lg bg-(--color-surface-soft) dark:bg-(--color-surface) flex items-center justify-center text-[11px] font-semibold text-(--color-text-secondary) dark:text-(--color-text-muted)">
                                  {item.quantity}
                                </div>
                                <span className={`text-[11px] font-medium ${isReady ? 'text-success line-through' : 'text-(--color-text-primary) dark:text-(--color-text-muted)'}`}>{item.menuItem?.name || 'Custom Item'}</span>
                              </div>
                              {canToggle && item._id && (
                                <button
                                  onClick={() => handleItemStatus(order._id, item._id, isReady ? 'pending' : 'ready')}
                                  title={isReady ? 'Mark not ready' : 'Mark item ready'}
                                  className={`h-6 w-6 rounded-lg flex items-center justify-center border transition-all shrink-0 ${isReady ? 'bg-success text-white border-success' : 'border-(--color-border) text-(--color-text-muted) hover:border-success hover:text-success'}`}
                                >
                                  <Check size={12} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                            );
                          })}
                        </div>

                        {order.chefNote && (
                          <div className="mt-4 p-3 bg-(--color-surface-soft) dark:bg-(--color-surface)/50 rounded-xl border-l-2 border-primary flex items-start gap-2">
                            <MessageSquare size={12} className="text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] font-medium text-(--color-text-muted) leading-relaxed">&quot;{order.chefNote}&quot;</p>
                          </div>
                        )}

                        {lane.action(order)}
                      </motion.div>
                    ))}
                </AnimatePresence>

                {orders.filter(o => lane.statuses.includes(o.status)).length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                    <Coffee size={32} strokeWidth={1} />
                    <p className="text-[11px] font-medium mt-4">All done</p>
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
            <div className="p-4 bg-(--color-surface-soft) dark:bg-(--color-surface) rounded-xl border border-(--color-border) dark:border-(--color-border)">
               <label className="text-[11px] font-medium text-(--color-text-muted) mb-3 block">Note / Message</label>
               <textarea
                 className="w-full bg-(--color-surface) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) rounded-xl px-4 py-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-30 dark:text-white"
                 placeholder="e.g. 5 min delay due to high volume..."
                 value={chefNote}
                 onChange={(e) => setChefNote(e.target.value)}
               />
            </div>
            <div className="flex gap-3">
               <Button
                 variant="secondary"
                 className="flex-1 !rounded-xl text-[11px] font-medium"
                 onClick={() => setShowNoteModal(false)}
               >
                 Cancel
               </Button>
               <Button
                 variant="primary"
                 className="flex-1 !rounded-xl bg-primary hover:bg-primary text-[11px] font-semibold"
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
