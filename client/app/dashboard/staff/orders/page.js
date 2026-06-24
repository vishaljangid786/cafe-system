'use client';
import { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, Search, Plus, Filter, Clock, 
  CheckCircle2, XCircle, AlertCircle, Utensils,
  ChevronRight, ArrowRight, MessageSquare,
  Globe, User, Calendar, Hash, Loader2, Play,
  RefreshCcw, Coffee, Zap, TrendingUp, Activity,
  LayoutGrid, List as ListIcon, CalendarDays,
  Receipt, Wallet, History, MapPin, IndianRupee,
  Layers, Settings2, Sparkles, FilterX
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import { toneText, toneBg, toneSoft, toneBorder } from '../../../components/ui/tone';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import getSocketUrl from '../../../services/socketUrl';
import Modal from '../../../components/ui/Modal';
import { formatDistanceToNow } from 'date-fns';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import UniversalDateFilter from '../../../components/ui/UniversalDateFilter';

const SOCKET_URL = getSocketUrl();

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue: 'bg-primary/10 text-primary border-primary/20 ',
    emerald: 'bg-success/10 text-success border-success/20 ',
    amber: 'bg-warning/10 text-warning border-warning/20 ',
    indigo: 'bg-primary/10 text-primary border-primary/20 '
  };

  return (
    <CardHover>
      <div className="bg-(--color-surface) p-6 rounded-xl border border-(--color-border) shadow-sm h-full flex flex-col items-center text-center group">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center border mb-4 transition-transform duration-500 ${colors[color]}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <p className="text-[28px] font-bold text-(--color-text-primary) tracking-tight leading-none mb-1">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">{label}</p>
      </div>
    </CardHover>
  );
}

export default function StaffOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('branch'); // 'my' or 'branch'
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [orderType, setOrderType] = useState('dine-in'); // dine-in | takeaway | delivery
  const [stagedItems, setStagedItems] = useState([]);
  const [modifierItem, setModifierItem] = useState(null); // item being customized
  const [modSel, setModSel] = useState({}); // { groupName: { label: true } }
  const [menuSearch, setMenuSearch] = useState('');
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'

  const fetchStats = useCallback(async () => {
    if (!['staff', 'branch_admin'].includes(user?.role)) return;
    try {
      const res = await api.get('/orders/my-stats-staff');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('Stats sync fail');
    }
  }, [user]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const branchId = user?.assignedLocation?._id || user?.assignedLocation;
      
      let query = `?startDate=${startDate}&endDate=${endDate}&page=${currentPage}&limit=${itemsPerPage}`;
      if (filterType === 'branch' && branchId) query += `&branchId=${branchId}`;
      
      const endpoint = (filterType === 'my' && ['staff', 'branch_admin'].includes(user?.role))
        ? `/orders/my-stats-staff${query}` 
        : `/orders${query}`;
      
      const res = await api.get(endpoint);
      if (res.data.success) {
        if (filterType === 'my') {
          setOrders(res.data.data?.recentOrders || []);
          setTotalPages(1);
        } else {
          setOrders(res.data.data || []);
          setTotalPages(res.data.pagination?.pages || 1);
        }
      }
    } catch (error) {
      console.error('Order sync error:', error);
    } finally {
      setLoading(false);
    }
  }, [user, filterType, startDate, endDate, currentPage]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      if (res.data.success) setCategories(res.data.data);
    } catch (error) {}
  }, []);

  const fetchDataForCreation = useCallback(async () => {
    try {
      const branchId = user?.assignedLocation?._id || user?.assignedLocation;
      const [tableRes, menuRes] = await Promise.all([
        api.get(`/tables?locationId=${branchId}`),
        api.get('/menu')
      ]);
      setTables(tableRes.data.data);
      setMenuItems(menuRes.data.data);
    } catch (error) {
      toast.error('Could not load tables and menu. Please try again.');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchStats();
      fetchCategories();
    }
  }, [user, fetchOrders, fetchStats, fetchCategories]);

  useEffect(() => {
    if (showCreateModal) fetchDataForCreation();
  }, [showCreateModal, fetchDataForCreation]);

  useEffect(() => {
    if (!user) return;
    if (!SOCKET_URL) return;

    const socket = io(SOCKET_URL, { withCredentials: true });
    socket.on('connect', () => {
      socket.emit('join_session', { branchId: user.assignedLocation?._id || user.assignedLocation });
    });
    socket.on('order:ready', (data) => {
      toast.success(data.message, { icon: '🚀', duration: 8000 });
      fetchOrders();
    });
    socket.on('order:update', () => fetchOrders());
    socket.on('order:cancel', () => fetchOrders());
    socket.on('order:note', () => fetchOrders());
    return () => socket.close();
  }, [user, fetchOrders]);

  const handleCreateOrder = async () => {
    if (orderType === 'dine-in' && !selectedTable) return toast.error('Please select a table');
    if (stagedItems.length === 0) return toast.error('Please add items to the order');

    const loadToast = toast.loading('Sending order to kitchen...');
    try {
      const branchId = user?.assignedLocation?._id || user?.assignedLocation;
      const totalAmount = stagedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      const payload = {
        branch: branchId,
        orderType,
        items: stagedItems.map(i => ({
          menuItem: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes,
          modifiers: i.modifiers || []
        })),
        totalAmount
      };
      // Table only applies to dine-in; takeaway/delivery have no table.
      if (orderType === 'dine-in') payload.table = selectedTable._id;

      await api.post('/orders', payload);
      toast.success('Order placed successfully', { id: loadToast });
      setShowCreateModal(false);
      setStagedItems([]);
      setSelectedTable(null);
      setOrderType('dine-in');
      fetchOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not place the order. Please try again.', { id: loadToast });
    }
  };

  const addToStage = (item) => {
    // Items with customizations open a picker first; the result is added as its own
    // line (different option combos are distinct line items).
    if (Array.isArray(item.modifierGroups) && item.modifierGroups.length > 0) {
      setModSel({});
      setModifierItem(item);
      return;
    }
    const existing = stagedItems.findIndex(i => i.menuItemId === item._id && (!i.modifiers || i.modifiers.length === 0));
    if (existing > -1) {
      const newItems = [...stagedItems];
      newItems[existing].quantity += 1;
      setStagedItems(newItems);
    } else {
      setStagedItems([...stagedItems, {
        menuItemId: item._id,
        name: item.name,
        price: item.discountedPrice || item.price,
        quantity: 1,
        notes: '',
        modifiers: []
      }]);
    }
    toast.success(`Added ${item.name}`, { duration: 1000 });
  };

  const toggleMod = (group, label) => {
    setModSel(prev => {
      if (group.selectionType === 'single') {
        return { ...prev, [group.name]: { [label]: true } };
      }
      const cur = { ...(prev[group.name] || {}) };
      cur[label] = !cur[label];
      return { ...prev, [group.name]: cur };
    });
  };

  const confirmModifiers = () => {
    const item = modifierItem;
    if (!item) return;
    const modifiers = [];
    let delta = 0;
    for (const g of item.modifierGroups) {
      const chosen = Object.entries(modSel[g.name] || {}).filter(([, v]) => v).map(([l]) => l);
      if (g.required && chosen.length === 0) return toast.error(`Please choose ${g.name}`);
      if (g.selectionType === 'multiple' && g.maxSelections > 0 && chosen.length > g.maxSelections) {
        return toast.error(`Pick at most ${g.maxSelections} for ${g.name}`);
      }
      for (const label of chosen) {
        const opt = g.options.find(o => o.label === label);
        if (!opt) continue;
        const d = Number(opt.priceDelta) || 0;
        modifiers.push({ groupName: g.name, label: opt.label, priceDelta: d });
        delta += d;
      }
    }
    const base = item.discountedPrice || item.price;
    setStagedItems(prev => [...prev, {
      menuItemId: item._id,
      name: item.name,
      price: Math.max(0, base + delta),
      quantity: 1,
      notes: '',
      modifiers
    }]);
    toast.success(`Added ${item.name}`, { duration: 1000 });
    setModifierItem(null);
    setModSel({});
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.table?.tableNumber?.toString().includes(searchTerm) ||
      order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some(item => 
        (item.menuItem?.name || item.itemName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesCategory = selectedCategory === 'all' || 
      order.items.some(item => (item.menuItem?.category?._id || item.menuItem?.category) === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
           <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm ">
                <ShoppingBag size={36} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-(--color-text-primary) leading-none mb-2">
                  Orders <span className="text-primary">Center</span>
                </h1>
                <div className="flex items-center gap-3">
                   <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-full border border-primary/20 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Live Updates On
                   </div>
                   <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">{user?.assignedLocation?.name} Branch</p>
                </div>
              </div>
           </div>

           <div className="flex items-center gap-4 bg-(--color-surface) p-2 rounded-xl border border-(--color-border) shadow-sm /[0.03]">
              <div className="flex p-1 bg-(--color-surface-soft) rounded-xl border border-(--color-border)">
                 <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-(--color-surface) dark:bg-(--color-surface) text-primary shadow-md' : 'text-(--color-text-muted) hover:text-primary'}`}
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-(--color-surface) dark:bg-(--color-surface) text-primary shadow-md' : 'text-(--color-text-muted) hover:text-primary'}`}
                >
                  <ListIcon size={20} />
                </button>
              </div>
              <div className="h-10 w-px bg-(--color-border)" />
              <button 
                onClick={() => { fetchOrders(); fetchStats(); toast.success('Refreshing orders...'); }}
                className="h-14 w-14 flex items-center justify-center bg-(--color-surface-soft) rounded-xl border border-(--color-border) hover:border-primary/30 transition-all text-(--color-text-muted) hover:text-primary shadow-sm"
              >
                <RefreshCcw size={22} className={loading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="h-14 px-10 bg-primary hover:bg-primary text-white font-bold text-xs uppercase tracking-normal rounded-[1.5rem] transition-all shadow-sm  flex items-center gap-3 active:scale-95"
              >
                <Plus size={22} strokeWidth={3} /> New Order
              </button>
           </div>
        </div>

        {/* Filters (Filters Redesigned) */}
        <div className="relative">
           <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/20 hidden opacity-20 -z-10 rounded-xl" />
           <div className="bg-(--color-surface) p-2 rounded-xl border border-(--color-border) shadow-sm space-y-2">
              {/* Row 1: The Core Toggles */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                 {/* Sector Toggle */}
                 <div className="lg:col-span-3 bg-(--color-surface-soft) rounded-xl p-1.5 flex items-center gap-1 border border-(--color-border)">
                    <button 
                      onClick={() => setFilterType('branch')}
                      className={`flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all flex items-center justify-center gap-3 ${filterType === 'branch' ? 'bg-(--color-surface) dark:bg-(--color-surface) text-primary shadow-lg' : 'text-(--color-text-muted) hover:text-primary'}`}
                    >
                      <Globe size={16} /> Branch
                    </button>
                    <button 
                      onClick={() => setFilterType('my')}
                      className={`flex-1 h-12 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all flex items-center justify-center gap-3 ${filterType === 'my' ? 'bg-(--color-surface) dark:bg-(--color-surface) text-primary shadow-lg' : 'text-(--color-text-muted) hover:text-primary'}`}
                    >
                      <User size={16} /> Personal
                    </button>
                 </div>

                 {/* Omni Search Terminal */}
                 <div className="lg:col-span-6 bg-(--color-surface-soft) rounded-xl flex items-center px-8 border border-(--color-border) group focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                    <Search className="text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={20} />
                    <input 
                      type="text"
                      placeholder="SEARCH BY TABLE, ORDER ID OR ITEM..."
                      className="w-full bg-transparent px-6 py-5 text-[11px] font-bold uppercase tracking-normal outline-none text-(--color-text-primary) placeholder:text-(--color-text-muted)/50"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>

                 {/* Category Matrix */}
                 <div className="lg:col-span-3 bg-(--color-surface-soft) rounded-xl p-1.5 border border-(--color-border) flex items-center">
                    <div className="w-full">
                       <PremiumSelect 
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        options={[
                          { label: 'ALL CATEGORIES', value: 'all' },
                          ...categories.map(cat => ({ label: cat.name.toUpperCase(), value: cat._id }))
                        ]}
                      />
                    </div>
                 </div>
              </div>

              {/* Row 2: Temporal & Status Bar */}
              <div className="flex flex-col md:flex-row items-center gap-2">
                 <div className="flex-1 bg-(--color-surface-soft) rounded-xl px-8 py-4 border border-(--color-border) flex items-center justify-between group overflow-hidden relative">
                    <div className="flex items-center gap-6 relative z-10">
                       <UniversalDateFilter
                        onFilterChange={({ startDate, endDate }) => { setStartDate(startDate); setEndDate(endDate); }}
                        loading={loading}
                        variant="ghost"
                      />
                    </div>
                    
                    <div className="flex items-center gap-6 relative z-10">
                       <div className="h-6 w-px bg-(--color-border)" />
                       <p className="text-[10px] font-bold text-primary uppercase tracking-normal flex items-center gap-2">
                          <Activity size={14} className="animate-pulse" />
                          {filteredOrders.length} ORDERS FOUND
                       </p>
                    </div>

                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-primary/5 to-transparent -z-0" />
                 </div>

                 <button 
                  onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setStartDate(''); setEndDate(''); }}
                  className="h-15 px-8 bg-(--color-surface-soft) hover:bg-danger/10 hover:text-danger hover:border-danger/30 rounded-xl border border-(--color-border) text-(--color-text-muted) font-bold text-[10px] uppercase tracking-normal transition-all flex items-center gap-3 group shrink-0"
                 >
                    <FilterX size={18} className="group-hover:rotate-12 transition-transform" /> Clear Filters
                 </button>
              </div>
           </div>
        </div>

        {/* Analytics Hub */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard label="Total Handled" value={stats.totalOrders} icon={ShoppingBag} color="blue" />
            <StatCard label="Placed by Me" value={stats.createdCount} icon={Plus} color="indigo" />
            <StatCard label="Served by Me" value={stats.servedCount} icon={CheckCircle2} color="emerald" />
            <StatCard
              label="In Progress"
              value={orders.filter(o => !['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status)).length} 
              icon={Clock} 
              color="amber" 
            />
          </div>
        )}

        {/* Orders View */}
        <div className={viewMode === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8" : "space-y-6"}>
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => (
              <motion.div
                key={order._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={() => openOrderDetail(order)}
                className="cursor-pointer"
              >
                {viewMode === 'grid' ? (
                  <StaffOrderCard order={order} onRefresh={fetchOrders} />
                ) : (
                  <StaffOrderListRow order={order} onRefresh={fetchOrders} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {!loading && filteredOrders.length === 0 && (
            <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-(--color-border) rounded-xl opacity-30">
              <Utensils size={48} strokeWidth={1} className="mb-4" />
              <p className="text-[10px] font-bold uppercase tracking-normal text-center">No orders found here</p>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Order Details #${selectedOrder?._id.slice(-6).toUpperCase()}`}
          maxWidth="max-w-4xl"
        >
          {selectedOrder && (
            <div className="p-8 space-y-10">
              <div className="flex flex-col md:flex-row justify-between gap-10">
                <div className="space-y-6 flex-1">
                  <div className="flex items-center gap-6">
                    <div className="h-20 w-20 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shadow-lg ">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Table</span>
                      <span className="text-3xl font-bold text-(--color-text-primary)">{selectedOrder.table?.tableNumber || '??'}</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-(--color-text-primary) mb-1">
                        Order <span className="text-primary">Details</span>
                      </h2>
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                         <Clock size={14} className="text-warning" /> {new Date(selectedOrder.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-(--color-surface-soft) rounded-xl border border-(--color-border)">
                      <p className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Status</p>
                      <p className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-normal">
                        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        {selectedOrder.status}
                      </p>
                    </div>
                    <div className="p-5 bg-(--color-surface-soft) rounded-xl border border-(--color-border)">
                      <p className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Amount</p>
                      <p className="text-sm font-bold text-success flex items-center gap-1">
                        <IndianRupee size={14} /> {selectedOrder.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-80 space-y-4">
                   <div className="p-6 bg-(--color-text-primary) text-(--color-surface) rounded-xl shadow-sm space-y-4 relative overflow-hidden">
                      <Receipt className="absolute -right-4 -bottom-4 opacity-10" size={100} />
                      <h4 className="text-[10px] font-bold uppercase tracking-normal opacity-60">Order Info</h4>
                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-normal">
                           <span className="opacity-60 flex items-center gap-2"><User size={12} /> Staff</span>
                           <span>{selectedOrder.createdBy?.name || 'Automatic'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-normal">
                           <span className="opacity-60 flex items-center gap-2"><Utensils size={12} /> Chef</span>
                           <span>{selectedOrder.assignedChef?.name || 'Not assigned yet'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-normal">
                           <span className="opacity-60 flex items-center gap-2"><MapPin size={12} /> Branch</span>
                           <span>{selectedOrder.branch?.name || 'Local'}</span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-(--color-surface-soft) p-5 rounded-xl border border-(--color-border) flex justify-between items-center group">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-success ' : 'bg-danger '}`} />
                        <div>
                          <p className="text-sm font-bold text-(--color-text-primary)">{item.menuItem?.name || item.itemName}</p>
                          {item.notes && <p className="text-[10px] font-bold text-primary italic mt-0.5">&quot;{item.notes}&quot;</p>}
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-bold text-primary uppercase">{item.quantity} Unit(s)</p>
                         <p className="text-[10px] font-bold text-(--color-text-muted) mt-0.5">₹{item.price} each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Create Order Modal */}
        <Modal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)}
          title="New Order"
          maxWidth="max-w-7xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[85vh] overflow-hidden p-4">
            <div className="lg:col-span-5 flex flex-col h-full bg-(--color-surface-soft) rounded-xl border border-(--color-border) overflow-hidden shadow-inner">
              <div className="p-8 border-b border-(--color-border)">
                {/* Order type: dine-in needs a table; takeaway/delivery don't. */}
                <h3 className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-3">Order Type</h3>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { v: 'dine-in', label: 'Dine-in' },
                    { v: 'takeaway', label: 'Takeaway' },
                    { v: 'delivery', label: 'Delivery' },
                  ].map((t) => (
                    <button
                      key={t.v}
                      onClick={() => { setOrderType(t.v); if (t.v !== 'dine-in') setSelectedTable(null); }}
                      className={`py-2.5 rounded-xl border-2 font-bold text-[10px] uppercase tracking-normal transition-all ${orderType === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:border-primary/30'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {orderType === 'dine-in' ? (
                  <>
                    <h3 className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-6">Select Table</h3>
                    <div className="grid grid-cols-4 gap-4">
                      {tables.map(table => (
                        <button
                          key={table._id}
                          onClick={(e) => { e.stopPropagation(); setSelectedTable(table); }}
                          className={`h-14 rounded-xl border-2 font-bold text-xs transition-all shadow-sm ${selectedTable?._id === table._id ? 'border-primary bg-primary/10 text-primary ' : 'border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:border-primary/30'}`}
                        >
                          T{table.tableNumber}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] font-medium text-(--color-text-muted) bg-(--color-surface) border border-(--color-border) rounded-xl px-4 py-3">
                    {orderType === 'takeaway' ? 'Takeaway' : 'Delivery'} order — no table needed. Add items and send to kitchen.
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                <h3 className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-4">Items Added</h3>
                <AnimatePresence>
                  {stagedItems.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-(--color-surface) p-5 rounded-xl border border-(--color-border) flex justify-between items-center group shadow-sm hover:shadow-md transition-all"
                    >
                      <div>
                        <p className="text-xs font-bold text-(--color-text-primary)">{item.name}</p>
                        {item.modifiers?.length > 0 && (
                          <p className="text-[9px] font-medium text-(--color-text-muted) mt-0.5">{item.modifiers.map(m => m.label).join(', ')}</p>
                        )}
                        <p className="text-[10px] font-bold text-success uppercase tracking-normal mt-1">₹{item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-(--color-surface-soft) rounded-xl p-1.5 border border-(--color-border)">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newItems = [...stagedItems];
                              if (newItems[idx].quantity > 1) newItems[idx].quantity -= 1;
                              else newItems.splice(idx, 1);
                              setStagedItems(newItems);
                            }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-(--color-surface) dark:hover:bg-(--color-surface) text-(--color-text-muted) transition-colors"
                          >-</button>
                          <span className="w-10 text-center text-[10px] font-bold text-(--color-text-primary)">{item.quantity}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newItems = [...stagedItems];
                              newItems[idx].quantity += 1;
                              setStagedItems(newItems);
                            }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-(--color-surface) dark:hover:bg-(--color-surface) text-(--color-text-muted) transition-colors"
                          >+</button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="p-10 border-t border-(--color-border) bg-(--color-surface) space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-(--color-text-muted) tracking-normal mb-1">Estimated Total</p>
                    <p className="text-4xl font-bold tracking-tight text-(--color-text-primary)">₹{stagedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCreateOrder(); }}
                  className="w-full py-6 bg-primary hover:bg-primary text-white font-bold text-xs uppercase tracking-normal rounded-xl shadow-sm  transition-all active:scale-95 flex items-center justify-center gap-4"
                >
                  <Play size={16} fill="currentColor" /> Send to Kitchen
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-8 pr-4">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={22} />
                <input 
                  type="text"
                  placeholder="Search menu items..."
                  className="w-full pl-16 pr-8 py-5 bg-(--color-surface) border border-(--color-border) focus:ring-4 focus:ring-primary/10 rounded-xl text-xs font-bold uppercase tracking-normal outline-none transition-all shadow-sm"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                  {menuItems.filter(i => i.name.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                    <div 
                      key={item._id}
                      onClick={(e) => { e.stopPropagation(); addToStage(item); }}
                      className="bg-(--color-surface) p-4 rounded-xl border border-(--color-border) hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden shadow-sm hover:shadow-sm"
                    >
                      <div className="h-32 w-full rounded-xl bg-(--color-surface-soft) mb-4 overflow-hidden relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-1000" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-(--color-text-muted)"><Coffee size={24} /></div>
                        )}
                      </div>
                      <div className="px-2">
                        <h4 className="text-[11px] font-bold text-(--color-text-primary) truncate uppercase tracking-tight">{item.name}</h4>
                        <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-normal">₹{item.discountedPrice || item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>

        {/* Modifier / customization picker */}
        <Modal isOpen={!!modifierItem} onClose={() => { setModifierItem(null); setModSel({}); }} title={modifierItem ? `Customize ${modifierItem.name}` : ''} maxWidth="max-w-md">
          {modifierItem && (
            <div className="space-y-6">
              {modifierItem.modifierGroups.map((g, gi) => (
                <div key={gi} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-normal text-(--color-text-primary)">{g.name}</p>
                    <p className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                      {g.required ? 'Required · ' : ''}{g.selectionType === 'single' ? 'Pick one' : `Pick ${g.maxSelections > 0 ? `up to ${g.maxSelections}` : 'any'}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {g.options.map((o, oi) => {
                      const on = !!(modSel[g.name] && modSel[g.name][o.label]);
                      return (
                        <button
                          key={oi}
                          onClick={() => toggleMod(g, o.label)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${on ? 'bg-primary/10 border-primary text-primary' : 'bg-(--color-surface-soft) border-(--color-border) text-(--color-text-primary) hover:border-primary/40'}`}
                        >
                          <span className="flex items-center gap-2">
                            {on && <CheckCircle2 size={15} />}
                            {o.label}
                          </span>
                          {o.priceDelta !== 0 && <span className="text-xs">{o.priceDelta > 0 ? '+' : ''}₹{o.priceDelta}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={confirmModifiers}
                className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-(--color-on-primary) text-[11px] font-bold uppercase tracking-normal rounded-xl hover:opacity-90"
              >
                <Plus size={15} /> Add to order
              </button>
            </div>
          )}
        </Modal>
      </div>
    </PageTransition>
  );
}

function StaffOrderCard({ order, onRefresh }) {
  const [isServing, setIsServing] = useState(false);
  const statusConfig = {
    'PLACED': { color: 'amber', icon: AlertCircle, label: 'Waiting for Kitchen' },
    'ACCEPTED': { color: 'blue', icon: Play, label: 'Order Accepted' },
    'PREPARING': { color: 'indigo', icon: Utensils, label: 'Being Prepared' },
    'READY': { color: 'emerald', icon: CheckCircle2, label: 'Ready to Serve' },
    'SERVED': { color: 'zinc', icon: CheckCircle2, label: 'Served' },
    'CANCELLED': { color: 'rose', icon: XCircle, label: 'Cancelled' },
    'REJECTED': { color: 'rose', icon: XCircle, label: 'Rejected by Chef' }
  };

  const config = statusConfig[order.status] || statusConfig['PLACED'];
  const timeElapsed = formatDistanceToNow(new Date(order.createdAt));

  return (
    <div className="bg-(--color-surface) border border-(--color-border) p-8 rounded-xl shadow-sm hover:shadow-sm transition-all relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <ShoppingBag size={120} strokeWidth={1} />
      </div>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-[1.5rem] bg-(--color-surface-soft) flex flex-col items-center justify-center border border-(--color-border) shadow-inner">
            <span className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-tight">Table</span>
            <span className="text-2xl font-bold text-(--color-text-primary)">{order.table?.tableNumber || '??'}</span>
          </div>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-normal ${toneText(config.color)} flex items-center gap-2`}>
              <div className={`w-2 h-2 rounded-full bg-current ${order.status === 'PREPARING' ? 'animate-pulse' : ''}`} />
              {config.label}
            </div>
            <p className="text-[10px] font-bold text-(--color-text-muted) mt-1.5 uppercase tracking-normal flex items-center gap-1.5">
              <Clock size={12} /> {timeElapsed} ago
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal opacity-40">#{order._id.slice(-6)}</p>
        </div>
      </div>
      <div className="space-y-3 mb-8 relative z-10 bg-(--color-surface-soft) p-5 rounded-xl border border-(--color-border) shadow-inner">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-center group/item text-[11px] font-bold text-(--color-text-primary)">
            <span><span className="text-primary mr-1">{item.quantity}×</span> {item.menuItem?.name || item.itemName}</span>
          </div>
        ))}
      </div>
      {order.status === 'READY' && (
        <button 
          disabled={isServing}
          onClick={async (e) => {
            e.stopPropagation();
            setIsServing(true);
            try {
              await api.patch(`/orders/${order._id}/serve`);
              toast.success('Order served');
              onRefresh();
            } catch (err) { toast.error('Could not mark as served. Please try again.'); }
            finally { setIsServing(false); }
          }}
          className="w-full py-5 bg-success hover:bg-success text-white font-bold text-[10px] uppercase tracking-normal rounded-xl shadow-sm  transition-all active:scale-95 relative z-20"
        >
          Mark as Served
        </button>
      )}
    </div>
  );
}

function StaffOrderListRow({ order, onRefresh }) {
  const [isServing, setIsServing] = useState(false);
  const statusConfig = {
    'PLACED': { color: 'amber', icon: AlertCircle, label: 'WAITING' },
    'ACCEPTED': { color: 'blue', icon: Play, label: 'ACCEPTED' },
    'PREPARING': { color: 'indigo', icon: Utensils, label: 'PREPARING' },
    'READY': { color: 'emerald', icon: CheckCircle2, label: 'READY' },
    'SERVED': { color: 'zinc', icon: CheckCircle2, label: 'SERVED' },
    'CANCELLED': { color: 'rose', icon: XCircle, label: 'CANCELLED' },
    'REJECTED': { color: 'rose', icon: XCircle, label: 'REJECTED' }
  };
  const config = statusConfig[order.status] || statusConfig['PLACED'];
  const timeElapsed = formatDistanceToNow(new Date(order.createdAt));

  return (
    <div className="bg-(--color-surface) border border-(--color-border) p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-sm transition-all relative overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center gap-6 w-full md:w-auto">
        <div className="h-16 w-16 rounded-xl bg-(--color-surface-soft) flex flex-col items-center justify-center border border-(--color-border) shrink-0 shadow-inner">
          <span className="text-[8px] font-bold text-(--color-text-muted) uppercase tracking-tight">Table</span>
          <span className="text-xl font-bold text-(--color-text-primary)">{order.table?.tableNumber || '??'}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <p className="text-xs font-bold text-(--color-text-primary) tracking-tight">Order #{order._id.slice(-6).toUpperCase()}</p>
            <div className={`px-3 py-1 rounded-full ${toneSoft(config.color)} ${toneText(config.color)} text-[8px] font-bold uppercase tracking-normal border ${toneBorder(config.color)}`}>
              {config.label}
            </div>
          </div>
          <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5">
            <Clock size={12} className="text-primary/50" /> {timeElapsed} ago
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl px-6">
        {order.items.map((item, i) => (
          <div key={i} className="px-3 py-1.5 bg-(--color-surface-soft) rounded-xl border border-(--color-border) text-[9px] font-bold text-(--color-text-primary) uppercase tracking-tight flex items-center gap-2">
            <span className="text-primary">{item.quantity}×</span> {item.menuItem?.name || item.itemName}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
        <div className="text-right">
          <p className="text-[8px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Subtotal</p>
          <p className="text-xl font-bold text-(--color-text-primary) tracking-tight">₹{order.totalAmount.toLocaleString()}</p>
        </div>
        
        {order.status === 'READY' ? (
          <button 
            disabled={isServing}
            onClick={async (e) => {
              e.stopPropagation();
              setIsServing(true);
              try {
                await api.patch(`/orders/${order._id}/serve`);
                toast.success('Order served');
                onRefresh();
              } catch (err) { toast.error('Could not mark as served. Please try again.'); }
              finally { setIsServing(false); }
            }}
            className="h-12 px-8 bg-success hover:bg-success text-white font-bold text-[9px] uppercase tracking-normal rounded-xl shadow-lg  flex items-center gap-2 transition-all active:scale-95 relative z-20"
          >
            <CheckCircle2 size={14} /> Mark Served
          </button>
        ) : (
          <div className="h-12 w-12 rounded-xl bg-(--color-surface-soft) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) hover:text-primary transition-colors">
            <ChevronRight size={18} />
          </div>
        )}
      </div>
    </div>
  );
}
