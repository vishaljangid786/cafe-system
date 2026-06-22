"use client"
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2, Search, Globe, ShieldAlert, MessageSquare, RefreshCcw } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import TableCard from '../../../components/tables/TableCard';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { toneText, toneBg, toneSoft, toneBorder } from '../../../components/ui/tone';
import { Button } from '@/app/components/ui/Button';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';

export default function TablesPage() {
  const { user, socket } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [systemOrders, setSystemOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all'); // all, available, occupied
  const syncTimeoutRef = useRef(null);
  const selectedTableRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const fetchTables = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      progress.start();
    }
    try {
      const res = await api.get('/tables');
      setTables(res.data.data);
    } catch (error) {
      toast.error('Could not load tables. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      if (!silent) progress.done();
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTables();
  };

  const fetchSystemOrders = async (tableId) => {
    try {
      const res = await api.get(`/orders?tableId=${tableId}&isBilled=false`);
      setSystemOrders(res.data.data);
    } catch (error) {
      console.error('Failed to fetch system orders');
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
        console.error("List sync failed");
      }
    };
    const timer = setTimeout(() => {
      fetchTables();
      fetchResources();
    }, 0);

    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (socket && user?.assignedLocation) {
      const branchId = user.assignedLocation._id || user.assignedLocation;
      socket.emit('join_room', `branch_${branchId}`);
      socket.emit('join_room', `branch_${branchId}_admin`);

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
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
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
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
    }
  };

  const handleOpenOrder = (table) => {
    setSelectedTable(table);
    setPendingOrders([...table.orders]); // Load existing orders into staging
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCode('');
    fetchSystemOrders(table._id);
    setShowOrderModal(true);
  };

  const handleStageOrder = (e) => {
    e.preventDefault();
    if (!orderItem.itemName || !orderItem.price) return toast.error('Item name and price are required');

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

  const handleApplyCoupon = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add items before applying coupon');
    if (!couponCode) return;
    const loadToast = toast.loading('Checking coupon code...');
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
      toast.error(error.response?.data?.message || 'Invalid coupon code', { id: loadToast });
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

  const handleRemoveStagedItem = (idx) => {
    if (appliedCoupon) return toast.error('Remove coupon to modify order');
    const newOrders = pendingOrders.filter((_, i) => i !== idx);
    setPendingOrders(newOrders);
    handleSyncOrders(newOrders);
  };

  const handleSyncOrders = async (ordersToSync, extra = {}) => {
    // Update local state immediately
    setSelectedTable(prev => ({ ...prev, ...extra }));
    if (ordersToSync) setPendingOrders(ordersToSync);

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
        console.error('Sync failed', error);
      }
    }, 800);
  };

  const handleSendToKitchen = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add items before sending to kitchen');
    if (!selectedTable.customerName) return toast.error('Guest name is required');

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
        discountAmount: discountAmount || 0,
        couponId: appliedCoupon?.couponId || null
      };

      await api.post('/orders', payload);
      await api.put(`/tables/${selectedTable._id}/orders`, { orders: [] });
      
      setPendingOrders([]);
      fetchTables();
      fetchSystemOrders(selectedTable._id);
      toast.success('Order sent to kitchen', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
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
      toast.error('Remove failed', { id: loadToast });
    }
  };

  const handleFinalizeSession = async (file, finalTotal) => {
    const loadToast = toast.loading('Saving bill...');
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
      toast.success('Bill saved', { id: loadToast });
    } catch (error) {
      toast.error('Could not save the bill. Please try again.', { id: loadToast });
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
      toast.success('Table deleted', { id: loadToast });
    } catch (error) {
      toast.error('Something went wrong. Please try again.', { id: loadToast });
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg ">
                <Globe size={24} className="text-white" />
              </div>
              Tables
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-medium ml-13">Manage your tables and live orders</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] p-1 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)]">
              {['all', 'available', 'occupied'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-normal transition-all ${
                    statusFilter === f 
                      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg ' 
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="h-12 w-px bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] mx-2 hidden sm:block" />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all border border-[var(--color-border)] dark:border-[var(--color-border)] disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-12 w-px bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] mx-2 hidden sm:block" />
            <Button 
              variant="primary" 
              className="!rounded-xl !py-4 shadow-sm  bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal"
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
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40  shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]/50">
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Table Info</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Status</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Capacity</th>
                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode='popLayout'>
                {tables
                  .filter(t => {
                    if (statusFilter === 'available') return t.status === 'available';
                    if (statusFilter === 'occupied') return t.status !== 'available';
                    return true;
                  })
                  .map((table, i) => (
                    <motion.tr 
                      key={table._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="group border-b border-[var(--color-border)] hover:bg-[var(--color-primary)]/5 transition-all cursor-pointer"
                    >
                      <td className="px-8 py-6" onClick={() => handleOpenOrder(table)}>
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold border group- transition-transform ${
                            table.status === 'available' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'
                          }`}>
                            T{table.tableNumber}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--color-text-primary)]">{table.tableName || `Table ${table.tableNumber}`}</p>
                            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-0.5">ID: {table._id.slice(-6).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6" onClick={() => handleOpenOrder(table)}>
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-normal border shadow-sm ${
                          table.status === 'available' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${table.status === 'available' ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-primary)]'}`} />
                          {table.status}
                        </div>
                      </td>
                      <td className="px-8 py-6" onClick={() => handleOpenOrder(table)}>
                        <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                          <Users size={14} className="text-[var(--color-text-muted)]" />
                          <span className="text-sm font-bold">{table.capacity} Guests</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 transition-opacity">
                          {table.status === 'available' ? (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleBookTable(table); }}
                              className="p-2.5 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] hover:text-white transition-all"
                            >
                              <Check size={18} />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleOpenOrder(table); }}
                              className="p-2.5 rounded-xl bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 hover:bg-[var(--color-success)] hover:text-white transition-all"
                            >
                              <ShoppingBag size={18} />
                            </motion.button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                            className="p-2.5 rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] dark:border-[var(--color-border)] hover:text-[var(--color-primary)] transition-all"
                          >
                            <Edit3 size={18} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(table._id); }}
                            className="p-2.5 rounded-xl bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20 hover:bg-[var(--color-danger)] hover:text-white transition-all"
                          >
                            <Trash2 size={18} />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
              </AnimatePresence>
            </tbody>
          </table>
          {tables.length === 0 && (
            <div className="p-20 text-center text-[var(--color-text-muted)]">
              <Globe size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-normal">No tables found</p>
            </div>
          )}
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
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Table Name</label>
              <input
                type="text"
                className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] p-5 text-sm font-bold dark:text-[var(--color-text-primary)] outline-none transition-all"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="e.g. Window Corner, Poolside-1"
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
          title={`Order: T${selectedTable?.tableNumber}${selectedTable?.tableName ? ` — ${selectedTable.tableName}` : ''}`}
          maxWidth="max-w-7xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
              {/* Left Side: Active Registry (Order Summary) */}
              <div className="lg:col-span-5 flex flex-col h-full bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)]/30 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] overflow-hidden">
                <div className="p-8 border-b border-[var(--color-border)] dark:border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface)]/50 to-white dark:from-[var(--color-surface)]/50 dark:to-[var(--color-surface)]/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-normal flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Order Details
                      </h3>
                      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Current Order</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight">
                        {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)}
                      </span>
                      <span className="text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Items Added</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 p-5 bg-[var(--color-surface)] dark:bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1 flex items-center gap-2">
                        Guest Name <span className="text-[var(--color-danger)] font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="Enter name"
                        className="w-full bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] rounded-xl px-4 py-4 mt-1 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all placeholder:text-[var(--color-text-muted)] dark:text-white"
                        value={selectedTable.customerName || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <PremiumSelect
                        label="Number of Guests"
                        placeholder="Select guests"
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

                  {pendingOrders.length === 0 && systemOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 py-20">
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-[var(--color-text-muted)]" />
                      <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">No items added yet</p>
                    </div>
                  )}

                  {/* System Orders Section (OMS) */}
                  {(systemOrders.length > 0 || pendingOrders.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-[var(--color-border)] dark:border-[var(--color-border)]">
                      <h3 className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-normal mb-4 flex items-center gap-2">
                        <Zap size={14} /> Kitchen Queue
                      </h3>
                      <div className="space-y-3">
                        {systemOrders.length > 0 ? (
                          systemOrders.map((order) => (
                            <div key={order._id} className="bg-[var(--color-surface)] dark:bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)] dark:border-[var(--color-border)] flex items-center justify-between group shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${order.status === 'COMPLETED' ? 'bg-[var(--color-success)] ' : 'bg-[var(--color-primary)] animate-pulse'}`} />
                                <div>
                                  <div className="text-[11px] font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] uppercase tracking-tight">#{order._id.slice(-6)}</div>
                                  <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">{order.status}</div>
                                </div>
                              </div>
                              
                              {/* Chef Note Display */}
                              {order.chefNote && (
                                <div className="flex-1 mx-4 px-3 py-2 bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 rounded-xl flex items-center gap-2 group/note relative">
                                  <MessageSquare size={12} className="text-[var(--color-primary)] flex-shrink-0" />
                                  <p className="text-[9px] font-bold text-[var(--color-primary)] dark:text-[var(--color-primary)] leading-tight line-clamp-1">{order.chefNote}</p>
                                  
                                  {/* Hover expansion */}
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-[var(--color-text-primary)] text-[var(--color-surface)] text-[10px] font-medium rounded-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-sm">
                                    {order.chefNote}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-[var(--color-border-strong)]" />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="text-[10px] font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)]">₹{Number(order.totalAmount).toLocaleString()}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-[9px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">No orders in the kitchen</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-[var(--color-border)] dark:border-[var(--color-border)] bg-white/50 dark:bg-[var(--color-surface)]/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                      <span>Subtotal</span>
                      <span>₹{systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-normal text-[var(--color-success)]">
                        <span>Discount</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-[var(--color-surface-soft)] dark:bg-[var(--color-surface)] my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-normal mb-2">Total</span>
                      <span className="text-4xl font-bold text-[var(--color-text-primary)] dark:text-[var(--color-text-primary)] tracking-tight">
                        ₹{Math.max(0,
                          systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className={`grid ${systemOrders.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <Button
                      variant="primary"
                      className="w-full !rounded-xl !py-4 shadow-sm  bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-[10px] font-bold uppercase tracking-normal"
                      icon={Zap}
                      onClick={handleSendToKitchen}
                      disabled={pendingOrders.length === 0}
                    >
                      Send to Kitchen
                    </Button>
                    {systemOrders.length > 0 && (
                      <Button
                        variant="primary"
                        className="w-full !rounded-xl !py-4 shadow-sm  bg-[var(--color-success)] hover:bg-[var(--color-success)] text-[10px] font-bold uppercase tracking-normal"
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
                    placeholder="Search the menu..."
                    className="w-full rounded-xl bg-[var(--color-surface-soft)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] pl-12 pr-4 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all dark:text-white"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {/* Most Selling / Recommendations */}
                {!menuSearch && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal flex items-center">
                      <Zap size={12} className="mr-2 text-[var(--color-primary)]" /> Best Selling Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => (
                        <div
                          key={item._id}
                          className="flex-shrink-0 w-40 glass-morphism rounded-xl p-4 border border-[var(--color-border)] dark:border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all cursor-pointer group"
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
                  <h3 className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal">Full Menu</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {menuItems
                      .filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()))
                      .map((item) => (
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
                      <label className="block text-[8px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mb-2 ml-1">Apply Coupon Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter code"
                          className="flex-1 bg-[var(--color-surface)] dark:bg-[var(--color-bg)] border border-[var(--color-border)] dark:border-[var(--color-border)] rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all dark:text-white"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-xl text-[10px] font-bold uppercase tracking-normal hover:bg-[var(--color-primary-hover)] transition-all"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                    {appliedCoupon && (
                      <div className="mt-4 p-3 bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-xl text-[10px] font-bold text-[var(--color-success)] flex items-center justify-between gap-2">
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
                          className="text-[var(--color-danger)] hover:text-[var(--color-danger)] uppercase text-[9px] font-bold"
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

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDeleteTable}
          title="Delete Table?"
          message="This table will be permanently removed."
        />

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
