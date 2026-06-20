'use client';
import { useState, useEffect } from 'react';
import api from '@/app/services/api';
import { 
  Package, AlertTriangle, Trash2, ShoppingCart, 
  TrendingDown, MapPin, Search, Filter, 
  RefreshCcw, Plus, ChevronRight, X
} from 'lucide-react';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import Modal from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import ExportActions from '@/app/components/ui/ExportActions';

export default function InventoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // stock, waste, suggestions
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [alerts, setAlerts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const columns = [
    { header: 'Ingredient', key: 'ingredient.name' },
    { header: 'Branch', key: 'branch.name' },
    { header: 'Quantity', key: (item) => `${item.stock} ${item.ingredient?.unit}` },
    { header: 'Category', key: 'ingredient.category' },
    { header: 'Cost Per Unit', key: 'costPerUnit' },
    { header: 'Min Threshold', key: 'minThreshold' }
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
    try {
      setLoading(true);
      const [locRes, ingRes] = await Promise.all([
        api.get('/locations'),
        api.get('/inventory/ingredients')
      ]);
      setLocations(locRes.data.data);
      setIngredients(ingRes.data.data);
      
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
        api.get(branchId ? `/inventory/branch/${branchId}` : `/inventory`),
        api.get(`/inventory/alerts${branchId ? `?branchId=${branchId}` : ''}`),
        api.get(`/inventory/suggestions${branchId ? `?branchId=${branchId}` : ''}`)
      ]);

      setInventory(invRes.data.data);
      setAlerts(alertRes.data.data);
      setSuggestions(sugRes.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to refresh data');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) fetchData();
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedBranch]);

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
      toast.success('Inventory updated successfully');
      setIsAddModalOpen(false);
      setIsUpdateModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update inventory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogWaste = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/inventory/waste', formData);
      toast.success('Waste recorded successfully');
      setIsWasteModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record waste');
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
      toast.success('Ingredient created successfully');
      setIsNewIngredientModalOpen(false);
      // Refresh ingredients list
      const ingRes = await api.get('/inventory/ingredients');
      setIngredients(ingRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create ingredient');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.ingredient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.branch?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">

        {/* Header Section */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="page-title text-2xl flex items-center gap-3">
                <Package className="text-[var(--color-primary)] h-7 w-7" />
                Inventory
              </h1>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-2">Track ingredients and plan purchases.</p>
            </div>

            <div className="flex items-center gap-3">
              <ExportActions
                data={inventory}
                columns={columns}
                filename={`Inventory_${selectedBranch}`}
                hasCharts={true}
              />
              <div className="flex items-center gap-4 bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]">
                <MapPin size={18} className="text-[var(--color-text-muted)] ml-2" />
                <PremiumSelect 
                  value={selectedBranch}
                  onChange={(val) => setSelectedBranch(val)}
                  options={[
                    { label: 'Network Overview', value: 'All' },
                    ...locations.map(loc => ({ label: loc.name, value: loc._id }))
                  ]}
                  className="min-w-[200px]"
                />
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Analytics Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="card p-6 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <AlertTriangle size={120} />
              </div>
              <p className="label">Critical Alerts</p>
              <p className="text-3xl font-bold text-[var(--color-danger)] mt-2">{alerts.length}</p>
              <p className="text-xs font-medium text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                Items below safety threshold
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.2}>
            <div className="bg-[var(--color-primary)] p-6 rounded-xl shadow-sm text-[var(--color-on-primary)] relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-20">
                <ShoppingCart size={120} />
              </div>
              <p className="text-xs font-semibold opacity-80">Procurement Items</p>
              <p className="text-3xl font-bold mt-2">{suggestions.length}</p>
              <p className="text-xs font-medium opacity-90 mt-2 flex items-center gap-1">
                Recommended to purchase now
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="card p-6 relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <RefreshCcw size={120} />
              </div>
              <p className="label">Total Ingredients</p>
              <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-2">{inventory.length}</p>
              <p className="text-xs font-medium text-[var(--color-success)] mt-2 flex items-center gap-1">
                Active tracked components
              </p>
            </div>
          </SlideIn>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 p-1.5 bg-[var(--color-surface-soft)] rounded-xl w-fit">
          {['stock', 'suggestions', 'waste'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-normal transition-all ${
                activeTab === tab 
                  ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm scale-[1.02]' 
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
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
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={18} />
                    <input 
                      type="text"
                      placeholder="Search ingredients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all outline-none text-[var(--color-text-primary)]"
                    />
                  </div>
                  <div className="flex gap-2">
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
                      className="hidden md:flex items-center gap-2 px-5 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl text-xs font-bold uppercase tracking-normal hover:border-[var(--color-primary)] transition-colors"
                    >
                      <Plus size={16} /> New Ingredient
                    </button>
                    <button 
                      onClick={() => {
                        setFormData({
                          branch: selectedBranch === 'All' ? '' : selectedBranch,
                          ingredient: '',
                          quantity: '',
                          costPerUnit: '',
                          minThreshold: ''
                        });
                        setIsAddModalOpen(true);
                      }}
                      className="hidden md:flex items-center gap-2 px-5 py-3 bg-[var(--color-text-primary)] text-[var(--color-bg-base)] rounded-xl text-xs font-bold uppercase tracking-normal"
                    >
                      <Plus size={16} /> Add Stock
                    </button>
                  </div>
                </div>

                <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[var(--color-surface-soft)] border-b border-[var(--color-border)]">
                          <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Ingredient</th>
                          <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Category</th>
                          <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] text-center">Status</th>
                          <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Quantity</th>
                          <th className="p-6 text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {filteredInventory.map((item) => (
                          <tr key={item._id} className="group hover:bg-[var(--color-primary)]/[0.02] transition-colors">
                            <td className="p-6">
                              <p className="font-bold text-[var(--color-text-primary)]">{item.ingredient?.name}</p>
                              <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase mt-1">Cost: ₹{item.costPerUnit}/{item.ingredient?.unit}</p>
                            </td>
                            <td className="p-6">
                              <span className="px-3 py-1 bg-[var(--color-surface-soft)] text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] rounded-lg">
                                {item.ingredient?.category || 'General'}
                              </span>
                            </td>
                            <td className="p-6 text-center">
                              {item.stock <= item.minThreshold ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-danger)]/10 text-[var(--color-danger)] text-[10px] font-bold uppercase rounded-lg">
                                  <AlertTriangle size={10} /> Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-success)]/10 text-[var(--color-success)] text-[10px] font-bold uppercase rounded-lg">
                                  Optimal
                                </span>
                              )}
                            </td>
                            <td className="p-6">
                              <p className={`text-xl font-bold ${item.stock <= item.minThreshold ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
                                {item.stock} <span className="text-[10px] text-[var(--color-text-muted)] ml-1">{item.ingredient?.unit}</span>
                              </p>
                              <div className="w-24 h-1.5 bg-[var(--color-surface-soft)] rounded-full mt-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.stock <= item.minThreshold ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'}`}
                                  style={{ width: `${Math.min((item.stock / (item.minThreshold * 2)) * 100, 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="p-6">
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
                                className="p-2 rounded-xl bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)] hover:text-[var(--color-bg-base)] transition-all opacity-0 group-hover:opacity-100 shadow-sm"
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
                  <div key={i} className="p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between group hover:border-[var(--color-primary)]/50 transition-colors shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-primary)] mb-1">Procurement Suggestion</p>
                      <h3 className="text-2xl font-bold text-[var(--color-text-primary)]">{sug.ingredient}</h3>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-2">Current: <span className="font-bold">{sug.currentStock} {sug.unit}</span> | Deficit: <span className="text-[var(--color-danger)] font-bold">{sug.threshold - sug.currentStock} {sug.unit}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-normal">Recommended Order</p>
                      <p className="text-3xl font-bold text-[var(--color-text-primary)]">{sug.suggestedOrder} {sug.unit}</p>
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
                <div className="h-20 w-20 bg-[var(--color-danger)]/10 text-[var(--color-danger)] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={40} />
                </div>
                <h3 className="text-2xl font-bold text-[var(--color-text-primary)]">Waste Tracking Ready</h3>
                <p className="text-[var(--color-text-secondary)] max-w-sm mx-auto mt-2">Record spillage, expiry, and damages to maintain precise inventory capital.</p>
                <button 
                  onClick={() => setIsWasteModalOpen(true)}
                  className="mt-8 px-8 py-4 bg-[var(--color-danger)] text-[var(--color-bg-base)] rounded-xl text-xs font-bold uppercase tracking-normal  transition-transform shadow-sm "
                >
                  Log Waste Record
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
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Quantity</label>
                <input 
                  type="number"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Cost Per Unit</label>
                <input 
                  type="number"
                  required
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({...formData, costPerUnit: e.target.value})}
                  className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  placeholder="₹ 0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Min Threshold (Alert)</label>
              <input 
                type="number"
                value={formData.minThreshold}
                onChange={(e) => setFormData({...formData, minThreshold: e.target.value})}
                className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                placeholder="10"
              />
            </div>

            <Button 
              type="submit" 
              loading={submitting} 
              className="w-full py-4 rounded-xl font-bold uppercase tracking-normal"
            >
              {isUpdateModalOpen ? 'Update Stock' : 'Add to Inventory'}
            </Button>
          </form>
        </Modal>

        <Modal 
          isOpen={isWasteModalOpen} 
          onClose={() => setIsWasteModalOpen(false)}
          title="Log Waste Record"
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
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Quantity</label>
                <input 
                  type="number"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  placeholder="0.00"
                />
              </div>
              <PremiumSelect 
                label="Reason"
                value={formData.reason}
                onChange={(val) => setFormData({...formData, reason: val})}
                options={[
                  { label: 'Spillage', value: 'spillage' },
                  { label: 'Expiry', value: 'expiry' },
                  { label: 'Damage', value: 'damage' },
                  { label: 'Other', value: 'other' }
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Notes</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none min-h-[100px] resize-none"
                placeholder="Details about the waste..."
              />
            </div>

            <Button 
              type="submit" 
              variant="danger"
              loading={submitting} 
              className="w-full py-4 rounded-xl font-bold uppercase tracking-normal shadow-sm "
            >
              Confirm Waste Log
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
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Ingredient Name</label>
              <input 
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                placeholder="e.g. Milk, Coffee Beans"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Unit</label>
                <input 
                  type="text"
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                  placeholder="kg, ltr, pcs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal ml-1">Base Cost</label>
                <input 
                  type="number"
                  value={formData.baseCost}
                  onChange={(e) => setFormData({...formData, baseCost: e.target.value})}
                  className="w-full px-5 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
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
              className="w-full py-4 rounded-xl font-bold uppercase tracking-normal"
            >
              Create Ingredient
            </Button>
          </form>
        </Modal>
      </div>
    </PageTransition>
  );
}
