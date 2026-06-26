'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/app/services/api';
import { blockNonInteger, blockNegative } from '@/app/utils/inputValidation';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton, CardSkeleton } from '@/app/components/ui/Skeleton';
import {
  Package, AlertTriangle, Trash2, ShoppingCart,
  TrendingDown, Search, Filter,
  RefreshCcw, Plus, ChevronRight, X
} from 'lucide-react';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import Modal from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import ExportActions from '@/app/components/ui/ExportActions';
import useBranchScope from '../../../hooks/useBranchScope';

export default function InventoryDashboard() {
  const { singleBranchId } = useBranchScope();
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [activeTab, setActiveTab] = useState('stock'); // stock, waste, suggestions
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const columns = [
    { header: 'Ingredient', key: 'ingredient.name' },
    { header: 'Branch', key: 'branch.name' },
    { header: 'Quantity', key: (item) => `${item.stock} ${item.ingredient?.unit}` },
    { header: 'Category', key: 'ingredient.category' },
    { header: 'Cost Per Unit', key: 'costPerUnit' },
    { header: 'Low Stock Alert', key: 'minThreshold' }
  ];

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [isNewIngredientModalOpen, setIsNewIngredientModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    branch: '',
    ingredient: '',
    name: '',
    unit: '',
    category: 'General',
    baseCost: '',
    quantity: '',
    costPerUnit: '',
    minThreshold: '',
    reason: 'spillage',
    notes: ''
  });

  const fetchInitialData = async () => {
    setLoading(true);
    progress.start();
    try {
      const [locRes, ingRes] = await Promise.all([
        api.get('/locations'),
        api.get('/inventory/ingredients')
      ]);
      setLocations(locRes.data.data);
      setIngredients(ingRes.data.data);

      await fetchData({ initial: true });
    } catch (err) {
      toast.error('Could not load the page. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      progress.done();
    }
  };

  const fetchData = async ({ initial = false } = {}) => {
    // initial=true means called from fetchInitialData (loader already handled there)
    if (!initial) {
      setRefetching(true);
      progress.start();
    }
    try {
      const branchId = singleBranchId === 'all' ? '' : singleBranchId;
      const [invRes, alertRes, sugRes] = await Promise.all([
        api.get(branchId ? `/inventory/branch/${branchId}` : `/inventory`),
        api.get(`/inventory/alerts${branchId ? `?branchId=${branchId}` : ''}`),
        api.get(`/inventory/suggestions${branchId ? `?branchId=${branchId}` : ''}`)
      ]);

      setInventory(invRes.data.data);
      setAlerts(alertRes.data.data);
      setSuggestions(sugRes.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Could not refresh the data. Please try again.');
    } finally {
      if (!initial) {
        setRefetching(false);
        progress.done();
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) fetchData();
    }, 0);

    return () => clearTimeout(timer);
  }, [singleBranchId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitialData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleAddStock = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/inventory/update', formData);
      toast.success('Stock updated');
      setIsAddModalOpen(false);
      setIsUpdateModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the stock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogWaste = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/inventory/waste', formData);
      toast.success('Waste recorded');
      setIsWasteModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record the waste. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/inventory/ingredients', {
        name: formData.name,
        unit: formData.unit,
        category: formData.category,
        baseCost: formData.baseCost
      });
      toast.success('Ingredient added');
      setIsNewIngredientModalOpen(false);
      // Refresh ingredients list
      const ingRes = await api.get('/inventory/ingredients');
      setIngredients(ingRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add the ingredient. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.ingredient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.branch?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto space-y-6 pb-10">

        {/* Header Section */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="page-title text-2xl sm:text-3xl flex items-center gap-3">
                <Package className="text-primary h-6 w-6" />
                Inventory
              </h1>
              <p className="text-sm font-medium text-(--color-text-secondary) mt-2">Track ingredients and plan purchases.</p>
            </div>

            <div className="flex items-center gap-3">
              <ExportActions
                data={inventory}
                columns={columns}
                filename={`Inventory_${singleBranchId === 'all' ? 'All' : singleBranchId}`}
                hasCharts={true}
              />
            </div>
          </div>
        </SlideIn>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SlideIn delay={0.1}>
            <div className="card p-5 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <AlertTriangle size={120} />
              </div>
              <p className="label">Low Stock Alerts</p>
              <p className="text-3xl font-semibold text-danger mt-2">{alerts.length}</p>
              <p className="text-xs font-medium text-(--color-text-muted) mt-2 flex items-center gap-1">
                Items running low
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-primary p-5 rounded-xl shadow-sm text-(--color-on-primary) relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-20">
                <ShoppingCart size={120} />
              </div>
              <p className="text-xs font-semibold opacity-80">Items to Buy</p>
              <p className="text-3xl font-semibold mt-2">{suggestions.length}</p>
              <p className="text-xs font-medium opacity-90 mt-2 flex items-center gap-1">
                Suggested to buy now
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="card p-5 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <RefreshCcw size={120} />
              </div>
              <p className="label">Total Ingredients</p>
              <p className="text-3xl font-semibold text-(--color-text-primary) mt-2">{inventory.length}</p>
              <p className="text-xs font-medium text-success mt-2 flex items-center gap-1">
                Items being tracked
              </p>
            </div>
          </SlideIn>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 p-1.5 bg-(--color-surface-soft) rounded-xl w-fit">
          {['stock', 'suggestions', 'waste'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl text-xs capitalize transition-all ${
                activeTab === tab
                  ? 'bg-(--color-surface) text-primary font-semibold shadow-sm'
                  : 'text-(--color-text-muted) font-medium hover:text-(--color-text-primary)'
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
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1 min-w-0 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={18} />
                    <input
                      type="text"
                      placeholder="Search ingredients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 bg-(--color-surface) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none text-(--color-text-primary)"
                    />
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:shrink-0">
                    <button 
                      onClick={() => {
                        setFormData({
                          name: '',
                          unit: '',
                          category: 'General',
                          baseCost: ''
                        });
                        setIsNewIngredientModalOpen(true);
                      }}
                      className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-(--color-surface) border border-(--color-border) text-(--color-text-primary) rounded-xl text-xs font-medium hover:border-primary transition-colors"
                    >
                      <Plus size={16} /> New Ingredient
                    </button>
                    <button 
                      onClick={() => {
                        setFormData({
                          branch: singleBranchId === 'all' ? '' : singleBranchId,
                          ingredient: '',
                          quantity: '',
                          costPerUnit: '',
                          minThreshold: ''
                        });
                        setIsAddModalOpen(true);
                      }}
                      className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-(--color-text-primary) text-(--color-bg-base) rounded-xl text-xs font-semibold"
                    >
                      <Plus size={16} /> Add Stock
                    </button>
                  </div>
                </div>

                {refetching ? (
                  <TableSkeleton rows={6} cols={5} />
                ) : (
                <div className="bg-(--color-surface) rounded-xl border border-(--color-border) overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-(--color-surface-soft) border-b border-(--color-border)">
                          <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Ingredient</th>
                          <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Category</th>
                          <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted) text-center">Status</th>
                          <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Quantity</th>
                          <th className="px-5 py-4 text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-(--color-border)">
                        {filteredInventory.map((item) => (
                          <tr key={item._id} className="group hover:bg-primary/[0.02] transition-colors">
                            <td className="px-5 py-4">
                              <p className="font-medium text-(--color-text-primary)">{item.ingredient?.name}</p>
                              <p className="text-[11px] font-medium text-(--color-text-muted) mt-1">Cost: ₹{item.costPerUnit}/{item.ingredient?.unit}</p>
                            </td>
                            <td className="px-5 py-4">
                              <span className="px-2.5 py-1 bg-(--color-surface-soft) text-[11px] font-medium text-(--color-text-muted) rounded-lg">
                                {item.ingredient?.category || 'General'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {item.stock <= item.minThreshold ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-danger/10 text-danger text-[11px] font-medium rounded-lg">
                                  <AlertTriangle size={10} /> Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 text-success text-[11px] font-medium rounded-lg">
                                  In Stock
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <p className={`text-xl font-semibold ${item.stock <= item.minThreshold ? 'text-danger' : 'text-(--color-text-primary)'}`}>
                                {item.stock} <span className="text-[11px] font-medium text-(--color-text-muted) ml-1">{item.ingredient?.unit}</span>
                              </p>
                              <div className="w-24 h-1.5 bg-(--color-surface-soft) rounded-full mt-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.stock <= item.minThreshold ? 'bg-danger' : 'bg-success'}`}
                                  style={{ width: `${Math.min((item.stock / (item.minThreshold * 2)) * 100, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setFormData({
                                    branch: item.branch?._id || item.branch,
                                    ingredient: item.ingredient?._id,
                                    quantity: '',
                                    costPerUnit: item.costPerUnit,
                                    minThreshold: item.minThreshold
                                  });
                                  setIsUpdateModalOpen(true);
                                }}
                                className="p-2 rounded-xl bg-(--color-surface-soft) text-(--color-text-muted) hover:bg-primary hover:text-(--color-bg-base) transition-all"
                              >
                                <RefreshCcw size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
              </motion.div>
            )}

            {activeTab === 'suggestions' && (
              <motion.div 
                key="suggestions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {refetching ? (
                  <>
                    <CardSkeleton />
                    <CardSkeleton />
                  </>
                ) : suggestions.map((sug, i) => (
                  <div key={i} className="p-5 bg-(--color-surface) border border-(--color-border) rounded-xl flex items-center justify-between group hover:border-primary/50 transition-colors">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-normal text-primary mb-1">Buying Suggestion</p>
                      <h3 className="text-2xl font-semibold text-(--color-text-primary)">{sug.ingredient}</h3>
                      <p className="text-sm font-medium text-(--color-text-secondary) mt-2">Current: <span className="font-medium">{sug.currentStock} {sug.unit}</span> | Shortfall: <span className="text-danger font-medium">{sug.threshold - sug.currentStock} {sug.unit}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium text-(--color-text-muted) mb-1 uppercase tracking-normal">Suggested Order</p>
                      <p className="text-3xl font-semibold text-(--color-text-primary)">{sug.suggestedOrder} {sug.unit}</p>
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
                className="text-center py-10"
              >
                <div className="h-12 w-12 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-2xl font-semibold text-(--color-text-primary)">Record Waste</h3>
                <p className="text-(--color-text-secondary) max-w-sm mx-auto mt-2">Record spillage, expiry, and damage to keep your stock counts accurate.</p>
                <button
                  onClick={() => setIsWasteModalOpen(true)}
                  className="mt-6 px-6 py-3 bg-danger text-(--color-bg-base) rounded-xl text-xs font-semibold transition-transform"
                >
                  Record Waste
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modals */}
        <Modal 
          isOpen={isAddModalOpen || isUpdateModalOpen} 
          onClose={() => {
            setIsAddModalOpen(false);
            setIsUpdateModalOpen(false);
          }}
          title={isUpdateModalOpen ? `Update ${selectedItem?.ingredient?.name}` : 'Add New Stock'}
        >
          <form onSubmit={handleAddStock} className="space-y-6">
            {!isUpdateModalOpen && (
              <>
                <PremiumSelect 
                  label="Branch"
                  value={formData.branch}
                  onChange={(val) => setFormData({...formData, branch: val})}
                  options={locations.map(loc => ({ label: loc.name, value: loc._id }))}
                  placeholder="Select Branch"
                />
                <PremiumSelect 
                  label="Ingredient"
                  value={formData.ingredient}
                  onChange={(val) => setFormData({...formData, ingredient: val})}
                  options={ingredients.map(ing => ({ label: `${ing.name} (${ing.unit})`, value: ing._id }))}
                  placeholder="Select Ingredient"
                />
              </>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Quantity</label>
                <input
                  type="number"
                  required
                  min="0"
                  onKeyDown={blockNonInteger}
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Cost Per Unit</label>
                <input
                  type="number"
                  required
                  min="0"
                  onKeyDown={blockNegative}
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({...formData, costPerUnit: e.target.value})}
                  className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="₹ 0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Low Stock Alert Level</label>
              <input
                type="number"
                min="0"
                onKeyDown={blockNonInteger}
                value={formData.minThreshold}
                onChange={(e) => setFormData({...formData, minThreshold: e.target.value})}
                className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="10"
              />
            </div>

            <Button 
              type="submit" 
              loading={submitting} 
              className="w-full py-4 rounded-xl font-semibold"
            >
              {isUpdateModalOpen ? 'Update Stock' : 'Add Stock'}
            </Button>
          </form>
        </Modal>

        <Modal 
          isOpen={isWasteModalOpen}
          onClose={() => setIsWasteModalOpen(false)}
          title="Record Waste"
        >
          <form onSubmit={handleLogWaste} className="space-y-6">
            <PremiumSelect 
              label="Branch"
              value={formData.branch}
              onChange={(val) => setFormData({...formData, branch: val})}
              options={locations.map(loc => ({ label: loc.name, value: loc._id }))}
              placeholder="Select Branch"
            />
            <PremiumSelect 
              label="Ingredient"
              value={formData.ingredient}
              onChange={(val) => setFormData({...formData, ingredient: val})}
              options={ingredients.map(ing => ({ label: `${ing.name} (${ing.unit})`, value: ing._id }))}
              placeholder="Select Ingredient"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Quantity</label>
                <input
                  type="number"
                  required
                  min="0"
                  onKeyDown={blockNonInteger}
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="0.00"
                />
              </div>
              <PremiumSelect
                label="Reason"
                value={formData.reason}
                onChange={(val) => setFormData({...formData, reason: val})}
                options={[
                  { label: 'Spillage', value: 'spillage' },
                  { label: 'Expiry', value: 'expired' },
                  { label: 'Damage', value: 'damaged' },
                  { label: 'Other', value: 'other' }
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Notes</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-25 resize-none"
                placeholder="Details about the waste"
              />
            </div>

            <Button 
              type="submit" 
              variant="danger"
              loading={submitting} 
              className="w-full py-4 rounded-xl font-semibold"
            >
              Save Waste Record
            </Button>
          </form>
        </Modal>

        <Modal 
          isOpen={isNewIngredientModalOpen} 
          onClose={() => setIsNewIngredientModalOpen(false)}
          title="Create New Ingredient"
        >
          <form onSubmit={handleCreateIngredient} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Ingredient Name</label>
              <input 
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="e.g. Milk, Coffee Beans"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Unit</label>
                <input 
                  type="text"
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="kg, ltr, pcs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-(--color-text-muted) uppercase tracking-normal ml-1">Base Cost</label>
                <input
                  type="number"
                  min="0"
                  onKeyDown={blockNegative}
                  value={formData.baseCost}
                  onChange={(e) => setFormData({...formData, baseCost: e.target.value})}
                  className="w-full px-5 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <PremiumSelect 
              label="Category"
              value={formData.category}
              onChange={(val) => setFormData({...formData, category: val})}
              options={[
                'Dairy', 'Beverages', 'Bakery', 'Produce', 'Spices', 'General'
              ]}
            />

            <Button 
              type="submit" 
              loading={submitting} 
              className="w-full py-4 rounded-xl font-semibold"
            >
              Create Ingredient
            </Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
