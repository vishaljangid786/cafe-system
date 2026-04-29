'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, Search, Plus, Filter, Clock, 
  CheckCircle2, XCircle, AlertCircle, Utensils,
  ChevronRight, ArrowRight, MessageSquare,
  Globe, User, Calendar, Hash, Loader2, Play,
  RefreshCcw, Coffee
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

export default function StaffOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('branch'); // 'my' or 'branch'
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 12;
  
  // Data for creation
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [stagedItems, setStagedItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [stats, setStats] = useState(null);
  
  // Advanced Filtering
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchStats = async () => {
    if (!['staff', 'branch_admin'].includes(user?.role)) return;
    try {
      const res = await api.get('/orders/my-stats-staff');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('Stats sync fail');
    }
  };

  const fetchOrders = async () => {
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
      if (['staff', 'branch_admin'].includes(user?.role)) {
        toast.error('Failed to sync orders');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const fetchDataForCreation = async () => {
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
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchStats();
      fetchCategories();
      if (showCreateModal) fetchDataForCreation();
    }
  }, [user, filterType, showCreateModal, startDate, endDate, currentPage]);

  useEffect(() => {
    if (!user) return;
    const socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      socket.emit('join_session', { 
        userId: user._id, 
        branchId: user.assignedLocation?._id || user.assignedLocation,
        role: 'staff'
      });
    });

    socket.on('order:ready', (data) => {
      toast.success(data.message, { 
        icon: '🚀', 
        duration: 8000,
        position: 'top-right'
      });
      fetchOrders();
    });

    socket.on('order:update', () => fetchOrders());
    socket.on('order:cancel', () => fetchOrders());
    socket.on('order:note', () => fetchOrders());

    return () => socket.close();
  }, [user]);

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

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-foreground">
              <ShoppingBag className="text-accent" size={32} />
              Live Orders <span className="text-muted-foreground font-medium">/ Frontline Sync</span>
            </h1>
            <p className="text-muted-foreground text-sm font-bold mt-1 tracking-tight">Monitor kitchen throughput and fulfillment cycles.</p>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                fetchOrders();
                fetchStats();
                toast.success('Syncing with Kitchen...');
              }}
              className="p-3 bg-muted rounded-2xl border border-border"
              title="Refresh Dashboard"
            >
              <RefreshCcw className={loading ? 'animate-spin' : ''} size={18} />
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-accent hover:bg-accent/90 text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
            >
              <Plus size={18} strokeWidth={3} /> New Order
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 flex p-1.5 bg-muted rounded-2xl border border-border">
              <button 
                onClick={() => setFilterType('branch')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${filterType === 'branch' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Globe size={14} /> Branch
              </button>
              <button 
                onClick={() => setFilterType('my')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${filterType === 'my' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <User size={14} /> My
              </button>
            </div>

            <div className="md:col-span-6 relative">
              <input 
                type="text"
                placeholder="Search by table, ID or food name..."
                className="w-full pr-6 py-4 bg-card border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <PremiumSelect 
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={[
                  { label: 'All Categories', value: 'all' },
                  ...categories.map(cat => ({ label: cat.name, value: cat._id }))
                ]}
              />
            </div>
          </div>

          <div className="w-full max-w-md">
            <UniversalDateFilter
              onFilterChange={({ startDate, endDate }) => {
                setStartDate(startDate);
                setEndDate(endDate);
              }}
              loading={loading}
            />
          </div>
        </div>

        {/* Performance Matrix */}
        {stats && (
          <SlideIn delay={0.1}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Handled', value: stats.totalOrders, icon: ShoppingBag, color: 'text-amber-500', bg: 'bg-amber-500/5' },
                { label: 'Placed by Me', value: stats.createdCount, icon: Plus, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                { label: 'Served by Me', value: stats.servedCount, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
                { label: 'Live Active', value: orders.filter(o => !['SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status)).length, icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-500/5' }
              ].map((stat, i) => (
                <div key={i} className={`p-6 rounded-[2rem] border border-border bg-card shadow-sm flex flex-col items-center text-center group hover:scale-105 transition-all duration-500`}>
                  <div className={`h-12 w-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-4 border border-border`}>
                    <stat.icon size={20} />
                  </div>
                  <h4 className="text-2xl font-black tracking-tighter mb-1 text-foreground">{stat.value}</h4>
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </SlideIn>
        )}

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => (
              <motion.div
                key={order._id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <StaffOrderCard order={order} onRefresh={fetchOrders} />
              </motion.div>
            ))}
          </AnimatePresence>
          
          {!loading && filteredOrders.length === 0 && (
            <div className="lg:col-span-2 xl:col-span-3 h-80 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[3rem] opacity-30">
              <Utensils size={48} strokeWidth={1} className="mb-4 text-muted-foreground" />
              <p className="text-xs font-black uppercase tracking-[0.2em] text-center text-muted-foreground">No active signals in this sector</p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {filterType === 'branch' && totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-card border border-border rounded-[2.5rem] mt-10 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Sector Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-muted border border-border text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-card"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-muted border border-border text-[10px] font-black uppercase tracking-widest disabled:opacity-30 transition-all hover:bg-card"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Create Order Modal */}
        <Modal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)}
          title="Culinary Dispatch"
          maxWidth="max-w-6xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[80vh] overflow-hidden">
            {/* Table Selection & Items List */}
            <div className="lg:col-span-5 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950/30 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Table Selection</h3>
                <div className="grid grid-cols-4 gap-3">
                  {tables.map(table => (
                    <button
                      key={table._id}
                      onClick={() => setSelectedTable(table)}
                      className={`h-12 rounded-xl border-2 font-black text-xs transition-all ${selectedTable?._id === table._id ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300'}`}
                    >
                      T{table.tableNumber}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Order Queue</h3>
                {stagedItems.map((item, idx) => (
                  <div key={idx} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group">
                    <div>
                      <p className="text-xs font-black text-zinc-800 dark:text-zinc-100">{item.name}</p>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">₹{item.price} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button 
                          onClick={() => {
                            const newItems = [...stagedItems];
                            if (newItems[idx].quantity > 1) newItems[idx].quantity -= 1;
                            else newItems.splice(idx, 1);
                            setStagedItems(newItems);
                          }}
                          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-500"
                        >-</button>
                        <span className="w-8 text-center text-[10px] font-black">{item.quantity}</span>
                        <button 
                          onClick={() => {
                            const newItems = [...stagedItems];
                            newItems[idx].quantity += 1;
                            setStagedItems(newItems);
                          }}
                          className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-500"
                        >+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-4">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Estimated Total</span>
                  <span className="text-3xl font-black tracking-tighter">₹{stagedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toLocaleString()}</span>
                </div>
                <button 
                  onClick={handleCreateOrder}
                  className="w-full py-5 bg-zinc-900 dark:bg-white dark:text-black text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <Play size={14} fill="currentColor" /> Dispatch to Kitchen
                </button>
              </div>
            </div>

            {/* Menu Discovery */}
            <div className="lg:col-span-7 flex flex-col h-full overflow-hidden space-y-6 pt-6 pr-6">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input 
                  type="text"
                  placeholder="Search the menu matrix..."
                  className="w-full pl-14 pr-6 py-4 bg-muted border border-border focus:ring-2 focus:ring-accent/20 rounded-2xl text-xs font-bold outline-none transition-all text-foreground"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-10">
                  {menuItems.filter(i => i.name.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                    <div 
                      key={item._id}
                      onClick={() => addToStage(item)}
                      className="bg-card p-4 rounded-[2rem] border border-border hover:border-accent/30 transition-all cursor-pointer group relative overflow-hidden shadow-sm"
                    >
                      <div className="h-24 w-full rounded-2xl bg-muted mb-3 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-zinc-300"><Coffee size={20} /></div>
                        )}
                        <div className="absolute top-2 left-2">
                           <div className={`w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${item.dietaryType === 'veg' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                        </div>
                      </div>
                      <h4 className="text-[11px] font-black text-foreground truncate">{item.name}</h4>
                      <p className="text-[10px] font-bold text-accent mt-0.5">₹{item.discountedPrice || item.price}</p>
                      
                      <div className="absolute top-4 right-4 h-8 w-8 rounded-full bg-amber-500 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg shadow-amber-500/20">
                        <Plus size={16} strokeWidth={3} />
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
    'CANCELLED': { color: 'rose', icon: XCircle, label: 'Aborted' },
    'REJECTED': { color: 'rose', icon: XCircle, label: 'Rejected by Chef' }
  };

  const config = statusConfig[order.status] || statusConfig['PLACED'];
  const timeElapsed = formatDistanceToNow(new Date(order.createdAt));
  
  // Rule: Disable editing if PREPARING starts
  const isLocked = ['PREPARING', 'READY', 'SERVED', 'CANCELLED', 'REJECTED'].includes(order.status);

  return (
    <CardHover>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted flex flex-col items-center justify-center border border-border">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Table</span>
              <span className="text-xl font-black text-foreground">{order.table?.tableNumber || '??'}</span>
            </div>
            <div>
              <div className={`text-[10px] font-black uppercase tracking-[0.2em] text-${config.color}-500 flex items-center gap-1.5`}>
                <config.icon size={12} className={order.status === 'PREPARING' ? 'animate-spin' : ''} /> {config.label}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{timeElapsed} ago</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">#{order._id.slice(-6)}</p>
            {isLocked && (
              <div className="mt-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg text-zinc-400">
                <Clock size={12} />
              </div>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-6">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between items-center text-xs font-bold text-muted-foreground px-2 py-1">
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${item.menuItem?.dietaryType === 'veg' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : item.menuItem?.dietaryType === 'non-veg' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-accent shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
                {item.quantity}x {item.menuItem?.name}
              </span>
            </div>
          ))}
        </div>

        {/* Chef Note Display */}
        {order.chefNote && (
          <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
            <MessageSquare className="text-amber-500 shrink-0 mt-0.5" size={14} />
            <p className="text-[10px] font-bold text-amber-600/80 leading-relaxed italic">
              Chef: "{order.chefNote}"
            </p>
          </div>
        )}

        {/* Reject Reason */}
        {order.status === 'REJECTED' && (
          <div className="mb-6 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={14} />
            <p className="text-[10px] font-black text-rose-500/80 uppercase tracking-tight">
              Reason: {order.rejectReason || 'Unspecified'}
            </p>
          </div>
        )}

        {/* Action Button */}
        {order.status === 'READY' && (
          <button 
            disabled={isServing}
            onClick={async () => {
              setIsServing(true);
              try {
                await api.patch(`/orders/${order._id}/serve`);
                toast.success('Service Completed');
                onRefresh();
              } catch (err) {
                toast.error(err.response?.data?.message || 'Fulfillment Failed');
              } finally {
                setIsServing(false);
              }
            }}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 size={14} strokeWidth={3} /> {isServing ? 'Processing...' : 'Complete Service'}
          </button>
        )}

        {isLocked && order.status !== 'READY' && order.status !== 'SERVED' && (
          <div className="w-full py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 text-zinc-400 font-black text-[9px] uppercase tracking-widest rounded-xl text-center">
            Order Locked — Kitchen Processing
          </div>
        )}
      </div>
    </CardHover>
  );
}
