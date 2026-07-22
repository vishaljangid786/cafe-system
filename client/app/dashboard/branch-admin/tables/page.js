"use client"
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { compressImage } from '../../../utils/imageUpload';
import { Coffee, Plus, Check, Users, ShoppingBag, X, Zap, Receipt, Trash2, Edit3, Loader2, Search, Globe, ShieldAlert, MessageSquare, RefreshCcw, QrCode, Package, Store } from 'lucide-react';
import { TableQRModal, TableQRBulkModal, BranchQRModal } from '@/app/components/tables/TableQR';
import PendingApprovals from '@/app/components/orders/PendingApprovals';
import StockManager from '@/app/components/menu/StockManager';
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
import { can } from '@/app/config/actions';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';

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
  const [forceBill, setForceBill] = useState(false);
  const [systemOrders, setSystemOrders] = useState([]);
  // Tender is picked when the order is TAKEN (not only at billing) so the kitchen
  // ticket and the cash drawer agree from the start.
  const [orderPaymentType, setOrderPaymentType] = useState('CASH');
  // Purely informational chip; the discount itself is applied server-side.
  const [customerHint, setCustomerHint] = useState('');
  useEffect(() => { // cafeos-crm-hint
    const digits = String(selectedTable?.customerPhone || '').replace(/\D/g, '');
    if (digits.length < 10) { setCustomerHint(''); return undefined; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.get(`/customers?search=${digits}&limit=1`)
        .then((r) => {
          if (cancelled) return;
          const c = (r.data?.data || [])[0];
          setCustomerHint(c
            ? `Returning · ${c.visits || 0} visits · ₹${Math.round(c.totalSpend || 0)} lifetime`
            : 'New customer — intro offer applies');
        })
        .catch(() => { if (!cancelled) setCustomerHint(''); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedTable?.customerPhone]);
  const [statusFilter, setStatusFilter] = useState('all'); // all, available, occupied
  const [qrTable, setQrTable] = useState(null);
  const [showBulkQr, setShowBulkQr] = useState(false);
  const [showBranchQr, setShowBranchQr] = useState(false);
  const [showStock, setShowStock] = useState(false);
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
      console.error('Could not load tables. Please try again.');
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

  // Fetch the menu SCOPED to a branch so the server merges that branch's stock +
  // availability (BranchStock) into each item. Passing a locationId is also what
  // makes the menu show up reliably for a branch_admin and avoids the default
  // 20-item page cap. Falls back to the admin's own branch when none is given.
  const fetchMenu = async (locId) => {
    try {
      const id = locId?._id || locId;
      const params = new URLSearchParams({ limit: '500' });
      if (id) params.append('locationId', id);
      const res = await api.get(`/menu?${params.toString()}`);
      setMenuItems(res.data.data);
    } catch (error) {
      console.error('Menu sync failed');
    }
  };

  // Per-branch stock state for a menu item. `branchSpecificStock` is only present
  // when the branch actually tracks stock for it; if it isn't tracked we never
  // block on a phantom 0 — only an explicit availability toggle marks it out.
  const stockInfo = (item) => {
    const tracks = typeof item.branchSpecificStock === 'number';
    const out = item.isAvailable === false || (tracks && item.branchSpecificStock <= 0);
    return { tracks, out, qty: tracks ? item.branchSpecificStock : null };
  };

  // Single add-to-order path used by both the Best Selling and Full Menu cards,
  // with the out-of-stock guard applied in one place.
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

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [couponRes] = await Promise.all([
          api.get('/coupons?active=true')
        ]);
        setCoupons(couponRes.data.data);
        // Initial menu scoped to the admin's own branch; re-scoped per table on open.
        fetchMenu(user?.assignedLocation);
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

      // Named handlers so cleanup removes exactly THIS component's listeners —
      // socket.off(event) alone wipes every listener for that event on the shared
      // socket, silently breaking other components' realtime updates.
      const onOrderNew = () => fetchTables(true);
      const onOrderUpdate = () => {
        fetchTables(true);
        if (selectedTableRef.current) fetchSystemOrders(selectedTableRef.current._id);
      };
      const onOrderReady = (data) => {
        toast.success(data.message || 'Order is ready!', { icon: '🍱' });
        fetchTables(true);
      };

      socket.on('order:new', onOrderNew);
      socket.on('order:update', onOrderUpdate);
      socket.on('order:ready', onOrderReady);

      return () => {
        socket.off('order:new', onOrderNew);
        socket.off('order:update', onOrderUpdate);
        socket.off('order:ready', onOrderReady);
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
        customerName: data.customerName,
        // Collected as a required field in AssignTableModal — forwarding it is what
        // links the table session (and its orders) to a CRM identity.
        customerPhone: data.customerPhone || ''
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
    // Scope the menu to THIS table's branch so stock/availability are accurate.
    fetchMenu(table.locationId);
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
    // Phone is the CRM identity key: without it the order can't be linked to
    // rewards or the new-customer offer.
    if (String(selectedTable.customerPhone || '').replace(/\D/g, '').length < 10) {
      return toast.error('Customer mobile number required (10 digits)');
    }

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
        couponId: appliedCoupon?.couponId || null,
        customerName: selectedTable.customerName || '',
        customerPhone: String(selectedTable.customerPhone || '').replace(/\D/g, ''),
        // Tender is chosen when the order is taken (not only at billing) so the
        // kitchen ticket and the drawer agree from the start.
        paymentType: orderPaymentType
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

  const handleFinalizeSession = async (file, finalTotal, paymentType = 'CASH') => {
    const loadToast = toast.loading('Saving bill...');
    const data = new FormData();
    // Downscale the receipt photo before upload (no-op when there is no file).
    data.append('billImage', await compressImage(file));
    data.append('paymentType', paymentType);
    if (forceBill) data.append('force', 'true');
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

  const handleCancelTable = async (table) => {
    if (!window.confirm('Cancel this table and free it? All active orders will be cancelled.')) return;
    const loadToast = toast.loading('Cancelling table...');
    try {
      await api.put(`/tables/${table._id}/cancel`);
      toast.success('Table freed', { id: loadToast });
      setShowOrderModal(false);
      setSelectedTable(null);
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not cancel the table', { id: loadToast });
    }
  };

  const stats = {
    total: tables.length,
    occupied: tables.filter(t => t.status !== 'available').length,
    revenue: tables.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0)
  };

  const branchId = user?.assignedLocation?._id || user?.assignedLocation || 'All';
  const branchName = user?.assignedLocation?.name || tables[0]?.locationId?.name || 'Your branch';



  const handleDeleteTable = async () => {
    const loadToast = toast.loading('Deleting table...');
    try {
      await api.delete(`/tables/${showDeleteConfirm}`);
      fetchTables();
      toast.success('Table deleted', { id: loadToast });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete the table. Please try again.', { id: loadToast, duration: 7000 });
    }
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight flex items-center gap-3">
              <div className="h-6 w-6 rounded-xl bg-primary flex items-center justify-center">
                <Globe size={16} className="text-white" />
              </div>
              Tables
            </h1>
            <p className="text-xs text-(--color-text-muted) font-medium ml-13">Manage your tables and live orders</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <div className="flex items-center bg-(--color-surface-soft) dark:bg-(--color-surface) p-1 rounded-xl border border-(--color-border) dark:border-(--color-border)">
              {['all', 'available', 'occupied'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-lg text-[11px] font-medium tracking-normal transition-all ${
                    statusFilter === f
                      ? 'bg-primary text-(--color-on-primary) shadow-sm'
                      : 'text-(--color-text-muted) hover:text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="h-12 w-px bg-(--color-surface-soft) dark:bg-(--color-surface) mx-2 hidden sm:block" />
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh"
              className="p-3 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted) hover:text-primary hover:bg-primary/10 transition-all border border-(--color-border) dark:border-(--color-border) disabled:opacity-50"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <div className="h-12 w-px bg-(--color-surface-soft) dark:bg-(--color-surface) mx-2 hidden sm:block" />
            <Button
              variant="outline"
              className="!rounded-xl text-[11px] font-medium tracking-normal"
              icon={Store}
              onClick={() => setShowBranchQr(true)}
            >
              Cafe QR
            </Button>
            <Button
              variant="outline"
              className="!rounded-xl text-[11px] font-medium tracking-normal"
              icon={QrCode}
              onClick={() => setShowBulkQr(true)}
            >
              Print QR
            </Button>
            <Button
              variant="outline"
              className="!rounded-xl text-[11px] font-medium tracking-normal"
              icon={Package}
              onClick={() => setShowStock(true)}
            >
              Stock
            </Button>
            {can(user, 'tables.add') && (
              <Button
                variant="primary"
                className="!rounded-xl shadow-sm bg-primary hover:bg-primary text-[11px] font-medium tracking-normal"
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
            )}
          </div>
        </div>

        <PendingApprovals branchId={branchId} />

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Tables', val: stats.total, color: 'amber', icon: Globe },
            { label: 'Occupied', val: stats.occupied, color: 'amber', icon: Zap },
            { label: "Today's Revenue", val: formatIndianCompact(stats.revenue, { currency: true }), color: 'emerald', icon: Receipt }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.05}>
              <div className="glass-morphism rounded-xl border border-(--color-border) dark:border-(--color-border) p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl ${toneSoft(stat.color)} flex items-center justify-center flex-shrink-0`}>
                  <stat.icon size={18} className={toneText(stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) leading-none">{stat.val}</p>
                  <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted) mt-0.5">{stat.label}</p>
                </div>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Table Grid */}
        <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface)/40  shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface-soft)/50">
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Table Info</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Status</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Capacity</th>
                <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-right">Actions</th>
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
                      className="group border-b border-(--color-border) hover:bg-primary/5 transition-all cursor-pointer"
                    >
                      <td className="px-5 py-4" onClick={() => handleOpenOrder(table)}>
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-semibold border transition-transform ${
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
                        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-normal border ${
                          table.status === 'available' ? 'bg-success/10 text-success border-success/20' : 'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${table.status === 'available' ? 'bg-success' : 'bg-primary'}`} />
                          {table.status}
                        </div>
                      </td>
                      <td className="px-5 py-4" onClick={() => handleOpenOrder(table)}>
                        <div className="flex items-center gap-2 text-(--color-text-primary)">
                          <Users size={14} className="text-(--color-text-muted)" />
                          <span className="text-sm font-medium">{table.capacity} Guests</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2 transition-opacity">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); setQrTable(table); }}
                            title="Table QR code"
                            className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
                          >
                            <QrCode size={18} />
                          </motion.button>
                          {table.status === 'available' ? (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleBookTable(table); }}
                              className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
                            >
                              <Check size={18} />
                            </motion.button>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleOpenOrder(table); }}
                              className="p-2.5 rounded-xl bg-success/10 text-success border border-success/20 hover:bg-success hover:text-white transition-all"
                            >
                              <ShoppingBag size={18} />
                            </motion.button>
                          )}
                          {table.status !== 'available' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleCancelTable(table); }}
                              title="Cancel & free table"
                              className="p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white transition-all"
                            >
                              <X size={18} />
                            </motion.button>
                          )}
                          {can(user, 'tables.modify') && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleEditTable(table); }}
                              className="p-2.5 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted) border border-(--color-border) dark:border-(--color-border) hover:text-primary transition-all"
                            >
                              <Edit3 size={18} />
                            </motion.button>
                          )}
                          {can(user, 'tables.delete') && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(table._id); }}
                              className="p-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white transition-all"
                            >
                              <Trash2 size={18} />
                            </motion.button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
              </AnimatePresence>
            </tbody>
          </table>
          {tables.length === 0 && (
            <div className="p-10 text-center text-(--color-text-muted)">
              <Globe size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium tracking-normal">No tables found</p>
            </div>
          )}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-16 glass-morphism rounded-xl border border-dashed border-(--color-border) dark:border-(--color-border)">
            <Globe size={36} className="mx-auto text-(--color-text-muted) dark:text-(--color-text-secondary) mb-3" strokeWidth={1.5} />
            <p className="text-(--color-text-muted) font-medium text-sm">No tables found</p>
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
              <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1">Table Number</label>
              <input
                required
                type="number"
                className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) focus:ring-2 focus:ring-primary p-5 text-sm font-medium dark:text-(--color-text-primary) outline-none transition-all"
                value={newTableNumber}
                onChange={e => setNewTableNumber(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1">Table Name</label>
              <input
                type="text"
                className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) focus:ring-2 focus:ring-primary p-5 text-sm font-medium dark:text-(--color-text-primary) outline-none transition-all"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="e.g. Window Corner, Poolside-1"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1">Seating Capacity</label>
              <input
                required
                type="number"
                min="1"
                className="w-full rounded-xl bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) focus:ring-2 focus:ring-primary p-5 text-sm font-medium dark:text-(--color-text-primary) outline-none transition-all"
                value={newTableCapacity}
                onChange={e => setNewTableCapacity(e.target.value)}
                placeholder="e.g. 4"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full !rounded-xl shadow-sm"
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
              <div className="lg:col-span-5 flex flex-col h-full bg-(--color-surface-soft) dark:bg-(--color-bg)/30 rounded-xl border border-(--color-border) dark:border-(--color-border) overflow-hidden">
                <div className="p-5 border-b border-(--color-border) dark:border-(--color-border) bg-gradient-to-br from-(--color-surface)/50 to-white dark:from-(--color-surface)/50 dark:to-(--color-surface)/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-medium text-primary uppercase tracking-normal flex items-center mb-1">
                        <ShoppingBag size={14} className="mr-2" /> Order Details
                      </h3>
                      <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Current Order</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">
                        {pendingOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0)}
                      </span>
                      <span className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">Items Added</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 p-5 bg-(--color-surface) dark:bg-(--color-surface) rounded-xl border border-(--color-border) dark:border-(--color-border) shadow-sm">
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-(--color-text-muted) tracking-normal ml-1 flex items-center gap-2">
                        Guest Name <span className="text-danger font-medium">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter name"
                        className="w-full bg-(--color-surface-soft) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) rounded-xl px-4 py-4 mt-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-(--color-text-muted) dark:text-white"
                        value={selectedTable.customerName || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                        Mobile <span className="text-danger font-medium">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit mobile"
                        className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl px-4 py-2.5 mt-1 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-(--color-text-muted)/30 text-(--color-text-primary)"
                        value={selectedTable.customerPhone || ''}
                        onChange={(e) => handleSyncOrders(pendingOrders, { customerPhone: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                      />
                      {customerHint && (
                        <p className="mt-1 text-[10px] font-bold text-primary">{customerHint}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                        Pay with
                      </label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {['CASH', 'UPI'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setOrderPaymentType(m)}
                            className={`py-2.5 rounded-xl text-[11px] font-bold transition-colors ${
                              orderPaymentType === m
                                ? 'bg-primary text-(--color-on-primary)'
                                : 'bg-(--color-bg-soft) text-(--color-text-muted) border border-(--color-border)'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
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
                      className="flex justify-between items-center bg-(--color-surface) dark:bg-(--color-surface) p-4 rounded-xl border border-(--color-border) dark:border-(--color-border) group hover:border-primary/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) dark:bg-(--color-surface) flex-shrink-0 overflow-hidden relative border border-(--color-border) dark:border-(--color-border)">
                          {order.image ? (
                            <img src={order.image} alt={order.itemName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)">
                              <Coffee size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-(--color-text-primary) dark:text-(--color-text-primary) line-clamp-1">{order.itemName}</div>
                          <div className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mt-0.5"><Money value={Number(order.price)} /> / unit</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-(--color-surface-soft) dark:bg-(--color-surface) rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-(--color-surface) dark:hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-all"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-medium text-(--color-text-primary) dark:text-(--color-text-primary)">{order.quantity}</span>
                          <button
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-(--color-surface) dark:hover:bg-(--color-surface-soft) text-(--color-text-muted) transition-all"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm font-semibold text-primary w-16 text-right">
                          <Money value={Number(order.quantity) * Number(order.price)} />
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
                      <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted)">No items added yet</p>
                    </div>
                  )}

                  {/* System Orders Section (OMS) */}
                  {(systemOrders.length > 0 || pendingOrders.length > 0) && (
                    <div className="mt-8 pt-8 border-t border-(--color-border) dark:border-(--color-border)">
                      <h3 className="text-[11px] font-medium text-primary uppercase tracking-normal mb-4 flex items-center gap-2">
                        <Zap size={14} /> Kitchen Queue
                      </h3>
                      <div className="space-y-3">
                        {systemOrders.length > 0 ? (
                          systemOrders.map((order) => (
                            <div key={order._id} className="bg-(--color-surface) dark:bg-(--color-surface) p-4 rounded-xl border border-(--color-border) dark:border-(--color-border) flex items-center justify-between group shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${order.status === 'COMPLETED' ? 'bg-success ' : 'bg-primary animate-pulse'}`} />
                                <div>
                                  <div className="text-[11px] font-medium text-(--color-text-primary) dark:text-(--color-text-primary) uppercase tracking-tight">#{order._id.slice(-6)}</div>
                                  <div className="text-[11px] font-medium text-(--color-text-muted) tracking-normal">{order.status}</div>
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
                                <div className="text-[11px] font-medium text-(--color-text-primary) dark:text-(--color-text-primary)"><Money value={Number(order.totalAmount)} /></div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-4 text-center text-[11px] font-medium tracking-normal text-(--color-text-muted)">No orders in the kitchen</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 border-t border-(--color-border) dark:border-(--color-border) bg-white/50 dark:bg-(--color-surface)/50 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">
                      <span>Subtotal</span>
                      <span><Money value={systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)} /></span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-[11px] font-medium uppercase tracking-normal text-success">
                        <span>Discount</span>
                        <span><Money value={discountAmount} prefix="-" /></span>
                      </div>
                    )}
                    <div className="h-px bg-(--color-surface-soft) dark:bg-(--color-surface) my-2" />
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-medium uppercase text-(--color-text-muted) tracking-normal mb-2">Total</span>
                      <span className="text-2xl font-semibold text-(--color-text-primary) dark:text-(--color-text-primary) tracking-tight">
                        <Money value={Math.max(0,
                          systemOrders.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0) - Number(discountAmount || 0)
                        )} />
                      </span>
                    </div>
                  </div>
                  <div className={`grid ${systemOrders.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <Button
                      variant="primary"
                      className="w-full !rounded-xl shadow-sm bg-primary hover:bg-primary text-[11px] font-medium tracking-normal"
                      icon={Zap}
                      onClick={handleSendToKitchen}
                      disabled={pendingOrders.length === 0}
                    >
                      Send to Kitchen
                    </Button>
                    {systemOrders.length > 0 && (
                      <Button
                        variant="primary"
                        className="w-full !rounded-xl shadow-sm bg-success hover:bg-success text-[11px] font-medium tracking-normal"
                        icon={Receipt}
                        onClick={() => {
                          const allReady = systemOrders.every(o => ['SERVED', 'COMPLETED'].includes(o.status));
                          if (!allReady && !window.confirm('Some orders on this table are not served yet. Forcefully complete them and finish the bill?')) return;
                          setForceBill(!allReady);
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

                {/* Most Selling / Recommendations */}
                {!menuSearch && (
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal flex items-center">
                      <Zap size={12} className="mr-2 text-primary" /> Best Selling Items
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                      {menuItems.slice(0, 4).map((item) => {
                        const { out, tracks, qty } = stockInfo(item);
                        return (
                        <div
                          key={item._id}
                          className={`flex-shrink-0 w-40 glass-morphism rounded-xl p-4 border border-(--color-border) dark:border-(--color-border) transition-all group ${out ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30 cursor-pointer'}`}
                          onClick={() => addItemToOrder(item)}
                        >
                          <div className="h-20 w-full rounded-xl overflow-hidden mb-3 bg-(--color-surface-soft) dark:bg-(--color-surface) relative">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)"><Coffee size={24} /></div>
                            )}
                            <div className="absolute top-2 left-2">
                               <div className={`w-3 h-3 rounded-full border-2 border-(--color-border) dark:border-(--color-border) ${item.dietaryType === 'veg' ? 'bg-success ' : 'bg-danger '}`} />
                            </div>
                            {out ? (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-[11px] font-medium uppercase tracking-normal text-white bg-danger/90 px-2 py-1 rounded-md">Out of stock</span>
                              </div>
                            ) : (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <Plus className="text-white" size={24} />
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-(--color-text-primary) dark:text-(--color-text-primary) truncate">{item.name}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-[11px] font-semibold text-primary"><Money value={Number(item.discountedPrice || item.price)} /></div>
                            {tracks && (
                              <span className={`text-[11px] font-medium tracking-normal ${qty <= 0 ? 'text-danger' : qty < 10 ? 'text-warning' : 'text-success'}`}>
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

                {/* Main Menu Grid */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <h3 className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal">Full Menu</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {menuItems
                      .filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase()))
                      .map((item) => {
                        const { out, tracks, qty } = stockInfo(item);
                        return (
                        <div
                          key={item._id}
                          onClick={() => addItemToOrder(item)}
                          className={`bg-(--color-surface) dark:bg-(--color-surface)/50 p-3 rounded-xl border border-(--color-border) dark:border-(--color-border) transition-all flex items-center gap-3 group ${out ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/20 cursor-pointer'}`}
                        >
                          <div className="h-10 w-10 rounded-lg bg-(--color-surface-soft) dark:bg-(--color-surface) flex-shrink-0 overflow-hidden relative">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)">
                                <Coffee size={14} />
                              </div>
                            )}
                            <div className="absolute top-1 left-1">
                               <div className={`w-2 h-2 rounded-full border border-(--color-border) dark:border-(--color-border) ${item.dietaryType === 'veg' ? 'bg-success' : 'bg-danger'}`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium text-(--color-text-primary) dark:text-(--color-text-primary) leading-tight truncate">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-semibold text-primary"><Money value={Number(item.discountedPrice || item.price)} /></span>
                              {tracks && (
                                <span className={`text-[11px] font-medium tracking-normal ${qty <= 0 ? 'text-danger' : qty < 10 ? 'text-warning' : 'text-success'}`}>
                                  · {qty <= 0 ? 'Out of stock' : `${qty} left`}
                                </span>
                              )}
                              {!tracks && item.isAvailable === false && (
                                <span className="text-[11px] font-medium tracking-normal text-danger">· Unavailable</span>
                              )}
                            </div>
                          </div>
                          <div className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all ${out ? 'bg-danger/10 text-danger' : 'bg-(--color-surface-soft) dark:bg-(--color-surface) text-(--color-text-muted) group-hover:bg-primary group-hover:text-white'}`}>
                            {out ? <X size={12} /> : <Plus size={12} />}
                          </div>
                        </div>
                        );
                      })}
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
                          placeholder="Enter code"
                          className="flex-1 bg-(--color-surface) dark:bg-(--color-bg) border border-(--color-border) dark:border-(--color-border) rounded-xl px-4 py-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="px-6 bg-primary text-(--color-on-primary) rounded-xl text-[11px] font-medium tracking-normal hover:bg-(--color-primary-hover) transition-all"
                        >
                          Verify
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

        <TableQRModal isOpen={!!qrTable} onClose={() => setQrTable(null)} table={qrTable} branchName={qrTable?.locationId?.name || branchName} />
        <TableQRBulkModal isOpen={showBulkQr} onClose={() => setShowBulkQr(false)} tables={tables} branchName={branchName} />
        <BranchQRModal isOpen={showBranchQr} onClose={() => setShowBranchQr(false)} branchId={branchId !== 'All' ? branchId : undefined} branchName={branchName} />
        <StockManager isOpen={showStock} onClose={() => setShowStock(false)} branchId={branchId} branchName={branchName} menuHref="/dashboard/branch-admin/menu" />
      </div>
    </PageTransition>
  );
}
