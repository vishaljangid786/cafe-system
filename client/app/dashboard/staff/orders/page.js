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
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import Modal from '../../../components/ui/Modal';
import { formatDistanceToNow } from 'date-fns';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import UniversalDateFilter from '../../../components/ui/UniversalDateFilter';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/10',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-indigo-500/10'
  };

  return (
    <CardHover>
      <div className="bg-[var(--color-surface)] p-6 rounded-[2.5rem] border border-[var(--color-border)] shadow-sm h-full flex flex-col items-center text-center group">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border mb-4 transition-transform group-hover:scale-110 duration-500 ${colors[color]}`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <p className="text-[28px] font-black text-[var(--color-text-primary)] tracking-tighter leading-none mb-1">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{label}</p>
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
  const [stagedItems, setStagedItems] = useState([]);
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
      toast.error('Failed to load operational data');
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
    if (!selectedTable) return toast.error('Select a table');
    if (stagedItems.length === 0) return toast.error('Add items to order');

    const loadToast = toast.loading('Transmitting order to kitchen...');
    try {
      const branchId = user?.assignedLocation?._id || user?.assignedLocation;
      const totalAmount = stagedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      
      const payload = {
        branch: branchId,
        table: selectedTable._id,
        items: stagedItems.map(i => ({
          menuItem: i.menuItemId,
          quantity: i.quantity,
          notes: i.notes
        })),
        totalAmount
      };

      await api.post('/orders', payload);
      toast.success('Order placed successfully', { id: loadToast });
      setShowCreateModal(false);
      setStagedItems([]);
      setSelectedTable(null);
      fetchOrders();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Placement failed', { id: loadToast });
    }
  };

  const addToStage = (item) => {
    const existing = stagedItems.findIndex(i => i.menuItemId === item._id);
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
        notes: ''
      }]);
    }
    toast.success(`Added ${item.name}`, { duration: 1000 });
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
        {/* Cinematic Navigation Hub */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
           <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white shadow-2xl shadow-blue-600/30">
                <ShoppingBag size={36} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-[var(--color-text-primary)] leading-none mb-2">
                  Dispatch <span className="text-blue-500">Center</span>
                </h1>
                <div className="flex items-center gap-3">
                   <div className="px-3 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-blue-500/20 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Live Feed Active
                   </div>
                   <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">{user?.assignedLocation?.name} Branch Sector</p>
                </div>
              </div>
           </div>

           <div className="flex items-center gap-4 bg-[var(--color-surface)] p-2 rounded-[2.5rem] border border-[var(--color-border)] shadow-xl shadow-blue-500/[0.03]">
              <div className="flex p-1 bg-[var(--color-surface-soft)] rounded-2xl border border-[var(--color-border)]">
                 <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-md' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-md' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
                >
                  <ListIcon size={20} />
                </button>
              </div>
              <div className="h-10 w-px bg-[var(--color-border)]" />
              <button 
                onClick={() => { fetchOrders(); fetchStats(); toast.success('Syncing with Kitchen...'); }}
                className="h-14 w-14 flex items-center justify-center bg-[var(--color-surface-soft)] rounded-2xl border border-[var(--color-border)] hover:border-blue-500/30 transition-all text-[var(--color-text-muted)] hover:text-blue-500 shadow-sm"
              >
                <RefreshCcw size={22} className={loading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="h-14 px-10 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl shadow-blue-600/30 flex items-center gap-3 active:scale-95"
              >
                <Plus size={22} strokeWidth={3} /> Dispatch New Order
              </button>
           </div>
        </div>

        {/* Tactical Control Command Center (Filters Redesigned) */}
        <div className="relative">
           <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 blur-2xl opacity-20 -z-10 rounded-[3.5rem]" />
           <div className="bg-[var(--color-surface)] p-2 rounded-[3.5rem] border border-[var(--color-border)] shadow-2xl space-y-2">
              {/* Row 1: The Core Toggles */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                 {/* Sector Toggle */}
                 <div className="lg:col-span-3 bg-[var(--color-surface-soft)] rounded-[2.5rem] p-1.5 flex items-center gap-1 border border-[var(--color-border)]">
                    <button 
                      onClick={() => setFilterType('branch')}
                      className={`flex-1 h-12 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${filterType === 'branch' ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-lg' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
                    >
                      <Globe size={16} /> Branch
                    </button>
                    <button 
                      onClick={() => setFilterType('my')}
                      className={`flex-1 h-12 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${filterType === 'my' ? 'bg-white dark:bg-zinc-800 text-blue-500 shadow-lg' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
                    >
                      <User size={16} /> Personal
                    </button>
                 </div>

                 {/* Omni Search Terminal */}
                 <div className="lg:col-span-6 bg-[var(--color-surface-soft)] rounded-[2.5rem] flex items-center px-8 border border-[var(--color-border)] group focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                    <Search className="text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input 
                      type="text"
                      placeholder="SCAN TABLE, ID OR FOOD SIGNATURE..."
                      className="w-full bg-transparent px-6 py-5 text-[11px] font-black uppercase tracking-[0.3em] outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>

                 {/* Category Matrix */}
                 <div className="lg:col-span-3 bg-[var(--color-surface-soft)] rounded-[2.5rem] p-1.5 border border-[var(--color-border)] flex items-center">
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
                 <div className="flex-1 bg-[var(--color-surface-soft)] rounded-[2.5rem] px-8 py-4 border border-[var(--color-border)] flex items-center justify-between group overflow-hidden relative">
                    <div className="flex items-center gap-6 relative z-10">
                       <UniversalDateFilter
                        onFilterChange={({ startDate, endDate }) => { setStartDate(startDate); setEndDate(endDate); }}
                        loading={loading}
                        variant="ghost"
                      />
                    </div>
                    
                    <div className="flex items-center gap-6 relative z-10">
                       <div className="h-6 w-px bg-[var(--color-border)]" />
                       <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Activity size={14} className="animate-pulse" />
                          {filteredOrders.length} SIGNALS FOUND
                       </p>
                    </div>

                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-blue-500/5 to-transparent -z-0" />
                 </div>

                 <button 
                  onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setStartDate(''); setEndDate(''); }}
                  className="h-[60px] px-8 bg-[var(--color-surface-soft)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 rounded-[2.5rem] border border-[var(--color-border)] text-[var(--color-text-muted)] font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 group shrink-0"
                 >
                    <FilterX size={18} className="group-hover:rotate-12 transition-transform" /> Reset Terminal
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
              label="Live Active" 
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
            <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-[3rem] opacity-30">
              <Utensils size={48} strokeWidth={1} className="mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">Zero transmissions detected in this sector</p>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Order Dossier #${selectedOrder?._id.slice(-6).toUpperCase()}`}
          maxWidth="max-w-4xl"
        >
          {selectedOrder && (
            <div className="p-8 space-y-10">
              <div className="flex flex-col md:flex-row justify-between gap-10">
                <div className="space-y-6 flex-1">
                  <div className="flex items-center gap-6">
                    <div className="h-20 w-20 rounded-[2rem] bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shadow-lg shadow-blue-500/10">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Table</span>
                      <span className="text-3xl font-black text-[var(--color-text-primary)]">{selectedOrder.table?.tableNumber || '??'}</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tighter text-[var(--color-text-primary)] mb-1">
                        Order <span className="text-blue-500">Details</span>
                      </h2>
                      <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                         <Clock size={14} className="text-amber-500" /> {new Date(selectedOrder.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-[var(--color-surface-soft)] rounded-3xl border border-[var(--color-border)]">
                      <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Status</p>
                      <p className="text-sm font-black text-blue-500 flex items-center gap-2 uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        {selectedOrder.status}
                      </p>
                    </div>
                    <div className="p-5 bg-[var(--color-surface-soft)] rounded-3xl border border-[var(--color-border)]">
                      <p className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Amount</p>
                      <p className="text-sm font-black text-emerald-500 flex items-center gap-1">
                        <IndianRupee size={14} /> {selectedOrder.totalAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-80 space-y-4">
                   <div className="p-6 bg-zinc-900 text-white rounded-[2rem] shadow-xl space-y-4 relative overflow-hidden">
                      <Receipt className="absolute -right-4 -bottom-4 opacity-10" size={100} />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Fulfillment Metadata</h4>
                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="opacity-60 flex items-center gap-2"><User size={12} /> Steward</span>
                           <span>{selectedOrder.createdBy?.name || 'Automated'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="opacity-60 flex items-center gap-2"><Utensils size={12} /> Chef</span>
                           <span>{selectedOrder.assignedChef?.name || 'Awaiting'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="opacity-60 flex items-center gap-2"><MapPin size={12} /> Branch</span>
                           <span>{selectedOrder.branch?.name || 'Local'}</span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em]">Culinary Specifications</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-[var(--color-surface-soft)] p-5 rounded-3xl border border-[var(--color-border)] flex justify-between items-center group">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'}`} />
                        <div>
                          <p className="text-sm font-black text-[var(--color-text-primary)]">{item.menuItem?.name || item.itemName}</p>
                          {item.notes && <p className="text-[10px] font-bold text-blue-500 italic mt-0.5">&quot;{item.notes}&quot;</p>}
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-black text-blue-500 uppercase">{item.quantity} Unit(s)</p>
                         <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-0.5">₹{item.price} each</p>
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
          title="Culinary Dispatch"
          maxWidth="max-w-7xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[85vh] overflow-hidden p-4">
            <div className="lg:col-span-5 flex flex-col h-full bg-[var(--color-surface-soft)] rounded-[3rem] border border-[var(--color-border)] overflow-hidden shadow-inner">
              <div className="p-8 border-b border-[var(--color-border)]">
                <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] mb-6">Table Matrix</h3>
                <div className="grid grid-cols-4 gap-4">
                  {tables.map(table => (
                    <button
                      key={table._id}
                      onClick={(e) => { e.stopPropagation(); setSelectedTable(table); }}
                      className={`h-14 rounded-2xl border-2 font-black text-xs transition-all shadow-sm ${selectedTable?._id === table._id ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-blue-500/10' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-blue-500/30'}`}
                    >
                      T{table.tableNumber}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                <h3 className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] mb-4">Service Queue</h3>
                <AnimatePresence>
                  {stagedItems.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-[var(--color-surface)] p-5 rounded-3xl border border-[var(--color-border)] flex justify-between items-center group shadow-sm hover:shadow-md transition-all"
                    >
                      <div>
                        <p className="text-xs font-black text-[var(--color-text-primary)]">{item.name}</p>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">₹{item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-[var(--color-surface-soft)] rounded-xl p-1.5 border border-[var(--color-border)]">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newItems = [...stagedItems];
                              if (newItems[idx].quantity > 1) newItems[idx].quantity -= 1;
                              else newItems.splice(idx, 1);
                              setStagedItems(newItems);
                            }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 text-[var(--color-text-muted)] transition-colors"
                          >-</button>
                          <span className="w-10 text-center text-[10px] font-black text-[var(--color-text-primary)]">{item.quantity}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newItems = [...stagedItems];
                              newItems[idx].quantity += 1;
                              setStagedItems(newItems);
                            }}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 text-[var(--color-text-muted)] transition-colors"
                          >+</button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="p-10 border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase text-[var(--color-text-muted)] tracking-[0.2em] mb-1">Estimated Total</p>
                    <p className="text-4xl font-black tracking-tighter text-[var(--color-text-primary)]">₹{stagedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCreateOrder(); }}
                  className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-4"
                >
                  <Play size={16} fill="currentColor" /> Dispatch Transmission
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-8 pr-4">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={22} />
                <input 
                  type="text"
                  placeholder="Scan menu items..."
                  className="w-full pl-16 pr-8 py-5 bg-[var(--color-surface)] border border-[var(--color-border)] focus:ring-4 focus:ring-blue-500/10 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] outline-none transition-all shadow-sm"
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
                      className="bg-[var(--color-surface)] p-4 rounded-[2.5rem] border border-[var(--color-border)] hover:border-blue-500/40 transition-all cursor-pointer group relative overflow-hidden shadow-sm hover:shadow-xl"
                    >
                      <div className="h-32 w-full rounded-[2rem] bg-[var(--color-surface-soft)] mb-4 overflow-hidden relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[var(--color-text-muted)]"><Coffee size={24} /></div>
                        )}
                      </div>
                      <div className="px-2">
                        <h4 className="text-[11px] font-black text-[var(--color-text-primary)] truncate uppercase tracking-tighter">{item.name}</h4>
                        <p className="text-[10px] font-black text-blue-500 mt-1 uppercase tracking-widest">₹{item.discountedPrice || item.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
}

function StaffOrderCard({ order, onRefresh }) {
  const [isServing, setIsServing] = useState(false);
  const statusConfig = {
    'PLACED': { color: 'amber', icon: AlertCircle, label: 'Kitchen Pending' },
    'ACCEPTED': { color: 'blue', icon: Play, label: 'Order Accepted' },
    'PREPARING': { color: 'indigo', icon: Utensils, label: 'In Preparation' },
    'READY': { color: 'emerald', icon: CheckCircle2, label: 'Ready for Service' },
    'SERVED': { color: 'zinc', icon: CheckCircle2, label: 'Fulfilled' },
    'CANCELLED': { color: 'rose', icon: XCircle, label: 'Canceled' },
    'REJECTED': { color: 'rose', icon: XCircle, label: 'Rejected by Chef' }
  };

  const config = statusConfig[order.status] || statusConfig['PLACED'];
  const timeElapsed = formatDistanceToNow(new Date(order.createdAt));

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <ShoppingBag size={120} strokeWidth={1} />
      </div>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-[1.5rem] bg-[var(--color-surface-soft)] flex flex-col items-center justify-center border border-[var(--color-border)] shadow-inner">
            <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">Table</span>
            <span className="text-2xl font-black text-[var(--color-text-primary)]">{order.table?.tableNumber || '??'}</span>
          </div>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-${config.color}-500 flex items-center gap-2`}>
              <div className={`w-2 h-2 rounded-full bg-current ${order.status === 'PREPARING' ? 'animate-pulse' : ''}`} />
              {config.label}
            </div>
            <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1.5 uppercase tracking-[0.15em] flex items-center gap-1.5">
              <Clock size={12} /> {timeElapsed} ago
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest opacity-40">#{order._id.slice(-6)}</p>
        </div>
      </div>
      <div className="space-y-3 mb-8 relative z-10 bg-[var(--color-surface-soft)] p-5 rounded-[2rem] border border-[var(--color-border)] shadow-inner">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between items-center group/item text-[11px] font-black text-[var(--color-text-primary)]">
            <span><span className="text-blue-500 mr-1">{item.quantity}×</span> {item.menuItem?.name || item.itemName}</span>
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
              toast.success('Service Completed');
              onRefresh();
            } catch (err) { toast.error('Fulfillment Failed'); }
            finally { setIsServing(false); }
          }}
          className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 relative z-20"
        >
          Complete Service
        </button>
      )}
    </div>
  );
}

function StaffOrderListRow({ order, onRefresh }) {
  const [isServing, setIsServing] = useState(false);
  const statusConfig = {
    'PLACED': { color: 'amber', icon: AlertCircle, label: 'PENDING' },
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
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl transition-all relative overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center gap-6 w-full md:w-auto">
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-surface-soft)] flex flex-col items-center justify-center border border-[var(--color-border)] shrink-0 shadow-inner">
          <span className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">Table</span>
          <span className="text-xl font-black text-[var(--color-text-primary)]">{order.table?.tableNumber || '??'}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <p className="text-xs font-black text-[var(--color-text-primary)] tracking-tight">Order #{order._id.slice(-6).toUpperCase()}</p>
            <div className={`px-3 py-1 rounded-full bg-${config.color}-500/10 text-${config.color}-500 text-[8px] font-black uppercase tracking-[0.2em] border border-${config.color}-500/20`}>
              {config.label}
            </div>
          </div>
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={12} className="text-blue-500/50" /> {timeElapsed} ago
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl px-6">
        {order.items.map((item, i) => (
          <div key={i} className="px-3 py-1.5 bg-[var(--color-surface-soft)] rounded-xl border border-[var(--color-border)] text-[9px] font-black text-[var(--color-text-primary)] uppercase tracking-tighter flex items-center gap-2">
            <span className="text-blue-500">{item.quantity}×</span> {item.menuItem?.name || item.itemName}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
        <div className="text-right">
          <p className="text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-1">Subtotal</p>
          <p className="text-xl font-black text-[var(--color-text-primary)] tracking-tighter">₹{order.totalAmount.toLocaleString()}</p>
        </div>
        
        {order.status === 'READY' ? (
          <button 
            disabled={isServing}
            onClick={async (e) => {
              e.stopPropagation();
              setIsServing(true);
              try {
                await api.patch(`/orders/${order._id}/serve`);
                toast.success('Service Completed');
                onRefresh();
              } catch (err) { toast.error('Fulfillment Failed'); }
              finally { setIsServing(false); }
            }}
            className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 relative z-20"
          >
            <CheckCircle2 size={14} /> Complete
          </button>
        ) : (
          <div className="h-12 w-12 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-blue-500 transition-colors">
            <ChevronRight size={18} />
          </div>
        )}
      </div>
    </div>
  );
}
