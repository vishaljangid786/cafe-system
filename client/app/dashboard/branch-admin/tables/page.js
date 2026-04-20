"use client"
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2 } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';

export default function TablesPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billFile, setBillFile] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [orderItem, setOrderItem] = useState({ itemName: '', quantity: 1, price: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenuGrid, setShowMenuGrid] = useState(false);

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

  const handleBookTable = async (id) => {
    const people = prompt('Establishment size (Number of people)?');
    if (!people) return;
    const loadToast = toast.loading('Securing table...');
    try {
      await api.put(`/tables/${id}/book`, { numberOfPeople: Number(people) });
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
      menuItemId: orderItem.menuItemId || null
    };
    
    setPendingOrders(prev => [...prev, newItem]);
    setOrderItem({ itemName: '', quantity: 1, price: '', menuItemId: '' });
    setShowMenuGrid(false);
    toast.success('Added to local staging');
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    const loadToast = toast.loading('Validating offer code...');
    try {
      const subtotal = pendingOrders.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
      const res = await api.post('/coupons/apply', {
        code: couponCode,
        orderAmount: subtotal,
        orderItems: pendingOrders.map(item => ({
          menuItemId: item.menuItemId,
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

  const handleUploadBill = async (e) => {
    e.preventDefault();
    if (!billFile) return toast.error('Scan is required');
    const loadToast = toast.loading('Archiving session...');
    const data = new FormData();
    data.append('billImage', billFile);
    try {
      await api.put(`/tables/${selectedTable._id}/bill`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowBillModal(false);
      setShowOrderModal(false);
      setBillFile(null);
      setSelectedTable(null);
      fetchTables();
      toast.success('Session archived to ledger', { id: loadToast });
    } catch (error) {
      toast.error('Archival protocol failed', { id: loadToast });
    }
  };

  const handleCompleteOrder = async () => {
    const loadToast = toast.loading('Finalizing transaction...');
    try {
      await api.put(`/tables/${showCompleteConfirm}/complete`);
      setShowOrderModal(false);
      setShowCompleteConfirm(null);
      setSelectedTable(null);
      fetchTables();
      toast.success('Session finalized', { id: loadToast });
    } catch (error) {
      toast.error('Billed failed', { id: loadToast });
    }
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
    <div className="space-y-8">
      <div className="h-40 bg-white dark:bg-zinc-900 rounded-[2.5rem] animate-pulse"></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {[1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="h-44 bg-white dark:bg-zinc-900 rounded-[2.5rem] animate-pulse"></div>)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 gap-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <Coffee className="mr-4 text-amber-600" size={36} /> Table <span className="ml-3 text-amber-600">Command</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-2 font-medium">Real-time floor grid and operational matrix.</p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsEditing(false);
                setNewTableNumber('');
                setShowAddModal(true);
              }}
              className="bg-zinc-900 dark:bg-amber-600 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition flex items-center shadow-2xl shadow-amber-600/10"
            >
              <Plus size={20} className="mr-3" strokeWidth={3} /> Initialize Table
            </motion.button>
          </div>
        </SlideIn>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {tables.map((table, i) => (
            <SlideIn key={table._id} delay={i * 0.05} direction="up">
              <CardHover>
                <div 
                  onClick={() => table.status !== 'available' && handleOpenOrder(table)}
                  className={`relative rounded-[2.5rem] shadow-sm border-2 p-8 flex flex-col items-center justify-center text-center h-48 transition-all duration-500 cursor-pointer overflow-hidden group ${
                    table.status === 'available' 
                      ? 'bg-white dark:bg-zinc-900 border-gray-50 dark:border-zinc-800 hover:border-green-500 dark:hover:border-green-500' 
                      : table.status === 'booked' 
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' 
                      : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
                  }`}
                >
                  <div className={`absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-[0.03] group-hover:opacity-10 transition-opacity ${
                    table.status === 'available' ? 'bg-green-500' : table.status === 'booked' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  
                  <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                    >
                      <Edit3 size={14} />
                    </button>
                    {table.status === 'available' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(table._id); }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  <h3 className="text-4xl font-black text-gray-900 dark:text-zinc-100 mb-3 tracking-tighter">T{table.tableNumber}</h3>
                  
                  <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-sm ${
                    table.status === 'available' ? 'bg-green-500 text-white' :
                    table.status === 'booked' ? 'bg-amber-500 text-white' :
                    table.status === 'ongoing' ? 'bg-red-500 text-white' :
                     'bg-blue-500 text-white'
                  }`}>
                    {table.status}
                  </span>
                  
                  <div className="mt-5 h-6">
                    {table.status === 'available' ? (
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        onClick={(e) => { e.stopPropagation(); handleBookTable(table._id); }}
                        className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest flex items-center"
                      >
                        <Zap size={12} className="mr-1 fill-current" /> Establish Session
                      </motion.button>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-gray-900 dark:text-zinc-100">₹{table.totalAmount?.toLocaleString()}</span>
                        <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Live Audit</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHover>
            </SlideIn>
          ))}
        </div>

        <Modal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)} 
          title={isEditing ? 'Refine Table Configuration' : 'Initialize New Table'}
        >
          <form onSubmit={handleAddTable} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Table Protocol Number</label>
              <input required type="number" className="w-full rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border-none focus:ring-2 focus:ring-amber-500 p-5 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} placeholder="0" />
            </div>
            <button type="submit" className="w-full py-5 bg-zinc-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-amber-600/20">
              {isEditing ? 'Update Configuration' : 'Confirm Initialization'}
            </button>
          </form>
        </Modal>

        <Modal 
          isOpen={showOrderModal} 
          onClose={() => setShowOrderModal(false)} 
          title={`Session Matrix: Table ${selectedTable?.tableNumber}`}
        >
          {selectedTable && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                  <ShoppingBag size={14} className="mr-2 text-amber-600" /> Active Registry
                </h3>
                <div className="space-y-3 max-h-[20rem] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Synced Orders */}
                  {selectedTable.orders.map((order, idx) => (
                    <div key={`synced-${idx}`} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 group">
                      <div>
                        <div className="text-sm font-black text-gray-900 dark:text-zinc-100">{order.itemName}</div>
                        <div className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">{order.quantity} × ₹{order.price}</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-black text-amber-600">₹{order.quantity * order.price}</div>
                        <button onClick={() => handleRemoveOrderItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={16} /></button>
                      </div>
                    </div>
                  ))}

                  {/* Staged (Pending) Orders */}
                  {pendingOrders.filter(p => !selectedTable.orders.find(s => s.itemName === p.itemName && s.price === p.price && s.quantity === p.quantity)).map((order, idx) => (
                    <div key={`pending-${idx}`} className="flex justify-between items-center bg-amber-50/50 dark:bg-amber-500/5 p-5 rounded-2xl border border-dashed border-amber-200 dark:border-amber-500/20 group">
                      <div>
                        <div className="flex items-center">
                          <div className="text-sm font-black text-gray-900 dark:text-zinc-100">{order.itemName}</div>
                          <span className="ml-2 text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Pending</span>
                        </div>
                        <div className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">{order.quantity} × ₹{order.price}</div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-black text-amber-600">₹{order.quantity * order.price}</div>
                        <button onClick={() => handleRemoveStagedItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={16} /></button>
                      </div>
                    </div>
                  ))}

                  {selectedTable.orders.length === 0 && pendingOrders.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-[2.5rem]">
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Registry is Empty</p>
                    </div>
                  )}
                </div>
                
                <div className="pt-6 border-t border-gray-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Payout</span>
                    <span className="text-3xl font-black text-gray-900 dark:text-zinc-100">
                      ₹{(
                        (selectedTable.totalAmount + 
                        pendingOrders.filter(p => !selectedTable.orders.find(s => s.itemName === p.itemName && s.price === p.price && s.quantity === p.quantity))
                          .reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)) - discountAmount
                      ).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowBillModal(true)}
                    className="w-full bg-green-600 dark:bg-green-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition shadow-xl shadow-green-600/20 flex items-center justify-center"
                  >
                    <Receipt size={18} className="mr-3" /> Finalize & Bill
                  </button>
                  <button 
                    onClick={() => setShowCompleteConfirm(selectedTable._id)}
                    className="w-full mt-4 text-[10px] font-black uppercase text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Skip to manual completion
                  </button>
                </div>
              </div>

                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                    <Plus size={14} className="mr-2 text-amber-600" /> Append Resource
                  </h3>
                  
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Search Menu..." 
                      className="w-full rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 p-4 text-xs font-bold outline-none"
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
                          className="absolute z-50 left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar"
                        >
                          {menuItems.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                            <div 
                              key={item._id}
                              onClick={() => {
                                setOrderItem({
                                  itemName: item.name,
                                  price: item.discountedPrice || item.price,
                                  quantity: 1,
                                  menuItemId: item._id
                                });
                                setMenuSearch('');
                                setShowMenuGrid(false);
                              }}
                              className="p-4 hover:bg-accent/10 cursor-pointer border-b border-border last:border-0 flex justify-between items-center"
                            >
                              <div className="flex items-center gap-3">
                                {item.image && <img src={item.image} className="w-8 h-8 rounded-lg object-cover" />}
                                <div>
                                  <div className="text-xs font-bold">{item.name}</div>
                                  <div className="text-[10px] text-muted-foreground uppercase">{item.category?.name}</div>
                                </div>
                              </div>
                              <div className="text-xs font-black text-accent">₹{item.discountedPrice || item.price}</div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <form onSubmit={handleStageOrder} className="space-y-4 p-8 bg-gray-50/50 dark:bg-zinc-800/30 rounded-[2.5rem] border border-gray-100 dark:border-zinc-800">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Asset Name</label>
                      <input required type="text" className="w-full rounded-xl bg-white dark:bg-zinc-900 border-none focus:ring-2 focus:ring-amber-500 p-4 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={orderItem.itemName} onChange={e => setOrderItem({...orderItem, itemName: e.target.value})} placeholder="e.g. Cold Brew" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Units</label>
                        <input required type="number" min="1" className="w-full rounded-xl bg-white dark:bg-zinc-900 border-none focus:ring-2 focus:ring-amber-500 p-4 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={orderItem.quantity} onChange={e => setOrderItem({...orderItem, quantity: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Yield (₹)</label>
                        <input required type="number" className="w-full rounded-xl bg-white dark:bg-zinc-900 border-none focus:ring-2 focus:ring-amber-500 p-4 text-sm font-bold dark:text-zinc-100 outline-none transition-all" value={orderItem.price} onChange={e => setOrderItem({...orderItem, price: e.target.value})} placeholder="0" />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-amber-700 transition shadow-lg shadow-amber-600/20">
                      Stage Item
                    </button>
                  </form>

                  <div className="space-y-4">
                    <div className="p-6 bg-accent/5 rounded-3xl border border-accent/20">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Offer Protocol</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="CODE" 
                          className="flex-1 bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-accent"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button 
                          type="button"
                          onClick={handleApplyCoupon}
                          className="px-4 bg-accent text-accent-foreground rounded-xl text-[10px] font-black uppercase tracking-widest"
                        >
                          Apply
                        </button>
                      </div>
                      {appliedCoupon && (
                        <div className="mt-3 text-[10px] font-bold text-green-500 flex justify-between">
                          <span>OFFER APPLIED: {appliedCoupon.code}</span>
                          <span>-₹{appliedCoupon.discount}</span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handleSyncOrders}
                      className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition shadow-2xl"
                    >
                      Synchronize Matrix
                    </button>
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

        <Modal 
          isOpen={showBillModal} 
          onClose={() => setShowBillModal(false)}
          title="Archive Session to Ledger"
        >
          <form onSubmit={handleUploadBill} className="space-y-8">
            <div className="group relative flex flex-col items-center justify-center p-16 bg-gray-50 dark:bg-zinc-800/50 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-[3rem] hover:border-amber-500 transition-all cursor-pointer">
              <input required type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setBillFile(e.target.files[0])} accept="image/*" />
              <Receipt className="h-16 w-16 text-gray-400 dark:text-zinc-600 mb-4 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-black text-gray-600 dark:text-zinc-400 uppercase tracking-widest text-center">
                {billFile ? <span className="text-amber-600">{billFile.name}</span> : 'Scan & Secure Bill Image'}
              </p>
            </div>
            <button type="submit" className="w-full py-5 bg-zinc-900 dark:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-600/20">
              Finalize & Archive Record
            </button>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={!!showCompleteConfirm}
          onClose={() => setShowCompleteConfirm(null)}
          onConfirm={handleCompleteOrder}
          title="Finalize Session?"
          type="warning"
          confirmText="Generate Bill"
          message="This will complete the order and clear the table status."
        />
      </div>
    </PageTransition>
  );
}
