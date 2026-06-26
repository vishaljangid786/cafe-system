'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../services/api';
import { Coffee, MapPin, Plus, Zap, ShoppingBag, Receipt, X, Search, Check, Globe, Users, MessageSquare, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import TableCard from '../../../components/tables/TableCard';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';
import { toneText, toneBg, toneSoft, toneBorder } from '../../../components/ui/tone';
import PremiumSelect from '../../../components/ui/PremiumSelect';

export default function StaffTablesPage() {
  const { user, socket, selectedLocation } = useAuth();
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
    const timer = setTimeout(() => {
      setIsModalReady(showOrderModal);
    }, showOrderModal ? 300 : 0);

    return () => clearTimeout(timer);
  }, [showOrderModal]);

  const fetchTables = async (silent = false) => {
    const locId = selectedLocation?._id || selectedLocation || user?.assignedLocation?._id || user?.assignedLocation;
    if (!locId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/tables?locationId=${locId}`);
      setTables(res.data.data);
    } catch (error) {
      toast.error('Could not load tables. Please try again.');
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
    const locId = selectedLocation?._id || selectedLocation || user?.assignedLocation?._id || user?.assignedLocation;
    if (!locId) return;
    try {
      const res = await api.get(`/menu?locationId=${locId}`);
      setMenuItems(res.data.data);
    } catch (error) {
      console.error("Menu sync failed");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTables();
      fetchMenu();
    }, 0);

    return () => clearTimeout(timer);
  }, [user?._id, selectedLocation?._id || selectedLocation]);

  useEffect(() => {
    const locId = selectedLocation?._id || selectedLocation || user?.assignedLocation?._id || user?.assignedLocation;
    if (socket && locId) {
      // Listeners are now attached to rooms joined in AuthContext
      socket.on('table:update', () => fetchTables(true));
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
        socket.off('table:update');
        socket.off('order:new');
        socket.off('order:update');
        socket.off('order:ready');
      };
    }
  }, [user?._id, socket]);

  const handleBookTable = async (table) => {
    const loadToast = toast.loading('Booking table...');
    try {
      const res = await api.put(`/tables/${table._id}/book`, {
        numberOfPeople: table.capacity || 1,
        customerName: ''
      });
      fetchTables();
      handleOpenOrder(res.data.data);
      toast.success('Table booked', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not book the table. Please try again.', { id: loadToast });
    }
  };

  const handleOpenOrder = (table) => {
    setSelectedTable(table);
    setPendingOrders([...(table.orders || [])]);
    fetchSystemOrders(table._id);
    setShowOrderModal(true);
  };

  const handleStageOrder = (e) => {
    e.preventDefault();
    if (!orderItem.itemName || !orderItem.price) return toast.error('Please select an item');

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
    toast.success('Item added');
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
    if (appliedCoupon) return toast.error('Please remove the coupon before changing the order');
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
      toast.error('Could not remove the item. Please try again.', { id: loadToast });
    }
  };

  const handleFinalizeSession = async (file, finalTotal, paymentType = 'CASH') => {
    const loadToast = toast.loading('Saving bill...');
    if (!selectedTable.customerName) {
      toast.error('Please enter the customer name', { id: loadToast });
      return;
    }

    const data = new FormData();
    data.append('billImage', file);
    data.append('paymentType', paymentType);
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
      toast.success('Bill saved', { id: loadToast });
    } catch (error) {
      toast.error('Could not save the bill. Please try again.', { id: loadToast });
    }
  };

  const handleSendToKitchen = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add at least one item');
    if (!selectedTable.customerName) return toast.error('Please enter the customer name');

    const loadToast = toast.loading('Sending to kitchen...');
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
        totalAmount: pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity)), 0),
        discountAmount: Number(discountAmount || 0),
        couponId: appliedCoupon?.couponId || null
      };

      await api.post('/orders', payload);
      
      // Clear staged orders in the table document
      await api.put(`/tables/${selectedTable._id}/orders`, { orders: [] });
      
      setPendingOrders([]);
      fetchTables();
      fetchSystemOrders(selectedTable._id);
      toast.success('Order sent to kitchen', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send the order. Please try again.', { id: loadToast });
    }
  };

  const handleApplyCoupon = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add items before applying a coupon');
    if (!couponCode) return toast.error('Please enter a coupon code');
    const loadToast = toast.loading('Checking coupon...');
    try {
      const subtotal = pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0);
      const res = await api.post('/coupons/apply', { 
        code: couponCode.toUpperCase(),
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
      toast.success('Coupon applied', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid coupon', { id: loadToast });
    }
  };

  const updateQuantity = (idx, delta) => {
    if (appliedCoupon) return toast.error('Please remove the coupon before changing quantity');
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
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe size={20} className="text-primary" />
              </div>
              Tables
            </h1>
            <p className="text-xs text-(--color-text-muted) mt-1 font-medium">Manage your tables in real time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-(--color-surface-soft) dark:bg-(--color-surface) p-1 rounded-xl border border-(--color-border) dark:border-(--color-border)">
              {['all', 'available', 'occupied'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-xl text-[11px] font-medium uppercase tracking-normal transition-all ${
                    statusFilter === f
                      ? 'bg-primary text-(--color-on-primary) shadow-sm '
                      : 'text-(--color-text-muted) hover:text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="h-10 w-px bg-(--color-surface-soft) dark:bg-(--color-surface) mx-1 hidden sm:block" />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted) hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-10 w-px bg-(--color-surface-soft) dark:bg-(--color-surface) mx-1 hidden sm:block" />
            <div className="flex items-center gap-2 px-4 py-2 bg-(--color-surface-soft) dark:bg-(--color-surface) rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm">
               <MapPin size={14} className="text-primary" />
               <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">{user?.assignedLocation?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Tables', val: stats.total, color: 'amber', icon: Globe },
            { label: 'Occupied', val: stats.occupied, color: 'amber', icon: Zap },
            { label: 'Current Sales', val: `₹${stats.revenue.toLocaleString()}`, color: 'emerald', icon: Receipt }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.05}>
              <div className="glass-morphism rounded-xl border border-(--color-border) dark:border-(--color-border) p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl ${toneSoft(stat.color)} flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={toneText(stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) leading-none">{stat.val}</p>
                  <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) mt-0.5">{stat.label}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Table Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
          title={`Table ${selectedTable?.tableNumber}${selectedTable?.tableName ? ` — ${selectedTable.tableName}` : ''}`}
          maxWidth="max-w-7xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[75vh]">
              {/* Left Side: Active Registry (Order Summary) */}
              <div className="lg:col-span-5 flex flex-col h-full bg-(--color-surface-soft)/30 rounded-xl border border-(--color-border) overflow-hidden">
                <div className="p-5 border-b border-(--color-border) bg-gradient-to-br from-muted/50 to-card dark:from-(--color-surface)/50 dark:to-(--color-surface)/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-medium text-primary uppercase tracking-normal flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Order Details
                      </h3>
                      <p className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Current Order</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-semibold text-(--color-text-primary) tracking-tight">
                        {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)}
                      </span>
                      <span className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Items Added</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 p-5 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1 flex items-center gap-2">
                        Customer Name <span className="text-danger font-medium">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="ENTER CUSTOMER NAME"
                        className="w-full bg-(--color-surface-soft) border border-(--color-border) rounded-xl px-4 py-2.5 mt-1 text-xs font-medium outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-(--color-text-muted)/30 dark:text-white"
                        value={selectedTable.customerName || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <PremiumSelect
                        label="Number of People"
                        placeholder="Select People"
                        options={Array.from({ length: Number(selectedTable.capacity) || 4 }, (_, i) => ({
                          value: i + 1,
                          label: `${i + 1} ${i + 1 === 1 ? 'Guest' : 'Guests'}`
                        }))}
                        value={selectedTable.numberOfPeople || 1}
                        onChange={(val) => handleSyncOrders(pendingOrders, { numberOfPeople: val })}
                        icon={Users}
                      />
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
                      className="flex justify-between items-center bg-(--color-surface) p-4 rounded-xl border border-(--color-border) group hover:border-accent/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-(--color-surface-soft) dark:bg-(--color-surface) flex items-center justify-center">
                          {order.image ? <img src={order.image} alt={order.itemName} className="h-full w-full object-cover" /> : <Coffee size={18} className="text-(--color-text-muted)" />}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-(--color-text-primary) line-clamp-1">{order.itemName}</div>
                          <div className="text-[11px] font-medium text-(--color-text-muted) tracking-normal uppercase mt-0.5">₹{Number(order.price).toLocaleString()} / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-(--color-surface-soft) rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-(--color-surface) dark:hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-(--color-text-primary)">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-(--color-surface) dark:hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-semibold text-primary w-16 text-right">
                          ₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleRemoveStagedItem(idx)}
                          className="h-6 w-6 rounded-lg bg-danger/10 text-danger flex items-center justify-center hover:bg-danger hover:text-white transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {pendingOrders.length === 0 && systemOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 py-10">
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-(--color-text-muted)" />
                      <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">No items added yet</p>
                    </div>
                  )}

                  {/* System Orders Section (OMS) */}
                  {(systemOrders.length > 0 || pendingOrders.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-(--color-border) dark:border-(--color-border)">
                      <h3 className="text-[11px] font-medium text-primary uppercase tracking-normal mb-4 flex items-center gap-2">
                        <Zap size={14} /> Kitchen Orders
                      </h3>
                      <div className="space-y-3">
                        {systemOrders.length > 0 ? (
                          systemOrders.map((order) => (
                            <div key={order._id} className="bg-(--color-surface) p-4 rounded-xl border border-(--color-border) flex items-center justify-between group shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${order.status === 'COMPLETED' ? 'bg-success ' : 'bg-primary animate-pulse'}`} />
                                <div>
                                  <div className="text-[11px] font-medium text-(--color-text-primary) uppercase tracking-tight">#{order._id.slice(-6)}</div>
                                  <div className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">{order.status}</div>
                                </div>
                              </div>
                              
                              {/* Chef Note Display */}
                              {order.chefNote && (
                                <div className="flex-1 mx-4 px-3 py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2 group/note relative">
                                  <MessageSquare size={12} className="text-primary flex-shrink-0" />
                                  <p className="text-[11px] font-medium text-primary dark:text-primary leading-tight line-clamp-1">{order.chefNote}</p>
                                  
                                  {/* Hover expansion */}
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-(--color-text-primary) text-(--color-surface) text-[10px] font-medium rounded-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-sm">
                                    {order.chefNote}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-(--color-border-strong)" />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="text-[11px] font-medium text-(--color-text-primary) dark:text-(--color-text-primary)">₹{Number(order.totalAmount).toLocaleString()}</div>
                                {order.status === 'COMPLETED' && !order.isBilled && (
                                  <button
                                    onClick={async () => {
                                      const loadToast = toast.loading('Generating bill...');
                                      try {
                                        const res = await api.post(`/orders/${order._id}/generate-bill`);
                                        toast.success('Bill generated', { id: loadToast });
                                        fetchSystemOrders(selectedTable._id);
                                      } catch (err) {
                                        toast.error('Could not generate the bill. Please try again.', { id: loadToast });
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary text-white text-[11px] font-semibold uppercase tracking-normal rounded-lg transition-all shadow-sm "
                                  >
                                    Generate Bill
                                  </button>
                                )}
                                {order.isBilled && (
                                  <div className="px-3 py-1.5 bg-success/10 text-success text-[11px] font-medium uppercase tracking-normal rounded-lg flex items-center gap-1">
                                    <Check size={10} /> Billed
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">No orders sent to kitchen yet</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 border-t border-(--color-border) bg-(--color-surface)/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                      <span>Kitchen Subtotal</span>
                      <span>₹{systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[11px] font-medium uppercase tracking-normal text-success">
                        <span>Discount</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-(--color-surface-soft) dark:bg-(--color-surface) my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-medium uppercase text-(--color-text-muted) tracking-normal mb-2">Billed Total</span>
                      <span className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">
                        ₹{Math.max(0,
                          systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className={`grid ${systemOrders.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <Button
                      variant="primary"
                      className="w-full !rounded-xl !py-3 shadow-sm  bg-primary hover:bg-primary text-[11px] font-semibold uppercase tracking-normal"
                      icon={Zap}
                      onClick={handleSendToKitchen}
                      disabled={pendingOrders.length === 0}
                    >
                      Send to Kitchen
                    </Button>
                    {systemOrders.length > 0 && (
                      <Button
                        variant="primary"
                        className="w-full !rounded-xl !py-3 shadow-sm  bg-success hover:bg-success text-[11px] font-semibold uppercase tracking-normal"
                        icon={Receipt}
                        onClick={() => {
                          const allReady = systemOrders.every(o => ['SERVED', 'COMPLETED'].includes(o.status));
                          if (!allReady) return toast.error('All orders must be served before you can finish the bill');
                          setIsBillPreviewOpen(true);
                        }}
                      >
                        Finish & Bill
                      </Button>
                    )}
                  </div>
                </div>             </div>

              {/* Right Side: Menu Selection & Discovery — the whole column scrolls
                  as one unit (search, top-selling, full menu, coupon) rather than
                  trapping the scroll inside just the menu grid. */}
              <div className="lg:col-span-7 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 space-y-6">
                {/* Search & Top Filters */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search the menu..."
                    className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) pl-12 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
                  <div className="flex bg-(--color-surface-soft) dark:bg-(--color-surface)/50 p-1 rounded-xl border border-(--color-border) dark:border-(--color-border) w-fit">
                    {[
                      { id: 'All', label: 'All Items' },
                      { id: 'veg', label: 'Veg Only', color: 'text-success' },
                      { id: 'non-veg', label: 'Non-Veg', color: 'text-danger' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setDietaryFilter(f.id)}
                        className={`px-4 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-normal transition-all ${
                          dietaryFilter === f.id
                            ? 'bg-primary text-(--color-on-primary) shadow-sm'
                            : 'text-(--color-text-muted) hover:text-(--color-text-primary) dark:hover:text-(--color-text-muted)'
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
                    <h3 className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal flex items-center">
                      <Zap size={12} className="mr-2 text-primary" /> Top Selling Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => (
                        <div
                          key={item._id}
                          className={`flex-shrink-0 w-40 glass-morphism rounded-xl p-4 border border-(--color-border) dark:border-(--color-border) transition-all group ${!item.isAvailable ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-primary/30 cursor-pointer'}`}
                          onClick={() => {
                            if (!item.isAvailable) return toast.error(`${item.name} is out of stock right now`, { icon: '🚫' });
                            if (appliedCoupon) return toast.error('Please remove the coupon before adding new items');
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
                          <div className="h-20 w-full rounded-xl overflow-hidden mb-3 bg-(--color-surface-soft) dark:bg-(--color-surface) relative">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)"><Coffee size={24} /></div>
                            )}
                            {!item.isAvailable ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-[11px] font-medium text-white uppercase tracking-normal px-2 py-1 border border-(--color-border) rounded-full">Sold Out</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <Plus className="text-white" size={24} />
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-(--color-text-primary) dark:text-(--color-text-primary) truncate">{item.name}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-[11px] font-semibold text-primary">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                            {item.isAvailable && item.stock !== undefined && (
                              <span className={`text-[11px] font-medium uppercase tracking-tight ${item.stock < 10 ? 'text-danger' : 'text-success'}`}>{item.stock} left</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Menu Grid — flows in the column scroll (no inner scrollbar) */}
                <div className="space-y-6">
                  <h3 className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Full Menu</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {isModalReady ? filteredMenuItems.map((item) => (
                        <div
                          key={item._id}
                          onClick={() => {
                            if (!item.isAvailable) return toast.error(`${item.name} is out of stock right now`, { icon: '🚫' });
                            if (appliedCoupon) return toast.error('Please remove the coupon before adding new items');
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
                          className={`bg-(--color-surface) p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 group relative shadow-sm hover:shadow-sm hover:shadow-accent/5 ${!item.isAvailable ? 'opacity-50 grayscale' : 'hover:border-accent/30'}`}
                        >
                          <div className="h-24 w-full rounded-xl bg-(--color-surface-soft) overflow-hidden relative shadow-inner">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)">
                                <Coffee size={20} />
                              </div>
                            )}
                            
                            {!item.isAvailable && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center -[2px]">
                                <span className="text-[11px] font-medium text-white uppercase tracking-normal px-3 py-1 border border-(--color-border) rounded-full">Sold Out</span>
                              </div>
                            )}

                            <div className="absolute top-2 left-2">
                              <div className={`px-2 py-0.5 rounded-full text-[7px] font-medium uppercase tracking-normal text-white ${item.dietaryType === 'veg' ? 'bg-success' : 'bg-danger'}`}>
                                {item.dietaryType || 'Food'}
                              </div>
                            </div>
                            
                            {item.isAvailable && (
                              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <Plus className="text-white" size={32} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <div className="text-[11px] font-medium text-(--color-text-primary) leading-tight truncate flex-1">{item.name}</div>
                              {item.isAvailable && item.stock !== undefined && (
                                <div className={`text-[8px] font-medium px-1.5 py-0.5 rounded-md uppercase tracking-tight shrink-0 ${item.stock < 10 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                                  {item.stock} left
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[11px] font-semibold text-accent">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                              <div className="h-6 w-6 rounded-lg bg-(--color-surface-soft) flex items-center justify-center text-(--color-text-muted) group-hover:bg-primary group-hover:text-(--color-on-primary) transition-all">
                                {item.isAvailable ? <Plus size={12} /> : <Zap size={10} className="opacity-40" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        [1,2,3,4,5,6].map(i => (
                          <Skeleton key={i} className="h-40 rounded-xl" />
                        ))
                      )}
                  </div>
                </div>

                {/* Coupon Panel */}
                <div className="p-5 bg-(--color-surface-soft) dark:bg-(--color-bg)/30 rounded-xl border border-(--color-border) dark:border-(--color-border)">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Apply Coupon Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          className="flex-1 bg-(--color-surface) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-primary text-(--color-on-primary) rounded-xl text-[11px] font-semibold uppercase tracking-normal hover:bg-(--color-primary-hover) transition-all"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                    {appliedCoupon && (
                      <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl text-[11px] font-medium text-success flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Check size={12} /> {appliedCoupon.code} Applied
                        </div>
                        <button
                          onClick={() => {
                            setAppliedCoupon(null);
                            setDiscountAmount(0);
                            setCouponCode('');
                            toast.success('Coupon removed');
                          }}
                          className="text-danger hover:text-danger uppercase text-[11px] font-medium"
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
      </div>
    </PageTransition>
  );
}
