"use client"
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2, Search } from 'lucide-react';
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
        await api.put(`/tables/${selectedTable._id}`, { tableNumber: Number(newTableNumber) });
        toast.success('Table updated', { id: loadToast });
      } else {
        await api.post('/tables', { tableNumber: Number(newTableNumber), locationId: user.assignedLocation?._id });
        toast.success('Table initialized', { id: loadToast });
      }
      setShowAddModal(false);
      setIsEditing(false);
      setNewTableNumber('');
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    }
  };

  const handleEditTable = (table) => {
    setSelectedTable(table);
    setNewTableNumber(table.tableNumber);
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

  const handleRemoveStagedItem = (idx) => {
    setPendingOrders(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSyncOrders = async () => {
    const loadToast = toast.loading('Synchronizing with central matrix...');
    try {
      const res = await api.put(`/tables/${selectedTable._id}/orders`, { orders: pendingOrders });
      setSelectedTable(res.data.data);
      fetchTables();
      toast.success('Matrix synchronized', { id: loadToast });
    } catch (error) {
      toast.error('Sync protocol failure', { id: loadToast });
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
    <div className="space-y-8 p-8">
      <div className="h-40 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[3rem] animate-pulse border border-zinc-200 dark:border-zinc-800"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <div key={i} className="h-64 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] animate-pulse border border-zinc-200 dark:border-zinc-800"></div>)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Top Summary Bar */}
        <SlideIn direction="down">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-[3.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-8">
              <div>
                <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter flex items-center leading-none">
                  <Coffee className="mr-4 text-amber-600" size={40} /> Terminal <span className="ml-3 text-amber-600">Matrices</span>
                </h1>
                <p className="text-zinc-500 dark:text-zinc-500 text-[10px] mt-3 font-black uppercase tracking-[0.2em] ml-1">Live floor grid & operational command</p>
              </div>

              <div className="h-12 w-px bg-zinc-200 dark:bg-zinc-800 hidden lg:block" />

              <div className="flex flex-wrap gap-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Grid Nodes</span>
                  <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{stats.total}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Active</span>
                  <span className="text-2xl font-black text-rose-500">{stats.occupied}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Yield (Today)</span>
                  <span className="text-2xl font-black text-emerald-500">₹{stats.revenue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              className="!rounded-[2rem] !py-5 px-10 shadow-2xl shadow-amber-600/20"
              icon={Plus}
              onClick={() => {
                setIsEditing(false);
                setNewTableNumber('');
                setShowAddModal(true);
              }}
            >
              Initialize Node
            </Button>
          </div>
        </SlideIn>

        {/* Table Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
          <AnimatePresence mode="popLayout">
            {tables.map((table, i) => (
              <SlideIn key={table._id} delay={i * 0.03}>
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
          title={`Session Matrix: T${selectedTable?.tableNumber}`}
          maxWidth="max-w-5xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Left Side: Order Registry */}
              <div className="lg:col-span-7 space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center">
                    <ShoppingBag size={14} className="mr-2 text-amber-600" /> Active Registry
                  </h3>
                  <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full uppercase tracking-widest">
                    {selectedTable.orders?.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)} Units Synced
                  </span>
                </div>

                <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Combined Registry View */}
                  {selectedTable.orders.map((order, idx) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={`synced-${idx}`}
                      className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 group hover:border-amber-500/20 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 font-black text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase mt-0.5">{order.quantity} × ₹{Number(order.price).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-5">
                        <div className="text-sm font-black text-amber-600">₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}</div>
                        <button
                          onClick={() => handleRemoveOrderItem(idx)}
                          className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {pendingOrders.filter(p => !selectedTable.orders.find(s => s.itemName === p.itemName && s.price === p.price && s.quantity === p.quantity)).map((order, idx) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={`pending-${idx}`}
                      className="flex justify-between items-center bg-amber-500/5 p-5 rounded-[2rem] border border-dashed border-amber-500/20 group transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-black text-xs animate-pulse">
                          NEW
                        </div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-amber-600/60 tracking-widest uppercase mt-0.5">{order.quantity} × ₹{Number(order.price).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-5">
                        <div className="text-sm font-black text-amber-600">₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}</div>
                        <button
                          onClick={() => handleRemoveStagedItem(idx)}
                          className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {selectedTable.orders.length === 0 && pendingOrders.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[3rem] bg-zinc-50/50 dark:bg-zinc-950/30">
                      <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag size={24} className="text-zinc-300" />
                      </div>
                      <p className="text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">Operational Registry is Empty</p>
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800 space-y-6">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Aggregate Yield</span>
                      <span className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                        ₹{Math.max(0,
                          pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0) - Number(discountAmount || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      className="!rounded-[1.5rem] !py-4 px-10 shadow-xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                      icon={Receipt}
                      onClick={() => setIsBillPreviewOpen(true)}
                    >
                      Finalize & Bill
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Side: Control Panel */}
              <div className="lg:col-span-5 space-y-8 bg-zinc-50 dark:bg-zinc-950/30 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center">
                    <Plus size={14} className="mr-2 text-amber-600" /> Append Resource
                  </h3>

                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors">
                      <Search size={18} />
                    </div>
                    <input
                      type="text"
                      placeholder="Scan Menu Grid..."
                      className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 pl-12 pr-4 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                      value={menuSearch}
                      onChange={(e) => { setMenuSearch(e.target.value); setShowMenuGrid(true); }}
                      onFocus={() => setShowMenuGrid(true)}
                    />
                    <AnimatePresence>
                      {showMenuGrid && menuSearch && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar"
                        >
                          {menuItems.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                            <div
                              key={item._id}
                              onClick={() => {
                                setOrderItem({
                                  itemName: item.name,
                                  price: Number(item.discountedPrice || item.price),
                                  costPrice: Number(item.costPrice || 0),
                                  quantity: 1,
                                  menuItemId: item._id,
                                  categoryId: item.category?._id || item.category
                                });
                                setMenuSearch('');
                                setShowMenuGrid(false);
                              }}
                              className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0 flex justify-between items-center"
                            >
                              <div className="flex items-center gap-3">
                                {item.image ? (
                                  <img src={item.image} className="w-10 h-10 rounded-xl object-cover border border-zinc-100 dark:border-zinc-800" />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                    <Coffee size={16} />
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{item.category?.name}</div>
                                </div>
                              </div>
                              <div className="text-xs font-black text-amber-600">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <form onSubmit={handleStageOrder} className="space-y-4">
                    {orderItem.itemName && (
                      <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Active Selection</span>
                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{orderItem.itemName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOrderItem({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' })}
                          className="text-[10px] font-black text-rose-500 uppercase hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Units</label>
                        <input
                          required
                          type="number"
                          min="1"
                          className="w-full rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-bold dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                          value={orderItem.quantity}
                          onChange={e => setOrderItem({ ...orderItem, quantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest ml-1">Yield (₹)</label>
                        <input
                          required
                          type="number"
                          className="w-full rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-bold dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                          value={orderItem.price}
                          onChange={e => setOrderItem({ ...orderItem, price: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full !rounded-xl !py-4 text-[10px] font-black uppercase tracking-widest"
                      icon={Plus}
                    >
                      Stage Item
                    </Button>
                  </form>

                  <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
                    <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
                      <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-3">Offer Protocol</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="CODE"
                          className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-amber-500/20"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-6 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                        >
                          Apply
                        </button>
                      </div>
                      {appliedCoupon && (
                        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-emerald-500 flex justify-between items-center">
                          <span className="flex items-center gap-2"><Check size={12} /> PROMO: {appliedCoupon.code}</span>
                          <span>-₹{appliedCoupon.discount}</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleSyncOrders}
                      className="w-full !rounded-2xl !py-5 shadow-xl shadow-blue-500/10 bg-blue-600 hover:bg-blue-700"
                      variant="primary"
                      icon={Zap}
                    >
                      Synchronize Matrix
                    </Button>
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
