'use client';
import { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { 
  Package, AlertTriangle, Trash2, ShoppingCart, 
  TrendingDown, MapPin, Search, Filter, 
  RefreshCcw, Plus, ChevronRight, X
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function InventoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // stock, waste, suggestions
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [alerts, setAlerts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const locRes = await api.get('/locations');
      setLocations(locRes.data.data);
      
      await fetchData();
    } catch (err) {
      toast.error('Failed to initialize dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const branchId = selectedBranch === 'All' ? '' : selectedBranch;
      const [invRes, alertRes, sugRes] = await Promise.all([
        api.get(branchId ? `/inventory/branch/${branchId}` : `/inventory/alerts`), // Simple fallback
        api.get(`/inventory/alerts${branchId ? `?branchId=${branchId}` : ''}`),
        api.get(`/inventory/suggestions${branchId ? `?branchId=${branchId}` : ''}`)
      ]);

      setInventory(invRes.data.data);
      setAlerts(alertRes.data.data);
      setSuggestions(sugRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading) fetchData();
  }, [selectedBranch]);

  const filteredInventory = inventory.filter(item => 
    item.ingredient?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 pb-20">
        
        {/* Header Section */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                <Package className="text-amber-600 h-10 w-10" />
                Inventory <span className="text-amber-600">Pro</span>
              </h1>
              <p className="text-sm font-medium text-zinc-500 mt-2">Advanced ingredient tracking & purchase planning.</p>
            </div>

            <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <MapPin size={18} className="text-zinc-400 ml-2" />
              <select 
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-zinc-700 dark:text-zinc-300 pr-8"
              >
                <option value="All">Network Overview</option>
                {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
        </SlideIn>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <AlertTriangle size={120} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Critical Alerts</p>
              <p className="text-4xl font-black text-rose-600 mt-2">{alerts.length}</p>
              <p className="text-xs font-bold text-zinc-400 mt-2 flex items-center gap-1">
                Items below safety threshold
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-amber-600 p-6 rounded-[2.5rem] shadow-xl shadow-amber-600/20 text-white relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-20">
                <ShoppingCart size={120} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Procurement Items</p>
              <p className="text-4xl font-black mt-2">{suggestions.length}</p>
              <p className="text-xs font-bold opacity-90 mt-2 flex items-center gap-1">
                Recommended to purchase now
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <RefreshCcw size={120} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Ingredients</p>
              <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 mt-2">{inventory.length}</p>
              <p className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                Active tracked components
              </p>
            </div>
          </SlideIn>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-fit">
          {['stock', 'suggestions', 'waste'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                  ? 'bg-white dark:bg-zinc-700 text-amber-600 shadow-sm scale-[1.02]' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'stock' && (
              <motion.div 
                key="stock"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      type="text"
                      placeholder="Search ingredients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                    />
                  </div>
                  <button className="hidden md:flex items-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl text-xs font-black uppercase tracking-widest">
                    <Plus size={16} /> Add Ingredient
                  </button>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800">
                          <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Ingredient</th>
                          <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Category</th>
                          <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Status</th>
                          <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantity</th>
                          <th className="p-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {filteredInventory.map((item) => (
                          <tr key={item._id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                            <td className="p-6">
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{item.ingredient?.name}</p>
                              <p className="text-[10px] font-medium text-zinc-400 uppercase mt-1">Cost: ₹{item.costPerUnit}/{item.ingredient?.unit}</p>
                            </td>
                            <td className="p-6">
                              <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 rounded-lg">
                                {item.ingredient?.category || 'General'}
                              </span>
                            </td>
                            <td className="p-6 text-center">
                              {item.stock <= item.minThreshold ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase rounded-lg">
                                  <AlertTriangle size={10} /> Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase rounded-lg">
                                  Optimal
                                </span>
                              )}
                            </td>
                            <td className="p-6">
                              <p className={`text-xl font-black ${item.stock <= item.minThreshold ? 'text-rose-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                {item.stock} <span className="text-[10px] text-zinc-400 ml-1">{item.ingredient?.unit}</span>
                              </p>
                              <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.stock <= item.minThreshold ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min((item.stock / (item.minThreshold * 2)) * 100, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="p-6">
                              <button className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-amber-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm">
                                <RefreshCcw size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'suggestions' && (
              <motion.div 
                key="suggestions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {suggestions.map((sug, i) => (
                  <div key={i} className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between group hover:border-amber-500/50 transition-colors shadow-sm">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Procurement Suggestion</p>
                      <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{sug.ingredient}</h3>
                      <p className="text-sm font-medium text-zinc-500 mt-2">Current: <span className="font-bold">{sug.currentStock} {sug.unit}</span> | Deficit: <span className="text-rose-500 font-bold">{sug.threshold - sug.currentStock} {sug.unit}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-zinc-400 mb-1 uppercase tracking-widest">Recommended Order</p>
                      <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{sug.suggestedOrder} {sug.unit}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'waste' && (
              <motion.div 
                key="waste"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="h-20 w-20 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={40} />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Waste Tracking Ready</h3>
                <p className="text-zinc-500 max-w-sm mx-auto mt-2">Record spillage, expiry, and damages to maintain precise inventory capital.</p>
                <button className="mt-8 px-8 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-xl shadow-rose-600/20">
                  Log Waste Record
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
