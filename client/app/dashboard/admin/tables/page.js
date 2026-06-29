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
import { can } from '@/app/config/actions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';
import { Button } from '@/app/components/ui/Button';
import TableCard from '@/app/components/tables/TableCard';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';

export default function AdminTablesPage() {
  const { user, socket } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
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
    const timer = setTimeout(() => {
      setIsModalReady(showOrderModal);
    }, showOrderModal ? 300 : 0);

    return () => clearTimeout(timer);
  }, [showOrderModal]);

  const fetchTables = async (silent = false) => {
    const isInitial = !didInitRef.current;
    if (!silent) {
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
    }
    try {
      const url = selectedLocation === 'All' ? '/tables' : `/tables?locationId=${selectedLocation}`;
      const res = await api.get(url);
      setTables(res.data.data);
    } catch (error) {
      toast.error('Could not load tables. Please try again.');
    } finally {
      didInitRef.current = true;
      if (!silent) {
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
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

  // Fetch the menu SCOPED to a branch so the server merges that branch's stock +
  // availability (BranchStock) into each item. Re-scoped per table on order open.
  const fetchMenu = async (locId) => {
    try {
      const id = locId?._id || locId;
      const params = new URLSearchParams({ limit: '500' });
      if (id && id !== 'All' && id !== 'all') params.append('locationId', id);
      const res = await api.get(`/menu?${params.toString()}`);
      setMenuItems(res?.data?.data || []);
    } catch (error) {
      console.error('Menu sync failed');
    }
  };

  // Per-branch stock state for a menu item. `branchSpecificStock` is only present
  // when the branch actually tracks stock; if not, we never block on a phantom 0.
  const stockInfo = (item) => {
    const tracks = typeof item.branchSpecificStock === 'number';
    const out = item.isAvailable === false || (tracks && item.branchSpecificStock <= 0);
    return { tracks, out, qty: tracks ? item.branchSpecificStock : null };
  };

  // Single add-to-order path used by both card grids, with out-of-stock guard.
  const addItemToOrder = (item) => {
    if (appliedCoupon) return toast.error('Remove coupon to add new items');
    if (stockInfo(item).out) return toast.error(`${item.name} is out of stock`);
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
  };

  const fetchResources = async () => {
    try {
      const [locRes] = await Promise.all([
        api.get('/locations')
      ]);
      setLocations(locRes?.data?.data || []);
      // Initial menu scoped to the currently selected branch (if any).
      fetchMenu(selectedLocation);
    } catch (error) {
      console.error("Resource sync failed:", error.response?.data || error.message);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTables();
      fetchResources();
    }, 0);

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
        clearTimeout(timer);
        socket.off('order:new');
        socket.off('order:update');
        socket.off('order:ready');
      };
    }

    return () => clearTimeout(timer);
  }, [selectedLocation, socket]);

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!isEditing && !newTableLocation) return toast.error('Select a location first');
    
    const loadToast = toast.loading(isEditing ? 'Updating table...' : 'Creating table...');
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
        toast.success('Table created', { id: loadToast });
      }
      setShowAddModal(false);
      setIsEditing(false);
      setNewTableNumber('');
      setNewTableName('');
      setNewTableCapacity('4');
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
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
    const loadToast = toast.loading('Deleting table...');
    try {
      await api.delete(`/tables/${showDeleteConfirm}`);
      fetchTables();
      setShowDeleteConfirm(null);
      toast.success('Table deleted', { id: loadToast });
    } catch (error) {
      toast.error('Could not delete the table. Please try again.', { id: loadToast });
    }
  };

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
    setPendingOrders([...table.orders]);
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCode('');
    fetchSystemOrders(table._id);
    // Scope the menu to THIS table's branch so stock/availability are accurate.
    fetchMenu(table.locationId);
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
      toast.success('Discount applied', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid coupon code', { id: loadToast });
    }
  };

  const handleFinalizeSession = async (file, finalTotal, paymentType = 'CASH') => {
    const loadToast = toast.loading('Finishing the bill...');
    if (!selectedTable.customerName) {
      toast.error('Customer name required', { id: loadToast });
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
      fetchTables();
      toast.success('Bill finished and table cleared', { id: loadToast });
    } catch (error) {
      toast.error('Could not finish the bill. Please try again.', { id: loadToast });
    }
  };

  const handleMerge = async (sourceId, targetTableId) => {
    if (!targetTableId) return;
    const loadToast = toast.loading('Merging tables...');
    try {
      await api.put(`/tables/${sourceId}/merge`, { targetTableId });
      toast.success('Tables merged', { id: loadToast });
      setShowOrderModal(false);
      setSelectedTable(null);
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not merge tables', { id: loadToast });
    }
  };

  const handleSendToKitchen = async () => {
    if (pendingOrders.length === 0) return toast.error('No items added to order');
    if (!selectedTable.customerName) return toast.error('Customer name required');

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
      await api.put(`/tables/${selectedTable._id}/orders`, { orders: [] });
      setPendingOrders([]);
      fetchTables();
      fetchSystemOrders(selectedTable._id);
      toast.success('Order sent to kitchen', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send the order. Please try again.', { id: loadToast });
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

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight flex items-center gap-3">
              <div className="h-6 w-6 rounded-xl bg-primary flex items-center justify-center">
                <Globe size={16} className="text-(--color-bg-base)" />
              </div>
              Tables
            </h1>
            <p className="text-xs text-(--color-text-muted) font-medium ml-13">Manage all tables across all branches</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-xl bg-(--color-bg-soft) text-(--color-text-muted) hover:text-primary hover:bg-primary/10 transition-all border border-(--color-border) disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-12 w-px bg-(--color-border) mx-2 hidden sm:block" />
            {can(user, 'tables.add') && (
            <Button
              variant="primary"
              className="!rounded-xl !py-2.5 bg-primary hover:bg-primary-dark text-[11px] font-semibold tracking-normal"
              icon={Plus}
              onClick={() => {
                setIsEditing(false);
                setNewTableNumber('');
                setNewTableName('');
                setNewTableCapacity('4');
                setShowAddModal(true);
              }}
            >
              Add Table
            </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Tables', val: stats.total, color: 'primary', icon: Globe },
            { label: 'Active Tables', val: stats.occupied, color: 'primary', icon: Zap },
            { label: 'Total Revenue', val: `₹${stats.revenue.toLocaleString()}`, color: 'emerald', icon: Receipt }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.05}>
              <div className="glass-morphism rounded-xl border border-(--color-border) p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl bg-[var(--color-${stat.color === 'emerald' ? 'success' : 'primary'})]/10 flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={`text-[var(--color-${stat.color === 'emerald' ? 'success' : 'primary'})]`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-(--color-text-primary) leading-none">{stat.val}</p>
                  <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted) mt-0.5">{stat.label}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>

        <div className="relative z-20 glass-morphism rounded-xl border border-(--color-border) p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={16} />
            <input
              type="text"
              placeholder="Search table number or location..."
              className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all text-(--color-text-primary)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64 sm:shrink-0">
            <PremiumSelect 
              options={locationOptions}
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="All Locations"
            />
          </div>
        </div>

        {/* Floor map — at-a-glance status overview (click a table to manage it) */}
        {!refetching && filteredTables.length > 0 && (
          <div className="mb-6 p-5 rounded-xl border border-(--color-border) bg-(--color-surface)/40 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Floor map</h3>
              <div className="flex items-center gap-3 text-[11px] font-medium tracking-normal">
                <span className="flex items-center gap-1 text-success"><span className="h-2 w-2 rounded-full bg-success" /> Free</span>
                <span className="flex items-center gap-1 text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Occupied</span>
                <span className="flex items-center gap-1 text-amber-500"><span className="h-2 w-2 rounded-full bg-amber-500" /> Reserved</span>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {filteredTables.map((t) => {
                const reserved = !!t.reservation;
                const free = t.status === 'available' && !t.isBooked;
                const tone = free
                  ? 'bg-success/10 text-success border-success/30'
                  : reserved
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    : 'bg-primary/10 text-primary border-primary/30';
                return (
                  <button
                    key={t._id}
                    onClick={() => handleOpenOrder(t)}
                    title={`${t.tableName || `Table ${t.tableNumber}`} · ${free ? 'free' : reserved ? 'reserved' : 'occupied'}`}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center font-medium transition-transform hover:scale-105 ${tone}`}
                  >
                    <span className="text-sm">T{t.tableNumber}</span>
                    <span className="text-[7px] uppercase tracking-normal opacity-70">{free ? 'free' : reserved ? 'resv' : 'busy'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {refetching ? <TableSkeleton rows={6} cols={5} /> : (
        <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface)/40  shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Table</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Branch</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Capacity</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Status</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredTables.map((table, i) => (
                  <motion.tr 
                    key={table._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group border-b border-(--color-border) hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <td className="px-5 py-4" onClick={() => handleOpenOrder(table)}>
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-medium border transition-transform ${
                          table.status === 'available' ? 'bg-success/10 text-success border-success/20' : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          T{table.tableNumber}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-(--color-text-primary)">{table.tableName || `Table ${table.tableNumber}`}</p>
                          <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mt-0.5">ID: {table._id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4" onClick={() => handleOpenOrder(table)}>
                      <div className="flex items-center gap-2 text-(--color-text-primary)">
                        <MapPin size={14} className="text-primary" />
                        <span className="text-sm font-medium">{table.locationId?.name || table.locationName || 'Main Branch'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4" onClick={() => handleOpenOrder(table)}>
                      <div className="flex items-center gap-2 text-(--color-text-primary)">
                        <Users size={14} className="text-(--color-text-muted)" />
                        <span className="text-sm font-medium">{table.capacity} People</span>
                      </div>
                    </td>
                    <td className="px-5 py-4" onClick={() => handleOpenOrder(table)}>
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-normal border ${
                        table.status === 'available' ? 'bg-success/10 text-success border-success/20' : 'bg-primary/10 text-primary border-primary/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${table.status === 'available' ? 'bg-success' : 'bg-primary'}`} />
                        {table.status}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2  transition-opacity">
                        {can(user, 'tables.modify') && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEditTable(table)}
                          className="p-2.5 rounded-xl bg-(--color-surface-soft) text-(--color-text-secondary) border border-(--color-border) hover:text-primary transition-all"
                        >
                          <Edit3 size={16} />
                        </motion.button>
                        )}
                        {can(user, 'tables.delete') && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowDeleteConfirm(table._id)}
                          className="p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white transition-all"
                        >
                          <Trash2 size={16} />
                        </motion.button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredTables.length === 0 && (
            <div className="p-20 text-center text-(--color-text-muted)">
              <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium tracking-normal">No tables found</p>
            </div>
          )}
        </div>
        )}

        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={isEditing ? 'Update Table' : 'Add New Table'} maxWidth="max-w-md">
          <form onSubmit={handleAddTable} className="space-y-4">
            {!isEditing && (
              <PremiumSelect 
                label="Branch"
                options={locations.map(l => ({ value: l._id, label: l.name }))} 
                value={newTableLocation} 
                onChange={setNewTableLocation} 
                placeholder="Select Location" 
              />
            )}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1">Table Number</label>
              <input required type="number" className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary)" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1">Table Name</label>
              <input type="text" className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary)" value={newTableName} onChange={e => setNewTableName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1">Seating Capacity</label>
              <input required type="number" className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) p-4 text-sm font-medium text-(--color-text-primary)" value={newTableCapacity} onChange={e => setNewTableCapacity(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" className="w-full bg-primary !rounded-xl !py-2.5 shadow-sm " icon={isEditing ? Edit3 : Plus}>{isEditing ? 'Save Changes' : 'Add Table'}</Button>
          </form>
        </Modal>

        <Modal isOpen={showOrderModal} onClose={() => setShowOrderModal(false)} title={`Table Details: T${selectedTable?.tableNumber}`} maxWidth="max-w-7xl">
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[75vh]">
              <div className="lg:col-span-5 flex flex-col h-full bg-(--color-surface-soft) rounded-xl border border-(--color-border) overflow-y-auto custom-scrollbar shadow-sm">
                <div className="p-5 border-b border-(--color-border) bg-gradient-to-br from-(--color-surface-soft) to-(--color-surface) space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-semibold text-primary uppercase tracking-normal flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Order Details
                      </h3>
                      <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Current order</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-semibold text-(--color-text-primary) tracking-tight">
                        {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)}
                      </span>
                      <span className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Items</span>
                    </div>
                  </div>

                  {(() => {
                    const branchId = (selectedTable.locationId?._id || selectedTable.locationId)?.toString();
                    const mergeTargets = tables.filter((t) => ((t.locationId?._id || t.locationId)?.toString() === branchId) && t._id !== selectedTable._id);
                    if (mergeTargets.length === 0) return null;
                    return (
                      <PremiumSelect
                        value=""
                        onChange={(v) => { if (v) handleMerge(selectedTable._id, v); }}
                        options={mergeTargets.map((t) => ({ label: `T${t.tableNumber}${t.tableName ? ` · ${t.tableName}` : ''}`, value: t._id }))}
                        placeholder="Merge this table into…"
                      />
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-6 p-5 bg-(--color-surface) rounded-xl border border-(--color-border) shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1 flex items-center gap-2">
                        Customer Name <span className="text-danger font-medium">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter name"
                        className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl px-4 py-2.5 mt-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-(--color-text-muted)/30 text-(--color-text-primary)"
                        value={selectedTable.customerName || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <PremiumSelect
                        label="Number of People"
                        placeholder="Select people"
                        options={Array.from({ length: Number(selectedTable.capacity) || 4 }, (_, i) => ({
                          value: i + 1,
                          label: `${i + 1} ${i + 1 === 1 ? 'Person' : 'People'}`
                        }))}
                        value={selectedTable.numberOfPeople || 1}
                        onChange={(val) => handleSyncOrders(pendingOrders, { numberOfPeople: val })}
                        icon={Users}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {pendingOrders.map((order, idx) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={`${order.menuItemId || order.itemName}-${idx}`}
                      className="flex justify-between items-center bg-(--color-surface) p-4 rounded-xl border border-(--color-border) group hover:border-primary/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-(--color-bg-soft) flex items-center justify-center">
                          {order.image ? <img src={order.image} alt={order.itemName} className="h-full w-full object-cover" /> : <Coffee size={18} className="text-(--color-text-muted)" />}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-(--color-text-primary) line-clamp-1">{order.itemName}</div>
                          <div className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mt-0.5">₹{Number(order.price).toLocaleString()} / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-(--color-bg-soft) rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-(--color-surface) text-(--color-text-muted) transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-(--color-text-primary)">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-(--color-surface) text-(--color-text-muted) transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-semibold text-primary w-16 text-right">
                          ₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}
                        </div>
                        <button
                          onClick={() => handleRemoveStagedItem(idx)}
                          className="h-6 w-6 rounded-lg bg-danger/10 text-danger flex items-center justify-center hover:bg-danger hover:text-(--color-bg-base) transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {pendingOrders.length === 0 && systemOrders.length === 0 && (
                    <div className="min-h-60 flex flex-col items-center justify-center opacity-40 py-20">
                      <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-(--color-text-muted)" />
                      <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted)">No items added yet</p>
                    </div>
                  )}

                  {(systemOrders.length > 0 || pendingOrders.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-(--color-border)">
                      <h3 className="text-[11px] font-semibold text-primary uppercase tracking-normal mb-4 flex items-center gap-2">
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
                                  <div className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">{order.status}</div>
                                </div>
                              </div>
                              
                              {order.chefNote && (
                                <div className="flex-1 mx-4 px-3 py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2 group/note relative">
                                  <MessageSquare size={12} className="text-primary flex-shrink-0" />
                                  <p className="text-[11px] font-medium text-primary leading-tight line-clamp-1">{order.chefNote}</p>
                                  
                                  <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-(--color-text-primary) text-(--color-bg-base) text-[10px] font-medium rounded-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-50 shadow-sm">
                                    {order.chefNote}
                                    <div className="absolute top-full left-4 border-8 border-transparent border-t-(--color-text-primary)" />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="text-[11px] font-medium text-(--color-text-primary)">₹{Number(order.totalAmount).toLocaleString()}</div>
                                {order.status === 'COMPLETED' && !order.isBilled && (
                                  <button
                                    onClick={async () => {
                                      const loadToast = toast.loading('Generating bill...');
                                      try {
                                        await api.post(`/orders/${order._id}/generate-bill`);
                                        toast.success('Bill generated', { id: loadToast });
                                        fetchSystemOrders(selectedTable._id);
                                      } catch (err) {
                                        toast.error('Could not generate the bill. Please try again.', { id: loadToast });
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-(--color-bg-base) text-[11px] font-semibold uppercase tracking-normal rounded-lg transition-all"
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
                          <div className="py-4 text-center text-[11px] font-medium tracking-normal text-(--color-text-muted)">No orders in kitchen</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 border-t border-(--color-border) bg-(--color-surface)/50 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                      <span>Subtotal</span>
                      <span className="text-(--color-text-primary)">₹{systemOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0).toLocaleString()}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[11px] font-medium uppercase tracking-normal text-success">
                        <span>Discount Applied</span>
                        <span>-₹{discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="h-px bg-(--color-border) my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-medium uppercase text-primary tracking-normal mb-2">Total Amount</span>
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
                        className="w-full !rounded-xl !py-2.5 shadow-sm  bg-primary hover:bg-primary/80 text-[11px] font-semibold uppercase tracking-normal"
                        icon={Zap}
                        onClick={handleSendToKitchen}
                        disabled={pendingOrders.length === 0}
                      >
                        Send to Kitchen
                      </Button>
                      {systemOrders.length > 0 && (
                        <Button
                          variant="primary"
                          className="w-full !rounded-xl !py-2.5 shadow-sm  bg-success hover:bg-success/80 text-[11px] font-semibold uppercase tracking-normal"
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

                <div className="lg:col-span-7 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 space-y-6">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    className="w-full rounded-xl bg-(--color-bg-soft) border border-(--color-border) pl-12 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all text-(--color-text-primary) shadow-sm"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                  />
                </div>

                {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
                  <div className="flex bg-(--color-bg-soft)/50 p-1 rounded-xl border border-(--color-border) w-fit shadow-inner">
                    {[
                      { id: 'All', label: 'All Items' },
                      { id: 'veg', label: 'Veg Only'},
                      { id: 'non-veg', label: 'Non-Veg'}
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setDietaryFilter(f.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium uppercase tracking-normal transition-all ${
                          dietaryFilter === f.id
                            ? 'bg-primary text-(--color-bg-base) shadow-sm'
                            : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
                        } ${f.color || ''}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {!menuSearch && dietaryFilter === 'All' && (
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal flex items-center">
                      <Zap size={12} className="mr-2 text-primary" /> Popular Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => {
                        const { out, tracks, qty } = stockInfo(item);
                        return (
                        <div
                          key={item._id}
                          className={`flex-shrink-0 w-40 bg-(--color-surface) rounded-xl p-4 border border-(--color-border) transition-all group shadow-sm ${out ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30 cursor-pointer'}`}
                          onClick={() => addItemToOrder(item)}
                        >
                          <div className="h-20 w-full rounded-xl overflow-hidden mb-3 bg-(--color-bg-soft) relative shadow-inner">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)"><Coffee size={24} /></div>
                            )}
                            {out ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-bg-base) bg-danger/90 px-2 py-1 rounded-md">Out of stock</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-primary/20  flex items-center justify-center transition-all">
                                <Plus className="text-(--color-bg-base)" size={24} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-(--color-text-primary) truncate">{item.name}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-[11px] font-semibold text-primary">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                            {tracks && (
                              <span className={`text-[11px] font-medium uppercase tracking-normal ${qty <= 0 ? 'text-danger' : qty < 10 ? 'text-warning' : 'text-success'}`}>
                                {qty <= 0 ? 'Out' : `${qty} left`}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <h3 className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Full Menu</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {isModalReady ? filteredMenuItems.map((item) => {
                        const { out, tracks, qty } = stockInfo(item);
                        return (
                        <div
                          key={item._id}
                          onClick={() => addItemToOrder(item)}
                          className={`bg-(--color-surface) p-4 rounded-xl border border-(--color-border) transition-all flex flex-col gap-3 group relative shadow-sm ${out ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30 cursor-pointer hover:shadow-sm'}`}
                        >
                          <div className="h-24 w-full rounded-xl bg-(--color-bg-soft) overflow-hidden relative shadow-inner">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)"><Coffee size={20} /></div>
                            )}
                            <div className="absolute top-2 left-2">
                              <div className={`px-2 py-0.5 rounded-full text-[7px] font-medium uppercase tracking-normal text-(--color-bg-base) ${item.dietaryType === 'veg' ? 'bg-success' : 'bg-danger'}`}>
                                {item.dietaryType || 'Food'}
                              </div>
                            </div>
                            {out ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-[11px] font-medium uppercase tracking-normal text-(--color-bg-base) bg-danger/90 px-2 py-1 rounded-md">Out of stock</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-primary/20  flex items-center justify-center transition-all">
                                <Plus className="text-(--color-bg-base)" size={32} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-[11px] font-medium text-(--color-text-primary) leading-tight truncate">{item.name}</div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-[11px] font-semibold text-primary">₹{Number(item.discountedPrice || item.price).toLocaleString()}</div>
                              {tracks ? (
                                <span className={`text-[11px] font-medium uppercase tracking-normal ${qty <= 0 ? 'text-danger' : qty < 10 ? 'text-warning' : 'text-success'}`}>
                                  {qty <= 0 ? 'Out' : `${qty} left`}
                                </span>
                              ) : (
                                <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${out ? 'bg-danger/10 text-danger' : 'bg-(--color-bg-soft) text-(--color-text-muted) group-hover:bg-primary group-hover:text-(--color-bg-base)'}`}>
                                  {out ? <X size={12} /> : <Plus size={12} />}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      }) : (
                        [1,2,3,4,5,6].map(i => (
                          <div key={i} className="h-40 rounded-xl bg-(--color-bg-soft)/20 animate-pulse border border-(--color-border)" />
                        ))
                      )}
                  </div>
                </div>

                <div className="p-6 bg-(--color-bg-soft) rounded-xl border border-(--color-border)">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal mb-2 ml-1">Apply Coupon Code</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter code"
                          className="flex-1 bg-(--color-surface) border border-(--color-border) rounded-xl px-4 py-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all text-(--color-text-primary)"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-(--color-text-primary) text-(--color-bg-base) rounded-xl text-[11px] font-semibold uppercase tracking-normal hover:opacity-90 transition-all"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                    {appliedCoupon && (
                      <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl text-[11px] font-medium text-success flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Check size={12} /> {appliedCoupon.code} applied
                        </div>
                        <button
                          onClick={() => {
                            setAppliedCoupon(null);
                            setDiscountAmount(0);
                            setCouponCode('');
                            toast.success('Coupon removed');
                          }}
                          className="text-danger hover:opacity-80 uppercase text-[11px] font-medium"
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

        <ConfirmDialog isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} onConfirm={handleDeleteTable} title="Delete Table?" message="This table will be permanently removed. This cannot be undone." />
        <BillPreview isOpen={isBillPreviewOpen} onClose={() => setIsBillPreviewOpen(false)} onComplete={handleFinalizeSession} table={selectedTable} systemOrders={systemOrders} />
      </div>
    </PageTransition>
  );
}
