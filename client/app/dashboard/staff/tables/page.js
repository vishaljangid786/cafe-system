'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { Coffee, MapPin, Plus, Zap, Loader2, ShoppingBag, Receipt, X, Search, Check } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/context/AuthContext';
import { Button } from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import TableCard from '../../../components/tables/TableCard';
import AssignTableModal from '../../../components/tables/AssignTableModal';
import BillPreview from '../../../components/tables/BillPreview';

export default function StaffTablesPage() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBillPreviewOpen, setIsBillPreviewOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [showMenuGrid, setShowMenuGrid] = useState(false);
  const [orderItem, setOrderItem] = useState({ itemName: '', quantity: 1, price: '', menuItemId: '', categoryId: '' });

  const fetchTables = async () => {
    if (!user?.assignedLocation) return;
    try {
      const res = await api.get(`/tables?locationId=${user.assignedLocation._id || user.assignedLocation}`);
      setTables(res.data.data);
    } catch (error) {
      toast.error('Failed to sync floor plan');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/menu');
      setMenuItems(res.data.data);
    } catch (error) {
      console.error("Menu sync failed");
    }
  };

  useEffect(() => {
    fetchTables();
    fetchMenu();
  }, [user]);

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
    setPendingOrders([...table.orders]);
    setShowOrderModal(true);
  };

  const handleStageOrder = (e) => {
    e.preventDefault();
    if (!orderItem.itemName || !orderItem.price) return toast.error('Selection required');

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
    toast.success('Staged locally');
  };

  const handleSyncOrders = async () => {
    const loadToast = toast.loading('Syncing matrix...');
    try {
      const res = await api.put(`/tables/${selectedTable._id}/orders`, { orders: pendingOrders });
      setSelectedTable(res.data.data);
      fetchTables();
      toast.success('Matrix synchronized', { id: loadToast });
    } catch (error) {
      toast.error('Sync failure', { id: loadToast });
    }
  };

  const handleRemoveStagedItem = (idx) => {
    setPendingOrders(prev => prev.filter((_, i) => i !== idx));
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
      toast.error('Removal failed', { id: loadToast });
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
      toast.success('Session archived', { id: loadToast });
    } catch (error) {
      toast.error('Archival failed', { id: loadToast });
    }
  };

  const stats = {
    total: tables.length,
    occupied: tables.filter(t => t.status !== 'available').length,
    revenue: tables.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0)
  };

  if (loading) return (
    <div className="space-y-8 p-8">
      <div className="h-40 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[3rem] animate-pulse border border-zinc-200 dark:border-zinc-800"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-64 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] animate-pulse border border-zinc-200 dark:border-zinc-800"></div>)}
      </div>
    </div>
  );

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        <SlideIn direction="down">
          <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-8 rounded-[3.5rem] shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="h-20 w-20 rounded-[2.5rem] bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-inner">
                <Coffee size={36} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">Floor <span className="text-amber-600">Command</span></h1>
                <div className="flex items-center gap-2 text-zinc-500 mt-3 font-bold text-[10px] uppercase tracking-[0.2em]">
                  <MapPin size={12} className="text-amber-500" /> {user?.assignedLocation?.city || 'Location'} Node Registry
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 items-center px-8 py-5 bg-zinc-50 dark:bg-zinc-950/50 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-col min-w-[100px]">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Active Nodes</span>
                <span className="text-xl font-black text-zinc-900 dark:text-zinc-100">{stats.occupied} / {stats.total}</span>
              </div>
              <div className="hidden sm:block h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex flex-col min-w-[100px]">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Live Revenue</span>
                <span className="text-xl font-black text-emerald-500">₹{stats.revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
          <AnimatePresence mode='popLayout'>
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

        {!loading && tables.length === 0 && (
          <div className="text-center py-32 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl rounded-[4rem] border border-dashed border-zinc-200 dark:border-zinc-800">
            <Coffee size={64} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-black text-zinc-400 tracking-tight uppercase">Grid Offline</h3>
            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mt-2 max-w-sm mx-auto">No terminal nodes detected in this sector.</p>
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
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          title={`Session Matrix: T${selectedTable?.tableNumber}`}
          maxWidth="max-w-5xl"
        >
          {selectedTable && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
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
                  {selectedTable.orders.map((order, idx) => (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={`synced-${idx}`} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50 p-5 rounded-3xl border border-zinc-100 dark:border-zinc-800 group transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 font-black text-xs">{idx + 1}</div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-zinc-500 tracking-widest uppercase mt-0.5">{order.quantity} × ₹{Number(order.price).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-5">
                        <div className="text-sm font-black text-amber-600">₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}</div>
                        <button onClick={() => handleRemoveOrderItem(idx)} className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"><X size={14} /></button>
                      </div>
                    </motion.div>
                  ))}

                  {pendingOrders.filter(p => !selectedTable.orders.find(s => s.itemName === p.itemName && s.price === p.price && s.quantity === p.quantity)).map((order, idx) => (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={`pending-${idx}`} className="flex justify-between items-center bg-amber-500/5 p-5 rounded-3xl border border-dashed border-amber-500/20 group transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-black text-xs animate-pulse">NEW</div>
                        <div>
                          <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{order.itemName}</div>
                          <div className="text-[9px] font-bold text-amber-600/60 tracking-widest uppercase mt-0.5">{order.quantity} × ₹{Number(order.price).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-5">
                        <div className="text-sm font-black text-amber-600">₹{(Number(order.quantity) * Number(order.price)).toLocaleString()}</div>
                        <button onClick={() => handleRemoveStagedItem(idx)} className="h-8 w-8 rounded-lg text-amber-600 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"><X size={14} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="pt-8 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-2">Total Yield</span>
                    <span className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter">
                      ₹{Math.max(0,
                        pendingOrders.reduce((acc, curr) => acc + (Number(curr.price) * Number(curr.quantity) || 0), 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <Button variant="primary" className="!rounded-[1.5rem] !py-4 px-10 bg-emerald-600 hover:bg-emerald-700" icon={Receipt} onClick={() => setIsBillPreviewOpen(true)}>Generate Bill</Button>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-8 bg-zinc-50 dark:bg-zinc-950/30 p-8 rounded-[3rem] border border-zinc-100 dark:border-zinc-800">
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Append Resource</h3>
                  <div className="relative group">
                    <input type="text" placeholder="Scan Menu Grid..." className="w-full rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 pl-4 pr-4 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" value={menuSearch} onChange={(e) => { setMenuSearch(e.target.value); setShowMenuGrid(true); }} onFocus={() => setShowMenuGrid(true)} />
                    <AnimatePresence>
                      {showMenuGrid && menuSearch && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                          {menuItems.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                            <div key={item._id} onClick={() => { setOrderItem({ itemName: item.name, price: Number(item.discountedPrice || item.price), costPrice: Number(item.costPrice || 0), quantity: 1, menuItemId: item._id, categoryId: item.category?._id || item.category }); setMenuSearch(''); setShowMenuGrid(false); }} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0 flex justify-between items-center">
                              <div>
                                <div className="text-xs font-black text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                <div className="text-[10px] text-zinc-400 font-bold uppercase">{item.category?.name}</div>
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
                      <input required type="number" min="1" className="w-full rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-bold dark:text-zinc-100 outline-none" value={orderItem.quantity} onChange={e => setOrderItem({ ...orderItem, quantity: e.target.value })} placeholder="Qty" />
                      <input required type="number" className="w-full rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 text-sm font-bold dark:text-zinc-100 outline-none" value={orderItem.price} onChange={e => setOrderItem({ ...orderItem, price: e.target.value })} placeholder="Price" />
                    </div>
                    <Button type="submit" variant="outline" className="w-full !rounded-xl !py-4 text-[10px] font-black uppercase tracking-widest" icon={Plus}>Stage Item</Button>
                  </form>

                  <Button onClick={handleSyncOrders} className="w-full !rounded-2xl !py-5 bg-blue-600 hover:bg-blue-700" variant="primary" icon={Zap}>Synchronize Matrix</Button>
                </div>
              </div>
            </div>
          )}
        </Modal>

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
