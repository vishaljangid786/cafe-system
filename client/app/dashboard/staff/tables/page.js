'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../services/api';
import { Coffee, MapPin, Plus, Zap, Loader2, ShoppingBag, Receipt, X, Search, Check, Globe, Users, MessageSquare, RefreshCcw } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import TableCard from '../../../components/tables/TableCard';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';

export default function StaffTablesPage() {
  const { user, socket } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenuGrid, setShowMenuGrid] = useState(false);
  const [orderItem, setOrderItem] = useState({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [dietaryFilter, setDietaryFilter] = useState('All');
  const [systemOrders, setSystemOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // all, available, occupied
  const [isModalReady, setIsModalReady] = useState(false);
  const selectedTableRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
      const matchesDietary = dietaryFilter === 'All' || item.dietaryType === dietaryFilter;
      return matchesSearch && matchesDietary;
    });
  }, [menuItems, menuSearch, dietaryFilter]);

  // Sync ref with state
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  // Handle Progressive Rendering for smooth modal transitions
  useEffect(() => {
    if (showOrderModal) {
      const timer = setTimeout(() => setIsModalReady(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsModalReady(false);
    }
  }, [showOrderModal]);

  const fetchTables = async (silent = false) => {
    if (!user?.assignedLocation) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/tables?locationId=${user.assignedLocation._id || user.assignedLocation}`);
      setTables(res.data.data);
    } catch (error) {
      toast.error('Failed to sync floor plan');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTables();
    fetchMenu();
  };

  const fetchSystemOrders = async (tableId) => {
    try {
      const res = await api.get(`/orders?tableId=${tableId}&isBilled=false`);
      setSystemOrders(res.data.data);
    } catch (error) {
      console.error('Failed to fetch system orders');
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/menu');
      setMenuItems(res.data.data);
    } catch (error) {
      console.error("Menu sync failed");
    }
  };

  useEffect(() => {
    fetchTables();
    fetchMenu();
  }, [user]);

  useEffect(() => {
    if (socket && user?.assignedLocation) {
      const branchId = user.assignedLocation._id || user.assignedLocation;
      socket.emit('join_room', `branch_${branchId}`);
      socket.emit('join_room', `branch_${branchId}_staff`);

      socket.on('order:new', () => fetchTables(true));
      socket.on('order:update', () => {
        fetchTables(true);
        if (selectedTableRef.current) fetchSystemOrders(selectedTableRef.current._id);
      });
      socket.on('order:ready', (data) => {
        toast.success(data.message || 'Order is ready!', { icon: '🍱' });
        fetchTables(true);
      });

      return () => {
        socket.off('order:new');
        socket.off('order:update');
        socket.off('order:ready');
      };
    }
  }, [user, socket]);

  const handleBookTable = async (table) => {
    const loadToast = toast.loading('Securing table...');
    try {
      const res = await api.put(`/tables/${table._id}/book`, {
        numberOfPeople: table.capacity || 1,
        customerName: ''
      });
      fetchTables();
      handleOpenOrder(res.data.data);
      toast.success('Table secured', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Encryption error', { id: loadToast });
    }
  };

  const handleOpenOrder = (table) => {
    setSelectedTable(table);
    setPendingOrders([...table.orders]);
    fetchSystemOrders(table._id);
    setShowOrderModal(true);
  };

  const handleStageOrder = (e) => {
    e.preventDefault();
    if (!orderItem.itemName || !orderItem.price) return toast.error('Selection required');

    const newItem = {
      ...orderItem,
      uid: `${Date.now()}-${Math.random()}`,
      quantity: Number(orderItem.quantity),
      price: Number(orderItem.price),
      menuItemId: orderItem.menuItemId || null,
      categoryId: orderItem.categoryId || null
    };

    setPendingOrders(prev => [...prev, newItem]);
    setOrderItem({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' });
    setShowMenuGrid(false);
    toast.success('Staged locally');
  };

  const handleSyncOrders = async (ordersToSync, extra = {}) => {
    // Update local state immediately for responsiveness
    setSelectedTable(prev => ({ ...prev, ...extra }));
    if (ordersToSync) setPendingOrders(ordersToSync);

    // Debounce the API call
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = { 
          orders: ordersToSync || pendingOrders,
          ...extra
        };
        const res = await api.put(`/tables/${selectedTable._id}/orders`, payload);
        setSelectedTable(prev => ({ 
          ...res.data.data,
          customerName: prev._id === res.data.data._id ? prev.customerName : res.data.data.customerName,
          numberOfPeople: prev._id === res.data.data._id ? prev.numberOfPeople : res.data.data.numberOfPeople
        }));
      } catch (error) {
        console.error('Auto-sync failed', error);
      }
    }, 800);
  };

  const handleRemoveStagedItem = (idx) => {
    if (appliedCoupon) return toast.error('Remove coupon to modify order');
    const newOrders = pendingOrders.filter((_, i) => i !== idx);
    setPendingOrders(newOrders);
    handleSyncOrders(newOrders);
  };

  const handleRemoveOrderItem = async (idx) => {
    const loadToast = toast.loading('Removing item...');
    try {
      const newOrders = selectedTable.orders.filter((_, i) => i !== idx);
      const res = await api.put(`/tables/${selectedTable._id}/orders`, { orders: newOrders });
      setSelectedTable(res.data.data);
      setPendingOrders([...newOrders]);
      fetchTables();
      toast.success('Item removed', { id: loadToast });
    } catch (error) {
      toast.error('Removal failed', { id: loadToast });
    }
  };

  const handleFinalizeSession = async (file, finalTotal) => {
    const loadToast = toast.loading('Archiving session...');
    if (!selectedTable.customerName) {
      toast.error('Customer identity required for archival', { id: loadToast });
      return;
    }

    const data = new FormData();
    data.append('billImage', file);
    try {
      await api.put(`/tables/${selectedTable._id}/bill`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsBillPreviewOpen(false);
      setShowOrderModal(false);
      setSelectedTable(null);
      setAppliedCoupon(null);
      setDiscountAmount(0);
      setCouponCode('');
      fetchTables();
      toast.success('Session archived', { id: loadToast });
    } catch (error) {
      toast.error('Archival failure', { id: loadToast });
    }
  };

  const handleSendToKitchen = async () => {
    if (pendingOrders.length === 0) return toast.error('No items staged for production');
    if (!selectedTable.customerName) return toast.error('Guest identity required');

    const loadToast = toast.loading('Transmitting to kitchen...');
    try {
      const payload = {
        branch: selectedTable.locationId?._id || selectedTable.locationId,
        table: selectedTable._id,
        items: pendingOrders.map(item => ({
          menuItem: item.menuItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice || 0
        })),
        totalAmount: pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity)), 0)
      };

      await api.post('/orders', payload);
      
      // Clear staged orders in the table document
      await api.put(`/tables/${selectedTable._id}/orders`, { orders: [] });
      
      setPendingOrders([]);
      fetchTables();
      fetchSystemOrders(selectedTable._id);
      toast.success('Transmission Successful', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transmission failure', { id: loadToast });
    }
  };

  const handleApplyCoupon = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add items before applying coupon');
    if (!couponCode) return toast.error('Enter coupon code');
    const loadToast = toast.loading('Verifying coupon...');
    try {
      const subtotal = pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0);
      const res = await api.post('/coupons/apply', { 
        code: couponCode, 
        orderAmount: subtotal,
        orderItems: pendingOrders.map(item => ({
          menuItemId: item.menuItemId?._id || item.menuItemId,
          categoryId: item.categoryId?._id || item.categoryId,
          price: item.price,
          quantity: item.quantity
        }))
      });
      setAppliedCoupon(res.data.data);
      setDiscountAmount(res.data.data.discount);
      toast.success('Coupon activated', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid coupon', { id: loadToast });
    }
  };

  const updateQuantity = (idx, delta) => {
    if (appliedCoupon) return toast.error('Remove coupon to modify order quantity');
    const newOrders = [...pendingOrders];
    const item = { ...newOrders[idx] };
    if (item.quantity + delta > 0) {
      item.quantity += delta;
      newOrders[idx] = item;
      setPendingOrders(newOrders);
      handleSyncOrders(newOrders);
    }
  };

  const stats = {
    total: tables.length,
    occupied: tables.filter(t => t.status !== 'available').length,
    revenue: tables.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0)
  };

  if (loading) return (
    <div className="space-y-6 p-4">
      <div className="h-16 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-36 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Globe size={20} className="text-amber-500" />
              </div>
              Floor Command Deck
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">Real-time table synchronization & management</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {['all', 'available', 'occupied'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === f 
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                      : 'text-zinc-500 hover:text-amber-500'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 transition-all disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-10 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
               <MapPin size={14} className="text-amber-500" />
               <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{user?.assignedLocation?.name || 'Sector Unknown'}</span>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Tables', val: stats.total, color: 'amber', icon: Globe },
            { label: 'Occupied', val: stats.occupied, color: 'amber', icon: Zap },
            { label: 'Live Revenue', val: `₹${stats.revenue.toLocaleString()}`, color: 'emerald', icon: Receipt }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.05}>
              <div className="glass-morphism rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={`text-${stat.color}-500`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 leading-none">{stat.val}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">{stat.label}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Table Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence mode='popLayout'>
            {tables
              .filter(t => {
                if (statusFilter === 'available') return t.status === 'available';
                if (statusFilter === 'occupied') return t.status !== 'available';
                return true;
              })
              .map((table, i) => (
                <SlideIn key={table._id} delay={i * 0.02} direction="up">
                  <TableCard
                    table={table}
                    onAssign={handleBookTable}
                    onManage={handleOpenOrder}
                  />
                </SlideIn>
              ))}
          </AnimatePresence>
        </div>

        {/* Modals */}
        <BillPreview isOpen={isBillPreviewOpen} onClose={() => setIsBillPreviewOpen(false)} onComplete={handleFinalizeSession} table={selectedTable} systemOrders={systemOrders} />

        <Modal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title={`Session Matrix: T${selectedTable?.tableNumber}${selectedTable?.tableName ? ` — ${selectedTable.tableName}` : ''}`}
          maxWidth="max-w-7xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
              {/* Left Side: Active Registry (Order Summary) */}
              <div className="lg:col-span-5 flex flex-col h-full bg-muted/30 rounded-[2.5rem] border border-border overflow-hidden">
                <div className="p-8 border-b border-border bg-gradient-to-br from-muted/50 to-card dark:from-zinc-950/50 dark:to-zinc-900/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Session Core
                      </h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Order Registry</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-foreground tracking-tighter">
                        {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)}
                      </span>
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Units Staged</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 p-5 bg-card rounded-[2rem] border border-border shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        Guest Identity <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="ENTER NAME"
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-muted-foreground/30 dark:text-white"
                        value={selectedTable.customerName || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Table Party
                      </label>
                      <div className="relative">
                        <input 
                          type="number"
                          disabled={user?.role === 'staff'}
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-40 text-foreground"
                          value={selectedTable.numberOfPeople || 0}
                          onChange={(e) => handleSyncOrders(pendingOrders, { numberOfPeople: e.target.value })}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Users size={14} className="text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {pendingOrders.map((order, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={order.uid || `${order.menuItemId || order.itemName}-${idx}`}
                      className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border group hover:border-accent/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          {order.image ? <img src={order.image} className="h-full w-full object-cover" /> : <Coffee size={18} className="text-zinc-400" />}
                        </div>
                        <div>
                          <div className="text-xs font-black text-foreground line-clamp-1">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase mt-0.5">₹{Number(order.price).toLocaleString()} / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-muted rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-black text-foreground">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-black text-amber-600 w-16 text-right">
                          ₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleRemoveStagedItem(idx)}
                          className="h-6 w-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {pendingOrders.length === 0 && systemOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 py-20">
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-zinc-400" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Registry is Empty</p>
                    </div>
                  )}

                  {/* System Orders Section (OMS) */}
                  {(systemOrders.length > 0 || pendingOrders.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
                      <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Zap size={14} /> Production Queue (OMS)
                      </h3>
                      <div className="space-y-3">
                        {systemOrders.length > 0 ? (
                          systemOrders.map((order) => (
                            <div key={order._id} className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between group shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
                                <div>
                                  <div className="text-[11px] font-black text-foreground uppercase tracking-tight">#{order._id.slice(-6)}</div>
                                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{order.status}</div>
                                </div>
                              </div>
                              
                              {/* Chef Note Display */}
                              {order.chefNote && (
                                <div className="flex-1 mx-4 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-2 group/note relative">
                                  <MessageSquare size={12} className="text-amber-500 flex-shrink-0" />
                                  <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-tight line-clamp-1">{order.chefNote}</p>
                                  
                                  {/* Hover expansion */}
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-zinc-900 text-white text-[10px] font-medium rounded-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    {order.chefNote}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-zinc-900" />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="text-[10px] font-black text-zinc-900 dark:text-zinc-100">₹{Number(order.totalAmount).toLocaleString()}</div>
                                {order.status === 'COMPLETED' && !order.isBilled && (
                                  <button
                                    onClick={async () => {
                                      const loadToast = toast.loading('Generating fiscal proof...');
                                      try {
                                        const res = await api.post(`/orders/${order._id}/generate-bill`);
                                        toast.success('Bill Generated & Locked', { id: loadToast });
                                        fetchSystemOrders(selectedTable._id);
                                      } catch (err) {
                                        toast.error('Billing Failure', { id: loadToast });
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-amber-500/20"
                                  >
                                    Generate Bill
                                  </button>
                                )}
                                {order.isBilled && (
                                  <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
                                    <Check size={10} /> Billed
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-[9px] font-black uppercase tracking-widest text-zinc-300">No active production units</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-border bg-card/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <span>Production Subtotal</span>
                      <span>₹{systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                        <span>Discount</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Billed Total</span>
                      <span className="text-4xl font-black text-foreground tracking-tighter">
                        ₹{Math.max(0,
                          systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className={`grid ${systemOrders.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <Button
                      variant="primary"
                      className="w-full !rounded-2xl !py-4 shadow-xl shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-[10px] font-black uppercase tracking-widest"
                      icon={Zap}
                      onClick={handleSendToKitchen}
                      disabled={pendingOrders.length === 0}
                    >
                      Send to Kitchen
                    </Button>
                    {systemOrders.length > 0 && (
                      <Button
                        variant="primary"
                        className="w-full !rounded-2xl !py-4 shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase tracking-widest"
                        icon={Receipt}
                        onClick={() => {
                          const allReady = systemOrders.every(o => ['SERVED', 'COMPLETED'].includes(o.status));
                          if (!allReady) return toast.error('Culinary Protocol: All orders must be SERVED before finalization');
                          setIsBillPreviewOpen(true);
                        }}
                      >
                        Finalize & Bill
                      </Button>
                    )}
                  </div>
                </div>             </div>

              {/* Right Side: Menu Selection & Discovery */}
              <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-6">
                {/* Search & Top Filters */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search the menu matrix..."
                    className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 pl-12 pr-4 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 transition-all dark:text-white"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
                  <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-fit">
                    {[
                      { id: 'All', label: 'All Items' },
                      { id: 'veg', label: 'Veg Only', color: 'text-green-500' },
                      { id: 'non-veg', label: 'Non-Veg', color: 'text-red-500' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setDietaryFilter(f.id)}
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          dietaryFilter === f.id 
                            ? 'bg-amber-500 text-black shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                        } ${f.color || ''}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Most Selling / Recommendations */}
                {!menuSearch && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center">
                      <Zap size={12} className="mr-2 text-amber-500" /> Top Performing Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => (
                        <div
                          key={item._id}
                          className="flex-shrink-0 w-40 glass-morphism rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 hover:border-amber-500/30 transition-all cursor-pointer group"
                          onClick={() => {
                            if (appliedCoupon) return toast.error('Remove coupon to add new items');
                            const existingIdx = pendingOrders.findIndex(o => o.menuItemId === item._id);
                            let newOrders;
                            if (existingIdx > -1) {
                              newOrders = [...pendingOrders];
                              newOrders[existingIdx] = { ...newOrders[existingIdx], quantity: newOrders[existingIdx].quantity + 1 };
                            } else {
                              newOrders = [...pendingOrders, {
                                itemName: item.name,
                                image: item.image,
                                price: Number(item.discountedPrice || item.price),
                                costPrice: Number(item.costPrice || 0),
                                quantity: 1,
                                menuItemId: item._id,
                                categoryId: item.category?._id || item.category
                              }];
                            }
                            setPendingOrders(newOrders);
                            handleSyncOrders(newOrders);
                            toast.success(`Added ${item.name}`, { duration: 1000 });
                          }}
                        >
                          <div className="h-20 w-full rounded-xl overflow-hidden mb-3 bg-zinc-100 dark:bg-zinc-800 relative">
                            {item.image ? (
                              <img src={item.image} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-zinc-300"><Coffee size={24} /></div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <Plus className="text-white" size={24} />
                            </div>
                          </div>
                          <div className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 truncate">{item.name}</div>
                          <div className="text-[10px] font-bold text-amber-600 mt-1">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Menu Grid */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Full Menu Grid</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {isModalReady ? filteredMenuItems.map((item) => (
                        <div
                          key={item._id}
                          onClick={() => {
                            if (appliedCoupon) return toast.error('Remove coupon to add new items');
                            const existingIdx = pendingOrders.findIndex(o => o.menuItemId === item._id);
                            let newOrders;
                            if (existingIdx > -1) {
                              newOrders = [...pendingOrders];
                              newOrders[existingIdx] = { ...newOrders[existingIdx], quantity: newOrders[existingIdx].quantity + 1 };
                            } else {
                              newOrders = [...pendingOrders, {
                                itemName: item.name,
                                image: item.image,
                                price: Number(item.discountedPrice || item.price),
                                costPrice: Number(item.costPrice || 0),
                                quantity: 1,
                                menuItemId: item._id,
                                categoryId: item.category?._id || item.category
                              }];
                            }
                            setPendingOrders(newOrders);
                            handleSyncOrders(newOrders);
                            toast.success(`Added ${item.name}`, { duration: 1000 });
                          }}
                          className="bg-card p-4 rounded-3xl border border-border hover:border-accent/30 transition-all cursor-pointer flex flex-col gap-3 group relative shadow-sm hover:shadow-xl hover:shadow-accent/5"
                        >
                          <div className="h-24 w-full rounded-2xl bg-muted overflow-hidden relative shadow-inner">
                            {item.image ? (
                              <img src={item.image} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                <Coffee size={20} />
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <div className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest text-white ${item.dietaryType === 'veg' ? 'bg-green-500' : 'bg-red-500'}`}>
                                {item.dietaryType || 'Cuisine'}
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <Plus className="text-white drop-shadow-md" size={32} strokeWidth={3} />
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-black text-foreground leading-tight truncate">{item.name}</div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[10px] font-bold text-accent">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                              <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-accent group-hover:text-black transition-all">
                                <Plus size={12} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        [1,2,3,4,5,6].map(i => (
                          <div key={i} className="h-40 rounded-3xl bg-muted/20 animate-pulse border border-border" />
                        ))
                      )}
                  </div>
                </div>

                {/* Coupon Panel */}
                <div className="p-6 bg-zinc-50 dark:bg-zinc-950/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 ml-1">Apply Coupon Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all dark:text-white"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                    {appliedCoupon && (
                      <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-emerald-500 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Check size={12} /> {appliedCoupon.code} Activated
                        </div>
                        <button 
                          onClick={() => {
                            setAppliedCoupon(null);
                            setDiscountAmount(0);
                            setCouponCode('');
                            toast.success('Coupon removed - Order unlocked');
                          }}
                          className="text-rose-500 hover:text-rose-700 uppercase text-[9px] font-black"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        <BillPreview
          isOpen={isBillPreviewOpen}
          onClose={() => setIsBillPreviewOpen(false)}
          onComplete={handleFinalizeSession}
          table={selectedTable}
          systemOrders={systemOrders}
        />
      </div>
    </PageTransition>
  );
}
