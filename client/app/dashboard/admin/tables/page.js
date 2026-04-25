'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../../services/api';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2, Search, Globe, ShieldAlert, LayoutGrid, MessageSquare, RefreshCcw, MapPin } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import Dropdown from '../../../components/ui/Dropdown';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';
import { Button } from '@/app/components/ui/Button';
import TableCard from '@/app/components/tables/TableCard';

export default function AdminTablesPage() {
  const { user, socket } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [isModalReady, setIsModalReady] = useState(false);
  
  // Form States
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [newTableLocation, setNewTableLocation] = useState('');
  
  // Ordering States
  const [pendingOrders, setPendingOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [orderItem, setOrderItem] = useState({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' });
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [dietaryFilter, setDietaryFilter] = useState('All');
  const [systemOrders, setSystemOrders] = useState([]);
  const syncTimeoutRef = useRef(null);
  const selectedTableRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  // Handle Progressive Rendering
  useEffect(() => {
    if (showOrderModal) {
      const timer = setTimeout(() => setIsModalReady(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsModalReady(false);
    }
  }, [showOrderModal]);

  const fetchTables = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = selectedLocation === 'All' ? '/tables' : `/tables?locationId=${selectedLocation}`;
      const res = await api.get(url);
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
    fetchResources();
  };

  const fetchSystemOrders = async (tableId) => {
    try {
      const res = await api.get(`/orders?tableId=${tableId}&isBilled=false`);
      setSystemOrders(res.data.data);
    } catch (error) {
      console.error('Failed to fetch system orders');
    }
  };

  const fetchResources = async () => {
    try {
      const [menuRes, locRes] = await Promise.all([
        api.get('/menu'),
        api.get('/locations')
      ]);
      setMenuItems(menuRes?.data?.data || []);
      setLocations(locRes?.data?.data || []);
    } catch (error) {
      console.error("Resource sync failed:", error.response?.data || error.message);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchResources();

    if (socket) {
      if (selectedLocation !== 'All') {
        socket.emit('join_room', `branch_${selectedLocation}`);
      }
      
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
  }, [selectedLocation, socket]);

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!isEditing && !newTableLocation) return toast.error('Select a location first');
    
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
          locationId: newTableLocation
        });
        toast.success('Table initialized', { id: loadToast });
      }
      setShowAddModal(false);
      setIsEditing(false);
      setNewTableNumber('');
      setNewTableName('');
      setNewTableCapacity('4');
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Protocol failure', { id: loadToast });
    }
  };

  const handleEditTable = (table) => {
    setSelectedTable(table);
    setNewTableNumber(table.tableNumber);
    setNewTableName(table.tableName || '');
    setNewTableCapacity(table.capacity || '4');
    setIsEditing(true);
    setShowAddModal(true);
  };

  const handleDeleteTable = async () => {
    const loadToast = toast.loading('Purging table...');
    try {
      await api.delete(`/tables/${showDeleteConfirm}`);
      fetchTables();
      setShowDeleteConfirm(null);
      toast.success('Table liquidated', { id: loadToast });
    } catch (error) {
      toast.error('Protocol error', { id: loadToast });
    }
  };

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
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCode('');
    fetchSystemOrders(table._id);
    setShowOrderModal(true);
  };

  const handleSyncOrders = async (ordersToSync, extra = {}) => {
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

  const handleApplyCoupon = async () => {
    if (pendingOrders.length === 0) return toast.error('Please add items before applying coupon');
    if (!couponCode) return;
    const loadToast = toast.loading('Validating code...');
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
      toast.success('Discount applied', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid code', { id: loadToast });
    }
  };

  const handleFinalizeSession = async (file) => {
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
      await api.put(`/tables/${selectedTable._id}/orders`, { orders: [] });
      setPendingOrders([]);
      fetchTables();
      fetchSystemOrders(selectedTable._id);
      toast.success('Transmission Successful', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Transmission failure', { id: loadToast });
    }
  };

  const filteredTables = useMemo(() => {
    return tables.filter(t =>
      t.tableNumber.toString().includes(searchTerm) ||
      (t.locationId?.name || t.locationName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tables, searchTerm]);

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(m => 
      m.name.toLowerCase().includes(menuSearch.toLowerCase()) && 
      (dietaryFilter === 'All' || m.dietaryType === dietaryFilter)
    );
  }, [menuItems, menuSearch, dietaryFilter]);

  const locationOptions = useMemo(() => [
    { value: 'All', label: 'All Locations' },
    ...locations.map(l => ({ value: l._id, label: l.name || l.city }))
  ], [locations]);

  const stats = useMemo(() => ({
    total: tables.length,
    occupied: tables.filter(t => t.status !== 'available').length,
    revenue: tables.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0)
  }), [tables]);

  if (loading) return (
    <div className="space-y-6 p-4">
      <div className="h-16 bg-muted rounded-2xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Globe size={24} className="text-white" />
              </div>
              Global Floor Matrix
            </h1>
            <p className="text-xs text-muted-foreground font-medium ml-13">Supervisory command — all sectors active</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-2xl bg-muted text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all border border-border disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-12 w-px bg-border mx-2 hidden sm:block" />
            <Button 
              variant="primary" 
              className="!rounded-2xl !py-4 shadow-xl shadow-accent/20 bg-amber-600 hover:bg-amber-700 text-[10px] font-black uppercase tracking-[0.2em]"
              icon={Plus}
              onClick={() => {
                setIsEditing(false);
                setNewTableNumber('');
                setNewTableName('');
                setNewTableCapacity('4');
                setShowAddModal(true);
              }}
            >
              Register Table
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Matrix', val: stats.total, color: 'amber', icon: Globe },
            { label: 'Live Sessions', val: stats.occupied, color: 'amber', icon: Zap },
            { label: 'Total Revenue', val: `₹${stats.revenue.toLocaleString()}`, color: 'emerald', icon: Receipt }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.05}>
              <div className="glass-morphism rounded-2xl border border-border p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={`text-${stat.color}-500`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground leading-none">{stat.val}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>

        <div className="relative z-20 glass-morphism rounded-2xl border border-border p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search table number or location..."
              className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all text-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-56">
            <Dropdown
              options={locationOptions}
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="All Locations"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredTables.map((table, i) => (
              <SlideIn key={table._id} delay={i * 0.02} direction="up">
                <TableCard
                  table={table}
                  onAssign={handleBookTable}
                  onManage={handleOpenOrder}
                  onEdit={handleEditTable}
                  onDelete={setShowDeleteConfirm}
                />
              </SlideIn>
            ))}
          </AnimatePresence>
        </div>

        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={isEditing ? 'Modify Protocol' : 'Initialize New Unit'} maxWidth="max-w-md">
          <form onSubmit={handleAddTable} className="space-y-4">
            {!isEditing && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Target Location</label>
                <Dropdown options={locations.map(l => ({ value: l._id, label: l.name }))} value={newTableLocation} onChange={setNewTableLocation} placeholder="Select Location" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Table ID</label>
              <input required type="number" className="w-full rounded-xl bg-muted border border-border p-4 text-sm font-bold text-foreground" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Designation</label>
              <input type="text" className="w-full rounded-xl bg-muted border border-border p-4 text-sm font-bold text-foreground" value={newTableName} onChange={e => setNewTableName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Seating Capacity</label>
              <input required type="number" className="w-full rounded-xl bg-muted border border-border p-4 text-sm font-bold text-foreground" value={newTableCapacity} onChange={e => setNewTableCapacity(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" className="w-full !rounded-xl !py-4 shadow-xl shadow-accent/10" icon={isEditing ? Edit3 : Plus}>{isEditing ? 'Confirm Update' : 'Initialize Unit'}</Button>
          </form>
        </Modal>

        <Modal isOpen={showOrderModal} onClose={() => setShowOrderModal(false)} title={`Session Matrix: T${selectedTable?.tableNumber}`} maxWidth="max-w-7xl">
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
              <div className="lg:col-span-5 flex flex-col h-full bg-muted/30 rounded-[2.5rem] border border-border overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-border bg-gradient-to-br from-muted/50 to-card space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Session Core
                      </h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Order Registry</p>
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
                      <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2">
                        Guest Identity <span className="text-rose-500 font-bold">*</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="ENTER NAME"
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-accent/20 transition-all placeholder:text-muted-foreground/30 text-foreground"
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
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-accent/20 transition-all text-foreground"
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
                      key={`${order.menuItemId || order.itemName}-${idx}`}
                      className="flex justify-between items-center bg-card p-4 rounded-2xl border border-border group hover:border-accent/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                          {order.image ? <img src={order.image} className="h-full w-full object-cover" /> : <Coffee size={18} className="text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="text-xs font-black text-foreground line-clamp-1">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mt-0.5">₹{Number(order.price).toLocaleString()} / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-muted rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-card text-muted-foreground transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-black text-foreground">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-card text-muted-foreground transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-black text-accent w-16 text-right">
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
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-muted-foreground" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Registry is Empty</p>
                    </div>
                  )}

                  {(systemOrders.length > 0 || pendingOrders.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-border">
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
                                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{order.status}</div>
                                </div>
                              </div>
                              
                              {order.chefNote && (
                                <div className="flex-1 mx-4 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-2 group/note relative">
                                  <MessageSquare size={12} className="text-amber-500 flex-shrink-0" />
                                  <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-tight line-clamp-1">{order.chefNote}</p>
                                  
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-zinc-900 text-white text-[10px] font-medium rounded-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    {order.chefNote}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-zinc-900" />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="text-[10px] font-black text-foreground">₹{Number(order.totalAmount).toLocaleString()}</div>
                                {order.status === 'COMPLETED' && !order.isBilled && (
                                  <button
                                    onClick={async () => {
                                      const loadToast = toast.loading('Generating fiscal proof...');
                                      try {
                                        await api.post(`/orders/${order._id}/generate-bill`);
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
                          <div className="py-4 text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">No active production units</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border-t border-border bg-card/50 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      <span>Production Subtotal</span>
                      <span className="text-foreground">₹{systemOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                        <span>Discount Applied</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase text-amber-600 tracking-[0.3em] mb-2">Billed Total</span>
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
                        className="w-full !rounded-2xl !py-4 shadow-xl shadow-accent/20 bg-amber-600 hover:bg-amber-700 text-[10px] font-black uppercase tracking-widest"
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
                </div>
              </div>

                <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-8">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search the menu matrix..."
                    className="w-full rounded-2xl bg-muted border border-border pl-12 pr-4 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-accent/20 transition-all text-foreground shadow-sm"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
                  <div className="flex bg-muted/50 p-1 rounded-xl border border-border w-fit shadow-inner">
                    {[
                      { id: 'All', label: 'All Items' },
                      { id: 'veg', label: 'Veg Only'},
                      { id: 'non-veg', label: 'Non-Veg'}
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setDietaryFilter(f.id)}
                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          dietaryFilter === f.id 
                            ? 'bg-accent text-black shadow-sm' 
                            : 'text-muted-foreground hover:text-foreground'
                        } ${f.color || ''}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {!menuSearch && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center">
                      <Zap size={12} className="mr-2 text-accent" /> Top Performing Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => (
                        <div
                          key={item._id}
                          className="flex-shrink-0 w-40 bg-card rounded-2xl p-4 border border-border hover:border-accent/30 transition-all cursor-pointer group shadow-sm"
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
                          <div className="h-20 w-full rounded-xl overflow-hidden mb-3 bg-muted relative shadow-inner">
                            {item.image ? (
                              <img src={item.image} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Coffee size={24} /></div>
                            )}
                            <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <Plus className="text-white drop-shadow-md" size={24} strokeWidth={3} />
                            </div>
                          </div>
                          <div className="text-[10px] font-black text-foreground truncate">{item.name}</div>
                          <div className="text-[10px] font-bold text-accent mt-1">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Coffee size={20} /></div>
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

                <div className="p-6 bg-muted rounded-3xl border border-border">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 ml-1">Apply Coupon Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-accent/20 transition-all text-foreground"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-zinc-900/20"
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

        <ConfirmDialog isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} onConfirm={handleDeleteTable} title="Decommission Table?" message="This table will be permanently removed from the global floor grid." />
        <BillPreview isOpen={isBillPreviewOpen} onClose={() => setIsBillPreviewOpen(false)} onComplete={handleFinalizeSession} table={selectedTable} systemOrders={systemOrders} />
      </div>
    </PageTransition>
  );
}
