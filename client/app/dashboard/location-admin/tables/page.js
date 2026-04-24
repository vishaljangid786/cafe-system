"use client"
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2, Search, Globe, ShieldAlert } from 'lucide-react';
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
      toast.error('Failed to sync floor plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    const fetchResources = async () => {
      try {
        const [menuRes, couponRes] = await Promise.all([
          api.get('/menu'),
          api.get('/coupons?active=true')
        ]);
        setMenuItems(menuRes.data.data);
        setCoupons(couponRes.data.data);
      } catch (error) {
        console.error("Matrix sync failed");
      }
    };
    fetchResources();
  }, []);

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
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
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
    setShowOrderModal(true);
  };

  const handleStageOrder = (e) => {
    e.preventDefault();
    if (!orderItem.itemName || !orderItem.price) return toast.error('Designation & Yield required');

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
    toast.success('Added to local staging');
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const loadToast = toast.loading('Validating offer code...');
    try {
      const subtotal = pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0);
      const res = await api.post('/coupons/apply', {
        code: couponCode,
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
      toast.success('Offer code applied', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid offer code', { id: loadToast });
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
      toast.success('Item purged', { id: loadToast });
    } catch (error) {
      toast.error('Purge failed', { id: loadToast });
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
      toast.success('Session archived to ledger', { id: loadToast });
    } catch (error) {
      toast.error('Archival protocol failed', { id: loadToast });
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
      toast.success('Table liquidated', { id: loadToast });
    } catch (error) {
      toast.error('Protocol error', { id: loadToast });
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Globe size={20} className="text-amber-500" />
              </div>
              {user?.assignedLocation?.name || 'Tables'}
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">Operational command — floor management</p>
          </div>
          <Button
            variant="primary"
            className="!rounded-xl !py-2.5 px-5 shadow-lg shadow-amber-500/20 whitespace-nowrap self-start sm:self-auto"
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
                    className={`relative group rounded-2xl border-2 overflow-hidden transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-lg
                        ${isAvailable
                        ? 'border-zinc-200 dark:border-zinc-700 hover:border-emerald-400/60 hover:shadow-emerald-500/10'
                        : isBooked
                          ? 'border-amber-400/40 bg-amber-500/5 hover:border-amber-500/70 hover:shadow-amber-500/10'
                          : 'border-rose-400/40 bg-rose-500/5 hover:border-rose-500/70 hover:shadow-rose-500/10'
                      } bg-white dark:bg-zinc-900`}
                    onClick={() => isAvailable ? handleBookTable(table) : handleOpenOrder(table)}
                  >
                    {/* Status stripe */}
                    <div className={`h-1 w-full bg-${statusColor}-500 ${isBooked ? 'animate-pulse' : ''}`} />

                    <div className="p-4 flex flex-col items-center gap-2">
                      {/* Table number */}
                      <div className="relative mt-1">
                        <span className="text-5xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100 leading-none">
                          {table.tableNumber}
                        </span>
                        <span className="absolute -top-1 -right-3 text-[9px] font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">T</span>
                      </div>

                      {/* Table Name */}
                      {table.tableName && (
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-tight -mt-1">{table.tableName}</span>
                      )}

                      {/* Capacity */}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
                        <Users size={10} className="text-zinc-400" />
                        <span>{table.capacity || 1} Seater</span>
                      </div>

                      {/* Status badge */}
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-${statusColor}-500/10 text-${statusColor}-600 dark:text-${statusColor}-400`}>
                        {statusLabel}
                      </span>

                      {/* Revenue */}
                      {isBooked && table.totalAmount > 0 && (
                        <span className="text-sm font-black text-amber-600">₹{Number(table.totalAmount).toLocaleString()}</span>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                          className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-zinc-400 hover:text-amber-500"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(table._id); }}
                          className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:border-rose-500/50 hover:bg-rose-500/5 transition-all text-zinc-400 hover:text-rose-500"
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
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Table Protocol Number</label>
              <input
                required
                type="number"
                className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all"
                value={newTableNumber}
                onChange={e => setNewTableNumber(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Table Name / Designation</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all"
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
                className="w-full rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all"
                value={newTableCapacity}
                onChange={e => setNewTableCapacity(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-2xl !py-5 shadow-xl shadow-amber-600/20"
              icon={isEditing ? Edit3 : Plus}
            >
              {isEditing ? 'Update Configuration' : 'Confirm Initialization'}
            </Button>
          </form>
        </Modal>

        <Modal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title={`Session Matrix: T${selectedTable?.tableNumber}${selectedTable?.tableName ? ` — ${selectedTable.tableName}` : ''}`}
          maxWidth="max-w-7xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
              {/* Left Side: Active Registry (Order Summary) */}
              <div className="lg:col-span-5 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950/30 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center">
                    <ShoppingBag size={14} className="mr-2 text-amber-600" /> Active Registry
                  </h3>
                  <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full uppercase tracking-widest">
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
                      className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-amber-500/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative border border-zinc-200 dark:border-zinc-700">
                          {order.image ? (
                            <img src={order.image} className="h-full w-full object-cover" />
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

                  {pendingOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Registry is Empty</p>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <span>Subtotal</span>
                      <span>₹{pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                        <span>Discount</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Grand Total</span>
                      <span className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                        ₹{Math.max(0,
                          pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full">
                    <Button
                      variant="primary"
                      className="w-full !rounded-2xl !py-4 shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-black uppercase tracking-widest"
                      icon={Receipt}
                      onClick={() => setIsBillPreviewOpen(true)}
                    >
                      Finalize & Bill
                    </Button>
                  </div>
                </div>
              </div>

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
                            <div className="absolute top-2 left-2">
                               <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${item.dietaryType === 'veg' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                            </div>
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
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Full Menu Grid</h3>
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
                          className="bg-white dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-amber-500/20 transition-all cursor-pointer flex items-center gap-3 group"
                        >
                          <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                            {item.image ? (
                              <img src={item.image} className="h-full w-full object-cover" />
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
                            <div className="text-[10px] font-bold text-amber-600 mt-0.5">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                          </div>
                          <div className="h-6 w-6 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
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
                      <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-emerald-500 flex items-center gap-2">
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
          title="Decommission Table?"
          message="This table will be permanently removed from the floor grid."
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
