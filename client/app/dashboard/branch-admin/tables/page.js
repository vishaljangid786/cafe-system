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
import { Button } from '@/app/components/ui/Button';

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
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/tables');
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
    const loadToast = toast.loading(isEditing ? 'Updating table...' : 'Initializing table...');
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
        toast.success('Table initialized', { id: loadToast });
      }
      setShowAddModal(false);
      setIsEditing(false);
      setNewTableNumber('');
      setNewTableName('');
      setNewTableCapacity('1');
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'System Rule failure', { id: loadToast });
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
    const loadToast = toast.loading('Securing table...');
    try {
      await api.put(`/tables/${selectedTable._id}/book`, {
        numberOfPeople: Number(data.numberOfPeople),
        customerName: data.customerName
      });
      fetchTables();
      toast.success('Table secured', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Encryption error', { id: loadToast });
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
    if (!orderItem.itemName || !orderItem.price) return toast.error('Designation & Yield required');

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
    toast.success('Added to local staging');
  };

  const handleApplyCoupon = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add items before applying coupon');
    if (!couponCode) return;
    const loadToast = toast.loading('Validating offer code...');
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
      toast.success('Offer code applied', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid offer code', { id: loadToast });
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
    if (pendingOrders.length === 0) return toast.error('No items staged for production');
    if (!selectedTable.customerName) return toast.error('Guest name required');

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
      await api.put(`/tables/${selectedTable._id}/orders`, { orders: [] });
      
      setPendingOrders([]);
      fetchTables();
      fetchSystemOrders(selectedTable._id);
      toast.success('Update Successful', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failure', { id: loadToast });
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
    const loadToast = toast.loading('Archiving session...');
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
      toast.success('Bill saved to history', { id: loadToast });
    } catch (error) {
      toast.error('Archival rule failed', { id: loadToast });
    }
  };

  const stats = {
    total: tables.length,
    occupied: tables.filter(t => t.status !== 'available').length,
    revenue: tables.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0)
  };



  const handleDeleteTable = async () => {
    const loadToast = toast.loading('Purging table...');
    try {
      await api.delete(`/tables/${showDeleteConfirm}`);
      fetchTables();
      toast.success('Table finished', { id: loadToast });
    } catch (error) {
      toast.error('System Rule error', { id: loadToast });
    }
  };

  if (loading) return (
    <div className="space-y-6 p-4">
      <div className="h-16 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <div key={i} className="h-36 bg-zinc-100 dark:bg-zinc-900 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Globe size={24} className="text-white" />
              </div>
              Branch Command Grid
            </h1>
            <p className="text-xs text-zinc-500 font-medium ml-13">Operational control & live session monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              {['all', 'available', 'occupied'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    statusFilter === f 
                      ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/20' 
                      : 'text-zinc-500 hover:text-blue-500'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 transition-all border border-zinc-200 dark:border-zinc-700 disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800 mx-2 hidden sm:block" />
            <Button 
              variant="primary" 
              className="!rounded-2xl !py-4 shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase tracking-[0.2em]"
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
        <div className="overflow-x-auto rounded-[2.5rem] border border-[var(--color-border)] bg-[var(--color-surface)]/40 backdrop-blur-3xl shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-soft)]/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Table Info</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">State</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Capacity</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] text-right">Actions</th>
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
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black border group-hover:scale-110 transition-transform ${
                            table.status === 'available' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          }`}>
                            T{table.tableNumber}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[var(--color-text-primary)]">{table.tableName || `Table ${table.tableNumber}`}</p>
                            <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5">ID: {table._id.slice(-6).toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6" onClick={() => handleOpenOrder(table)}>
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                          table.status === 'available' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${table.status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                          {table.status}
                        </div>
                      </td>
                      <td className="px-8 py-6" onClick={() => handleOpenOrder(table)}>
                        <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                          <Users size={14} className="text-zinc-500" />
                          <span className="text-sm font-bold">{table.capacity} Guests</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {table.status === 'available' ? (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleBookTable(table); }}
                              className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"
                            >
                              <Check size={18} />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleOpenOrder(table); }}
                              className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
                            >
                              <ShoppingBag size={18} />
                            </motion.button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                            className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 hover:text-blue-500 transition-all"
                          >
                            <Edit3 size={18} />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(table._id); }}
                            className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
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
            <div className="p-20 text-center text-zinc-500">
              <Globe size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">No tables discovered in this sector</p>
            </div>
          )}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-16 glass-morphism rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <Globe size={36} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" strokeWidth={1.5} />
            <p className="text-zinc-500 font-bold text-sm">No tables found</p>
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
          title={isEditing ? 'Refine Table Configuration' : 'Initialize New Table'}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddTable} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Table System Rule Number</label>
              <input
                required
                type="number"
                className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all"
                value={newTableNumber}
                onChange={e => setNewTableNumber(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Table Name / Designation</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="e.g. Window Corner, Poolside-1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Seating Capacity (Members)</label>
              <input
                required
                type="number"
                min="1"
                className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all"
                value={newTableCapacity}
                onChange={e => setNewTableCapacity(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-2xl !py-5 shadow-xl shadow-blue-600/20"
              icon={isEditing ? Edit3 : Plus}
            >
              {isEditing ? 'Update Configuration' : 'Confirm Initialization'}
            </Button>
          </form>
        </Modal>

        <Modal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title={`Session List: T${selectedTable?.tableNumber}${selectedTable?.tableName ? ` — ${selectedTable.tableName}` : ''}`}
          maxWidth="max-w-7xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
              {/* Left Side: Active Registry (Order Summary) */}
              <div className="lg:col-span-5 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950/30 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-br from-zinc-50/50 to-white dark:from-zinc-950/50 dark:to-zinc-900/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Session Details
                      </h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Order Registry</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                        {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)}
                      </span>
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Units Staged</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 p-5 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        Guest Name <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="ENTER NAME"
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl px-4 py-4 mt-1 text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-300 dark:text-white"
                        value={selectedTable.customerName || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <PremiumSelect
                        label="Table Party"
                        placeholder="Select Guests"
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
                      className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-blue-500/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative border border-zinc-200 dark:border-zinc-700">
                          {order.image ? (
                            <img src={order.image} alt={order.itemName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-zinc-300">
                              <Coffee size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 line-clamp-1">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase mt-0.5">₹{Number(order.price).toLocaleString()} / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-black text-zinc-900 dark:text-zinc-100">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-500 transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-black text-blue-600 w-16 text-right">
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
                      <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Zap size={14} /> Production Queue (OMS)
                      </h3>
                      <div className="space-y-3">
                        {systemOrders.length > 0 ? (
                          systemOrders.map((order) => (
                            <div key={order._id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-between group shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-blue-500 animate-pulse'}`} />
                                <div>
                                  <div className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">#{order._id.slice(-6)}</div>
                                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{order.status}</div>
                                </div>
                              </div>
                              
                              {/* Chef Note Display */}
                              {order.chefNote && (
                                <div className="flex-1 mx-4 px-3 py-2 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center gap-2 group/note relative">
                                  <MessageSquare size={12} className="text-blue-500 flex-shrink-0" />
                                  <p className="text-[9px] font-bold text-blue-700 dark:text-blue-400 leading-tight line-clamp-1">{order.chefNote}</p>
                                  
                                  {/* Hover expansion */}
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-zinc-900 text-white text-[10px] font-medium rounded-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    {order.chefNote}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-zinc-900" />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="text-[10px] font-black text-zinc-900 dark:text-zinc-100">₹{Number(order.totalAmount).toLocaleString()}</div>
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

                <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-4">
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
                      <span className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                        ₹{Math.max(0,
                          systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className={`grid ${systemOrders.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <Button
                      variant="primary"
                      className="w-full !rounded-2xl !py-4 shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-[10px] font-black uppercase tracking-widest"
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
                          if (!allReady) return toast.error('Culinary System Rule: All orders must be SERVED before finalization');
                          setIsBillPreviewOpen(true);
                        }}
                      >
                        Finalize & Bill
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Side: Menu Selection & Discovery */}
              <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-6">
                {/* Search & Top Filters */}
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search the menu list..."
                    className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 pl-12 pr-4 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {/* Most Selling / Recommendations */}
                {!menuSearch && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center">
                      <Zap size={12} className="mr-2 text-blue-500" /> Top Performing Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => (
                        <div
                          key={item._id}
                          className="flex-shrink-0 w-40 glass-morphism rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 hover:border-blue-500/30 transition-all cursor-pointer group"
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
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-zinc-300"><Coffee size={24} /></div>
                            )}
                            <div className="absolute top-2 left-2">
                               <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${item.dietaryType === 'veg' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                            </div>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <Plus className="text-white" size={24} />
                            </div>
                          </div>
                          <div className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 truncate">{item.name}</div>
                          <div className="text-[10px] font-bold text-blue-600 mt-1">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Menu Grid */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Full Menu Grid</h3>
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
                          className="bg-white dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-blue-500/20 transition-all cursor-pointer flex items-center gap-3 group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-zinc-300">
                                <Coffee size={14} />
                              </div>
                            )}
                            <div className="absolute top-1 left-1">
                               <div className={`w-2 h-2 rounded-full border border-white dark:border-zinc-900 ${item.dietaryType === 'veg' ? 'bg-green-500' : 'bg-red-500'}`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 leading-tight truncate">{item.name}</div>
                            <div className="text-[10px] font-bold text-blue-600 mt-0.5">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                          </div>
                          <div className="h-6 w-6 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Plus size={12} />
                          </div>
                        </div>
                      ))}
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
                          className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all dark:text-white"
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

        <ConfirmDialog
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDeleteTable}
          title="Decommission Table?"
          message="This table will be permanently removed from the floor grid."
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
