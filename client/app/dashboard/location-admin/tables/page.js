"use client"
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Search, Globe, ShieldAlert } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import TableCard from '../../../components/tables/TableCard';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';
import { Button } from '@/app/components/ui/Button';
import { toneText, toneBg, toneSoft, toneBorder } from '../../../components/ui/tone';
import { Skeleton } from '@/app/components/ui/Skeleton';

export default function TablesPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('1');
  const [orderItem, setOrderItem] = useState({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenuGrid, setShowMenuGrid] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data.data);
    } catch (error) {
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [menuRes, couponRes] = await Promise.all([
          api.get('/menu'),
          api.get('/coupons?active=true')
        ]);
        setMenuItems(menuRes.data.data);
        setCoupons(couponRes.data.data);
      } catch (error) {
        console.error("Load failed");
      }
    };
    const timer = setTimeout(() => {
      fetchTables();
      fetchResources();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleAddTable = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading(isEditing ? 'Updating table...' : 'Adding table...');
    try {
      if (isEditing) {
        await api.put(`/tables/${selectedTable._id}`, {
          tableNumber: Number(newTableNumber),
          tableName: newTableName,
          capacity: Number(newTableCapacity)
        });
        toast.success('Table updated', { id: loadToast });
      } else {
        await api.post('/tables', {
          tableNumber: Number(newTableNumber),
          tableName: newTableName,
          capacity: Number(newTableCapacity),
          locationId: user.assignedLocation?._id
        });
        toast.success('Table added', { id: loadToast });
      }
      setShowAddModal(false);
      setIsEditing(false);
      setNewTableNumber('');
      setNewTableName('');
      setNewTableCapacity('1');
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error', { id: loadToast });
    }
  };

  const handleEditTable = (table) => {
    setSelectedTable(table);
    setNewTableNumber(table.tableNumber);
    setNewTableName(table.tableName || '');
    setNewTableCapacity(table.capacity || '1');
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleBookTable = (table) => {
    setSelectedTable(table);
    setIsAssignModalOpen(true);
  };

  const handleAssignConfirm = async (data) => {
    const loadToast = toast.loading('Booking table...');
    try {
      await api.put(`/tables/${selectedTable._id}/book`, {
        numberOfPeople: Number(data.numberOfPeople),
        customerName: data.customerName
      });
      fetchTables();
      toast.success('Table booked', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Booking error', { id: loadToast });
    }
  };

  const handleOpenOrder = (table) => {
    setSelectedTable(table);
    setPendingOrders([...table.orders]); // Load existing orders into staging
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCode('');
    setShowOrderModal(true);
  };

  const handleStageOrder = (e) => {
    e.preventDefault();
    if (!orderItem.itemName || !orderItem.price) return toast.error('Name & Price required');

    const newItem = {
      ...orderItem,
      quantity: Number(orderItem.quantity),
      price: Number(orderItem.price),
      menuItemId: orderItem.menuItemId || null,
      categoryId: orderItem.categoryId || null
    };

    setPendingOrders(prev => [...prev, newItem]);
    setOrderItem({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' });
    setShowMenuGrid(false);
    toast.success('Added to order');
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const loadToast = toast.loading('Checking coupon...');
    try {
      const subtotal = pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0);
      const res = await api.post('/coupons/apply', {
        code: couponCode.toUpperCase(),
        orderAmount: subtotal,
        orderItems: pendingOrders.map(item => ({
          menuItemId: item.menuItemId,
          categoryId: item.categoryId,
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
    const newOrders = [...pendingOrders];
    const item = { ...newOrders[idx] };
    if (item.quantity + delta > 0) {
      item.quantity += delta;
      newOrders[idx] = item;
      setPendingOrders(newOrders);
      handleSyncOrders(newOrders);
    }
  };

  const handleRemoveStagedItem = (idx) => {
    const newOrders = pendingOrders.filter((_, i) => i !== idx);
    setPendingOrders(newOrders);
    handleSyncOrders(newOrders);
  };

  const handleSyncOrders = async (ordersToSync) => {
    try {
      const res = await api.put(`/tables/${selectedTable._id}/orders`, { orders: ordersToSync });
      setSelectedTable(res.data.data);
      fetchTables();
    } catch (error) {
      toast.error('Auto-sync failed');
    }
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
    const loadToast = toast.loading('Generating bill...');
    const data = new FormData();
    data.append('billImage', file);
    try {
      await api.put(`/tables/${selectedTable._id}/bill`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsBillPreviewOpen(false);
      setShowOrderModal(false);
      setSelectedTable(null);
      fetchTables();
      toast.success('Bill generated and saved', { id: loadToast });
    } catch (error) {
      toast.error('Bill generation failed', { id: loadToast });
    }
  };

  const stats = {
    total: tables.length,
    occupied: tables.filter(t => t.status !== 'available').length,
    revenue: tables.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0)
  };



  const handleDeleteTable = async () => {
    const loadToast = toast.loading('Deleting table...');
    try {
      await api.delete(`/tables/${showDeleteConfirm}`);
      fetchTables();
      toast.success('Table removed', { id: loadToast });
    } catch (error) {
      toast.error('Error', { id: loadToast });
    }
  };

  if (loading) return (
    <div className="space-y-6 p-4">
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <Globe size={20} className="text-[var(--color-primary)]" />
              </div>
              {user?.assignedLocation?.name || 'Tables'}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">Manage tables and orders</p>
          </div>
          <Button
            variant="primary"
            className="!rounded-xl !py-2.5 px-5 shadow-lg  whitespace-nowrap self-start sm:self-auto"
            icon={Plus}
            onClick={() => {
              setIsEditing(false);
              setNewTableNumber('');
              setNewTableName('');
              setNewTableCapacity('1');
              setShowAddModal(true);
            }}
          >
            Add Table
          </Button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Tables', val: stats.total, color: 'amber', icon: Globe },
            { label: 'Occupied', val: stats.occupied, color: 'amber', icon: Zap },
            { label: "Today's Revenue", val: `₹${stats.revenue.toLocaleString()}`, color: 'emerald', icon: Receipt }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.05}>
              <div className="glass-morphism rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl ${toneSoft(stat.color)} flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={toneText(stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] leading-none">{stat.val}</p>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-0.5">{stat.label}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Table Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <AnimatePresence mode='popLayout'>
            {tables.map((table, i) => {
              const isAvailable = table.status === 'available';
              const isBooked = table.status === 'booked';
              const statusColor = isAvailable ? 'emerald' : isBooked ? 'amber' : 'rose';
              const statusLabel = isAvailable ? 'Available' : isBooked ? 'Occupied' : 'Reserved';

              return (
                <SlideIn key={table._id} delay={i * 0.02} direction="up">
                  <div
                    className={`relative group rounded-xl border-2 overflow-hidden transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg
                        ${isAvailable
                        ? 'border-[var(--color-border)] dark:border-[var(--color-border)] hover:border-[var(--color-success)]/60 hover:'
                        : isBooked
                          ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/70 hover:'
                          : 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 hover:border-[var(--color-danger)]/70 hover:'
                      } bg-[var(--color-surface)] dark:bg-[var(--color-surface)]`}
                    onClick={() => isAvailable ? handleBookTable(table) : handleOpenOrder(table)}
                  >
                    {/* Status stripe */}
                    <div className={`h-1 w-full ${toneBg(statusColor)} ${isBooked ? 'animate-pulse' : ''}`} />

                    <div className="p-4 flex flex-col items-center gap-2">
                      {/* Table number */}
                      <div className="relative mt-1">
                        <span className="text-5xl font-bold tracking-tight text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] leading-none">
                          {table.tableNumber}
                        </span>
                        <span className="absolute -top-1 -right-3 text-[9px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] px-1 rounded">T</span>
                      </div>

                      {/* Table Name */}
                      {table.tableName && (
                        <span className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-tight -mt-1">{table.tableName}</span>
                      )}

                      {/* Capacity */}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)]">
                        <Users size={10} className="text-[var(--color-text-muted)]" />
                        <span>{table.capacity || 1} Seater</span>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[9px] font-bold uppercase tracking-normal px-2.5 py-1 rounded-full ${toneSoft(statusColor)} ${toneText(statusColor)}`}>
                        {statusLabel}
                      </span>

                      {/* Revenue */}
                      {isBooked && table.totalAmount > 0 && (
                        <span className="text-sm font-bold text-[var(--color-primary)]">₹{Number(table.totalAmount).toLocaleString()}</span>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                          className="h-8 w-8 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 transition-all text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(table._id); }}
                          className="h-8 w-8 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-danger)]/50 hover:bg-[var(--color-danger)]/5 transition-all text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </SlideIn>
              );
            })}
          </AnimatePresence>
        </div>

        {tables.length === 0 && (
          <div className="text-center py-16 glass-morphism rounded-xl border border-dashed border-[var(--color-border)] dark:border-[var(--color-border)]">
            <Globe size={36} className="mx-auto text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mb-3" strokeWidth={1.5} />
            <p className="text-[var(--color-text-muted)] font-bold text-sm">No tables found</p>
          </div>
        )}

        {/* Modals */}
        <AssignTableModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          onConfirm={handleAssignConfirm}
          table={selectedTable}
        />



        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title={isEditing ? 'Edit Table' : 'Add New Table'}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddTable} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Table Number</label>
              <input
                required
                type="number"
                className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] p-5 text-sm font-bold dark:text-[var(--color-text-primary)] outline-none transition-all"
                value={newTableNumber}
                onChange={e => setNewTableNumber(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Table Name (Optional)</label>
              <input
                type="text"
                className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] p-5 text-sm font-bold dark:text-[var(--color-text-primary)] outline-none transition-all"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="e.g. Window Corner"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Seating Capacity</label>
              <input
                required
                type="number"
                min="1"
                className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] p-5 text-sm font-bold dark:text-[var(--color-text-primary)] outline-none transition-all"
                value={newTableCapacity}
                onChange={e => setNewTableCapacity(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-xl !py-5 shadow-sm "
              icon={isEditing ? Edit3 : Plus}
            >
              {isEditing ? 'Update Table' : 'Add Table'}
            </Button>
          </form>
        </Modal>

        <Modal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title={`Table: ${selectedTable?.tableNumber}${selectedTable?.tableName ? ` — ${selectedTable.tableName}` : ''}`}
          maxWidth="max-w-7xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
              {/* Left Side: Active Registry (Order Summary) */}
              <div className="lg:col-span-5 flex flex-col h-full bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)]/30 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] overflow-hidden">
                <div className="p-6 border-b border-[var(--color-border)] dark:border-[var(--color-border)] flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center">
                    <ShoppingBag size={14} className="mr-2 text-[var(--color-primary)]" /> Current Order
                  </h3>
                  <span className="text-[10px] font-bold bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] text-[var(--color-text-muted)] px-3 py-1 rounded-full uppercase tracking-normal">
                    {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)} Items
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {pendingOrders.map((order, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={`${order.menuItemId || order.itemName}-${idx}`}
                      className="flex justify-between items-center bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] group hover:border-[var(--color-primary)]/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] flex-shrink-0 overflow-hidden relative border border-[var(--color-border)] dark:border-[var(--color-border)]">
                          {order.image ? (
                            <img src={order.image} alt={order.itemName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[var(--color-text-muted)]">
                              <Coffee size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] line-clamp-1">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-[var(--color-text-muted)] tracking-normal uppercase mt-0.5">₹{Number(order.price).toLocaleString()} / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-bold text-[var(--color-primary)] w-16 text-right">
                          ₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleRemoveStagedItem(idx)}
                          className="h-6 w-6 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] flex items-center justify-center hover:bg-[var(--color-danger)] hover:text-white transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {pendingOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Order is Empty</p>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-[var(--color-border)] dark:border-[var(--color-border)] bg-white/50 dark:bg-[var(--color-surface)]/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                      <span>Subtotal</span>
                      <span>₹{pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-normal text-[var(--color-success)]">
                        <span>Discount</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal mb-2">Grand Total</span>
                      <span className="text-4xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight">
                        ₹{Math.max(0,
                          pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full">
                    <Button
                      variant="primary"
                      className="w-full !rounded-xl !py-4 shadow-sm  bg-[var(--color-success)] hover:bg-[var(--color-success)] text-[10px] font-bold uppercase tracking-normal"
                      icon={Receipt}
                      onClick={() => setIsBillPreviewOpen(true)}
                    >
                      Print Bill & Checkout
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Side: Menu Selection & Discovery */}
              <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-6">
                {/* Search & Top Filters */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search menu..."
                    className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] pl-12 pr-4 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all dark:text-white"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {/* Most Selling / Recommendations */}
                {!menuSearch && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center">
                      <Zap size={12} className="mr-2 text-[var(--color-primary)]" /> Best Sellers
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => (
                        <div
                          key={item._id}
                          className="flex-shrink-0 w-40 glass-morphism rounded-xl p-4 border border-[var(--color-border)] dark:border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all cursor-pointer group"
                          onClick={() => {
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
                          <div className="h-20 w-full rounded-xl overflow-hidden mb-3 bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] relative">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[var(--color-text-muted)]"><Coffee size={24} /></div>
                            )}
                            <div className="absolute top-2 left-2">
                               <div className={`w-3 h-3 rounded-full border-2 border-[var(--color-border)] dark:border-[var(--color-border)] ${item.dietaryType === 'veg' ? 'bg-[var(--color-success)] ' : 'bg-[var(--color-danger)] '}`} />
                            </div>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <Plus className="text-white" size={24} />
                            </div>
                          </div>
                          <div className="text-[10px] font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] truncate">{item.name}</div>
                          <div className="text-[10px] font-bold text-[var(--color-primary)] mt-1">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Menu Grid */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">All Items</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {menuItems
                      .filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()))
                      .map((item) => (
                        <div
                          key={item._id}
                          onClick={() => {
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
                          className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)]/50 p-3 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] hover:border-[var(--color-primary)]/20 transition-all cursor-pointer flex items-center gap-3 group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] flex-shrink-0 overflow-hidden relative">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[var(--color-text-muted)]">
                                <Coffee size={14} />
                              </div>
                            )}
                            <div className="absolute top-1 left-1">
                               <div className={`w-2 h-2 rounded-full border border-[var(--color-border)] dark:border-[var(--color-border)] ${item.dietaryType === 'veg' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] leading-tight truncate">{item.name}</div>
                            <div className="text-[10px] font-bold text-[var(--color-primary)] mt-0.5">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                          </div>
                          <div className="h-6 w-6 rounded-lg bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition-all">
                            <Plus size={12} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Coupon Panel */}
                <div className="p-6 bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)]/30 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Apply Coupon</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          className="flex-1 bg-[var(--color-surface)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all dark:text-white"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-xl text-[10px] font-bold uppercase tracking-normal hover:bg-[var(--color-primary-hover)] transition-all"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                    {appliedCoupon && (
                      <div className="mt-4 p-3 bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-xl text-[10px] font-bold text-[var(--color-success)] flex items-center gap-2">
                        <Check size={12} /> {appliedCoupon.code} Activated
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDeleteTable}
          title="Delete Table?"
          message="This table will be removed from the system."
        />

        <BillPreview
          isOpen={isBillPreviewOpen}
          onClose={() => setIsBillPreviewOpen(false)}
          onComplete={handleFinalizeSession}
          table={selectedTable}
        />
      </div>
    </PageTransition>
  );
}
