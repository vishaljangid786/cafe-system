'use client';
import { blockNegative, blockNonInteger } from '@/app/utils/inputValidation';
import {
  UtensilsCrossed, Search, Plus, Filter,
  Edit2, Trash2, CheckCircle2, XCircle,
  Clock, IndianRupee, Image as ImageIcon,
  ChevronRight, Layers, Package, Save, X,
  FileText, List, ChevronDown, ChevronUp, Minus,
  Zap,
  Users,
  MapPin,
  TrendingDown,
  TrendingUp,
  Utensils,
  Target,
  Leaf,
  Drumstick,
} from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Card, CardTitle, CardDescription } from '../../../components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import ExportActions from '../../../components/ui/ExportActions';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import { LoaderBlock } from '@/app/components/ui/Spinner';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { CardSkeleton } from '@/app/components/ui/Skeleton';
import useConfirm from '@/app/components/ui/useConfirm';

const COLORS = ['#f59e0b', '#ea580c', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const SUGGESTED_ICONS = [
  '🍽️', '🍕', '🍔', '🍟', '🌭', '🍿', '🥗', '🍝', '🍜', '🍲', '🍣', '🍱', '🍛', '🍚', '🥯', '🥞', '🥓', '🍳', '🍞', '🥐',
  '🍰', '🍦', '🍩', '🍪', '🍫', '☕', '🍵', '🧃', '🥤', '🍺', '🍸', '🍹', '🍷', '🥂', '🍗', '🥩', '🐟', '🍤', '🌮', '🌯'
];

export default function MenuManagementPage() {
  const { confirm, confirmDialog } = useConfirm();
  const router = useRouter();
  const { selectedLocation, switchLocation, user } = useAuth();
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'categories'
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;
  const [graphMetric, setGraphMetric] = useState('value'); // 'value' (revenue) or 'count' (volume)

  // Analytics states
  const [locations, setLocations] = useState([]);
  const [filterLocation, setFilterLocation] = useState('all');
  const [timeFilter, setTimeFilter] = useState('7d');
  const [customDates, setCustomDates] = useState({ start: '', end: '' });
  const [isLocSelectorOpen, setIsLocSelectorOpen] = useState(false);

  const [analytics, setAnalytics] = useState({
    summary: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, netProfit: 0, totalExpenses: 0 },
    timeSeries: [],
    categorySales: [],
    staffPerformance: []
  });


  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (error) {
      console.error("Failed to fetch locations");
    }
  };

  const fetchAnalytics = async () => {
    progress.start();
    try {
      const locId = filterLocation === 'all' ? '' : filterLocation;
      let query = `?locationId=${locId}`;

      const now = new Date();
      let start = '';
      if (timeFilter === '7d') {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        start = d.toISOString().split('T')[0];
      } else if (timeFilter === '30d') {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        start = d.toISOString().split('T')[0];
      } else if (timeFilter === 'custom' && customDates.start) {
        start = customDates.start;
        if (customDates.end) query += `&endDate=${customDates.end}`;
      }

      if (start) query += `&startDate=${start}`;

      const res = await api.get(`/analytics/advanced${query}`);
      if (res.data.success) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error("Analytics sync error:", error);
    } finally {
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAnalytics();
    }, 0);
    return () => clearTimeout(timer);
  }, [filterLocation, timeFilter, customDates]);

  useEffect(() => {
    if (selectedLocation) {
      const timer = setTimeout(() => {
        setFilterLocation(selectedLocation._id || selectedLocation);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedLocation]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('All'); // 'All', 'Available', 'Unavailable'
  const [dietaryFilter, setDietaryFilter] = useState('All'); // 'All', 'veg', 'non-veg'

  // Modals state
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const itemFileRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [categoryIcon, setCategoryIcon] = useState('🍽️');
  const [itemCategory, setItemCategory] = useState('');
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [isGlobalItem, setIsGlobalItem] = useState(false);
  const [itemDietaryType, setItemDietaryType] = useState('veg');
  const [modifierGroups, setModifierGroups] = useState([]); // [{name, selectionType, required, maxSelections, options:[{label, priceDelta}]}]

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingItem) {
        setItemCategory(editingItem.category?._id || '');
        setSelectedBranches(editingItem.availableBranches || []);
        setIsGlobalItem(editingItem.isGlobal || false);
        setItemDietaryType(editingItem.dietaryType || 'veg');
        setModifierGroups(Array.isArray(editingItem.modifierGroups) ? editingItem.modifierGroups.map(g => ({ ...g, options: [...(g.options || [])] })) : []);
      } else {
        setItemCategory('');
        setSelectedBranches(selectedLocation ? [selectedLocation._id || selectedLocation] : []);
        setIsGlobalItem(false);
        setItemDietaryType('veg');
        setModifierGroups([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editingItem, selectedLocation]);
  const [editingCategory, setEditingCategory] = useState(null);

  // Recipe state
  const [showRecipeEditor, setShowRecipeEditor] = useState(false);
  const [recipeData, setRecipeData] = useState({
    ingredients: [{ name: '', quantity: '', unit: 'grams' }],
    instructions: [{ step: 1, text: '' }],
    notes: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingCategory) {
        setCategoryIcon(editingCategory.icon || '🍽️');
      } else {
        setCategoryIcon('🍽️');
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editingCategory]);

  const fetchData = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = {};

      const targetLoc = filterLocation !== 'all' ? filterLocation : (selectedLocation?._id || selectedLocation);
      if (targetLoc && targetLoc !== 'all') params.locationId = targetLoc;
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (minPrice !== '') params.minPrice = minPrice;
      if (maxPrice !== '') params.maxPrice = maxPrice;
      if (availabilityFilter === 'Available') params.isAvailable = true;
      if (availabilityFilter === 'Unavailable') params.isAvailable = false;
      if (dietaryFilter !== 'All') params.dietary = dietaryFilter;
      params.page = currentPage;
      params.limit = itemsPerPage;

      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu', { params }),
        api.get('/categories')
      ]);
      setMenuItems(itemsRes.data.data);
      setTotalPages(itemsRes.data.pagination?.pages || 1);
      setCategories(catsRes.data.data);
    } catch (error) {
      toast.error('Could not load menu items');
      console.error(error);
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedLocation, filterLocation, currentPage, searchTerm, selectedCategory, minPrice, maxPrice, availabilityFilter, dietaryFilter]);

  const fetchRecipe = async (menuItemId) => {
    try {
      const res = await api.get(`/recipes/${menuItemId}`);
      setRecipeData(res.data.data);
    } catch (error) {
      setRecipeData({
        ingredients: [{ name: '', quantity: '', unit: 'grams' }],
        instructions: [{ step: 1, text: '' }],
        notes: ''
      });
    }
  };

  // Category CRUD
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.isActive = formData.get('isActive') === 'on';

    const loadToast = toast.loading(editingCategory ? 'Updating category...' : 'Creating category...');
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory._id}`, data);
        toast.success('Category updated', { id: loadToast });
      } else {
        await api.post('/categories', data);
        toast.success('New category created', { id: loadToast });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
    }
  };

  const deleteCategory = async (id) => {
    if (!(await confirm({ title: 'Turn off category?', message: 'All items in this category will be unassigned.', confirmText: 'Turn Off' }))) return;
    const loadToast = toast.loading('Turning off category...');
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category turned off', { id: loadToast });
      fetchData();
    } catch (error) {
      toast.error('Could not turn off category. Please try again.', { id: loadToast });
    }
  };

  // MenuItem CRUD
  const handleItemSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Image requirement check for new items
    if (!editingItem && !itemFileRef.current?.files[0]) {
      return toast.error("Image is required for new items");
    }

    formData.set('isGlobal', isGlobalItem);
    formData.delete('availableBranches'); // Clean up any existing
    if (!isGlobalItem) {
      selectedBranches.forEach(id => {
        formData.append('availableBranches', id);
        // Add branch-specific stock
        const stockVal = formData.get(`stock_${id}`);
        if (stockVal !== null) {
          formData.append(`branchStock_${id}`, stockVal);
        }
      });
    }
    formData.set('dietaryType', itemDietaryType);
    // Modifier groups are nested — send as JSON (server parses the string).
    formData.set('modifierGroups', JSON.stringify((modifierGroups || []).filter(g => (g.name || '').trim() && (g.options || []).some(o => (o.label || '').trim()))));

    // Validation: discountedPrice < originalPrice
    const originalPrice = formData.get('originalPrice') ? parseFloat(formData.get('originalPrice')) : null;
    const discPrice = formData.get('discountedPrice') ? parseFloat(formData.get('discountedPrice')) : null;

    if (originalPrice && discPrice && discPrice >= originalPrice) {
      return toast.error(`Offer Price (₹${discPrice}) cannot be higher than the Original Price (₹${originalPrice})`);
    }

    const loadToast = toast.loading(editingItem ? 'Updating item...' : 'Adding item...');
    try {
      let itemId;
      if (editingItem) {
        const res = await api.put(`/menu/${editingItem._id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        itemId = res.data.data._id;
        toast.success('Item updated', { id: loadToast });
      } else {
        const res = await api.post('/menu', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        itemId = res.data.data._id;
        toast.success('Item added', { id: loadToast });
      }

      // Handle Recipe Upsert if visible
      if (showRecipeEditor) {
        await api.post('/recipes', {
          menuItemId: itemId,
          ...recipeData
        });
        toast.success('Recipe updated');
      }

      setShowItemModal(false);
      setEditingItem(null);
      setImagePreview(null);
      setShowRecipeEditor(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong. Please try again.', { id: loadToast });
    }
  };

  const toggleAvailability = async (id) => {
    try {
      await api.put(`/menu/${id}/availability`);
      setMenuItems(items => items.map(item =>
        item._id === id ? { ...item, isAvailable: !item.isAvailable } : item
      ));
      toast.success('Availability updated');
    } catch (error) {
      toast.error('Could not update availability. Please try again.');
    }
  };

  const deleteItem = async (id) => {
    if (!(await confirm({ title: 'Delete item?', message: 'This permanently deletes the menu item.', confirmText: 'Delete' }))) return;
    const loadToast = toast.loading('Deleting item...');
    try {
      await api.delete(`/menu/${id}`);
      toast.success('Item deleted', { id: loadToast });
      fetchData();
    } catch (error) {
      toast.error('Could not delete item. Please try again.', { id: loadToast });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Recipe Editor Handlers
  const addIngredient = () => {
    setRecipeData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', quantity: '', unit: 'grams' }]
    }));
  };

  const updateIngredient = (index, field, value) => {
    const newIngredients = [...recipeData.ingredients];
    newIngredients[index][field] = value;
    setRecipeData(prev => ({ ...prev, ingredients: newIngredients }));
  };

  const removeIngredient = (index) => {
    setRecipeData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const addInstruction = () => {
    setRecipeData(prev => ({
      ...prev,
      instructions: [...prev.instructions, { step: prev.instructions.length + 1, text: '' }]
    }));
  };

  const updateInstruction = (index, value) => {
    const newInstructions = [...recipeData.instructions];
    newInstructions[index].text = value;
    setRecipeData(prev => ({ ...prev, instructions: newInstructions }));
  };

  const removeInstruction = (index) => {
    setRecipeData(prev => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index).map((ins, i) => ({ ...ins, step: i + 1 }))
    }));
  };

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category?.name === selectedCategory;

    const price = item.discountedPrice || item.price;
    const matchesMinPrice = minPrice === '' || price >= parseFloat(minPrice);
    const matchesMaxPrice = maxPrice === '' || price <= parseFloat(maxPrice);

    const matchesAvailability =
      availabilityFilter === 'All' ||
      (availabilityFilter === 'Available' && item.isAvailable) ||
      (availabilityFilter === 'Unavailable' && !item.isAvailable);

    const matchesDietary = dietaryFilter === 'All' || item.dietaryType === dietaryFilter;

    return matchesSearch && matchesCat && matchesMinPrice && matchesMaxPrice && matchesAvailability && matchesDietary;
  });

  const filteredCategories = categories.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAvailability =
      availabilityFilter === 'All' ||
      (availabilityFilter === 'Available' && cat.isActive) ||
      (availabilityFilter === 'Unavailable' && !cat.isActive);

    const matchesCat = selectedCategory === 'All' || cat.name === selectedCategory;

    // Price filter for categories: show category if any item within it matches price range
    // Or if no items exist in category and no price filter is active
    const isPriceFilterActive = minPrice !== '' || maxPrice !== '';
    const itemsInCat = menuItems.filter(item => (item.category?._id || item.category) === cat._id);
    const matchesPrice = itemsInCat.some(item => {
      const price = item.discountedPrice || item.price;
      return (minPrice === '' || price >= parseFloat(minPrice)) &&
        (maxPrice === '' || price <= parseFloat(maxPrice));
    });

    return matchesSearch && matchesAvailability && matchesCat && (!isPriceFilterActive || matchesPrice);
  });

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-(--color-text-primary) flex items-center tracking-tight leading-none">
              <Utensils className="mr-4 text-primary" size={36} strokeWidth={2.5} /> Menu <span className="text-primary ml-3">Management</span>
            </h1>
            <p className="text-(--color-text-muted) text-sm mt-3 font-medium flex items-center">
              <Target size={14} className="mr-2 text-primary" /> Manage food items and categories for your branches.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border)">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-normal transition-all flex items-center gap-2 ${activeTab === 'items' ? 'bg-primary text-(--color-bg-base) shadow-lg ' : 'text-(--color-text-muted) hover:bg-(--color-bg-soft)'}`}
            >
              <Package size={16} /> Items
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-normal transition-all flex items-center gap-2 ${activeTab === 'categories' ? 'bg-primary text-(--color-bg-base) shadow-lg ' : 'text-(--color-text-muted) hover:bg-(--color-bg-soft)'}`}
            >
              <Layers size={16} /> Categories
            </button>
          </div>
        </div>

        {/* Analytics Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Location Selector */}
            <PremiumSelect
              icon={MapPin}
              label="Branch"
              value={typeof selectedLocation === 'object' ? selectedLocation?._id : (selectedLocation || 'all')}
              onChange={(val) => {
                const loc = val === 'all' ? 'all' : locations.find(l => l._id === val);
                switchLocation(loc);
              }}
              options={[
                { label: 'All Branches', value: 'all' },
                ...locations.map(loc => ({ label: loc.name, value: loc._id }))
              ]}
              className="min-w-50"
            />

            {/* Time Filter */}
            <div className="flex items-center gap-3 bg-(--color-surface-soft) p-1.5 rounded-xl border border-(--color-border) shadow-sm  overflow-x-auto no-scrollbar max-w-full">
              {['7d', '30d', 'all', 'custom'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-normal rounded-xl transition-all ${timeFilter === t ? 'bg-primary text-(--color-bg-base) shadow-lg ' : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-bg-soft)'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {timeFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 p-6 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-sm"
          >
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">Start Date</label>
              <input type="date" className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={customDates.start} onChange={e => setCustomDates({ ...customDates, start: e.target.value })} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase text-(--color-text-muted) mb-2 ml-1">End Date</label>
              <input type="date" className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-3 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={customDates.end} onChange={e => setCustomDates({ ...customDates, end: e.target.value })} />
            </div>
          </motion.div>
        )}

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="!p-8 bg-(--color-surface) border-(--color-border) shadow-sm" hover={false}>
            <div className="flex items-center justify-between mb-8">
              <CardTitle className="text-lg">Popular Categories</CardTitle>
              <div className="flex bg-(--color-bg-soft) p-1 rounded-lg border border-(--color-border) shadow-inner">
                <button
                  onClick={() => setGraphMetric('value')}
                  className={`px-3 py-1 text-[8px] font-bold uppercase tracking-normal rounded-md transition-all ${graphMetric === 'value' ? 'bg-primary text-(--color-bg-base) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setGraphMetric('count')}
                  className={`px-3 py-1 text-[8px] font-bold uppercase tracking-normal rounded-md transition-all ${graphMetric === 'count' ? 'bg-primary text-(--color-bg-base) shadow-sm' : 'text-(--color-text-muted) hover:text-(--color-text-primary)'}`}
                >
                  Volume
                </button>
              </div>
            </div>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics?.categorySales}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={10}
                    dataKey={graphMetric}
                  >
                    {analytics?.categorySales?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    itemStyle={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: '900' }}
                    labelStyle={{ display: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-(--color-text-primary)">
                  {graphMetric === 'value' ? `₹${analytics?.summary?.totalRevenue?.toLocaleString()}` : analytics?.summary?.totalOrders}
                </span>
                <span className="text-[8px] font-bold text-(--color-text-muted) uppercase tracking-normal">
                  {graphMetric === 'value' ? 'Total Revenue' : 'Total Orders'}
                </span>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {analytics?.categorySales?.slice(0, 4).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-xs font-bold text-(--color-text-muted)">{cat.name}</span>
                  </div>
                  <span className="text-xs font-bold text-(--color-text-primary)">
                    {graphMetric === 'value' ? `₹${cat.value.toLocaleString()}` : `${cat.count} Units`}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Crew Spotlight */}
          <Card className="lg:col-span-2 !p-8 bg-(--color-surface) border-(--color-border) shadow-sm overflow-hidden relative" hover={false}>
            <div className="absolute -right-20 -top-20 h-64 w-64 bg-primary/5 rounded-full hidden" />

            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <CardTitle className="text-lg">Top Staff</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Staff performance</CardDescription>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users size={18} />
              </div>
            </div>

            <div className="relative z-10">
              {analytics?.staffPerformance?.length === 1 ? (
                /* Solo Hero View */
                <div className="flex flex-col items-center justify-center py-10 text-center bg-primary/[0.02] rounded-xl border border-dashed border-primary/20">
                  <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 border border-primary/20 shadow-sm ">
                    <Zap size={40} className="text-primary animate-pulse" />
                  </div>
                  <h4 className="text-2xl font-bold text-(--color-text-primary) uppercase tracking-tight max-w-md">
                    <span className="text-primary">{analytics.staffPerformance[0].name}</span> is handling everything alone
                  </h4>
                  <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-2">Top Performer</p>

                  <div className="flex gap-12 mt-10">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-(--color-text-primary) tracking-tight">{analytics.staffPerformance[0].totalOrders}</p>
                      <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">Orders</p>
                    </div>
                    <div className="h-12 w-px bg-(--color-border)" />
                    <div className="text-center">
                      <p className="text-3xl font-bold text-(--color-text-primary) tracking-tight">₹{analytics.staffPerformance[0].revenue.toLocaleString()}</p>
                      <p className="text-[8px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1">Total Earnings</p>
                    </div>
                  </div>
                </div>
              ) : analytics?.staffPerformance?.length > 1 ? (
                /* Team Mosaic View */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics?.staffPerformance?.slice(0, 4).map((staff, idx) => (
                    <div key={idx} className="group p-5 rounded-xl bg-(--color-surface-soft) border border-(--color-border) hover:border-primary/30 transition-all duration-500">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-(--color-surface) border border-(--color-border) flex items-center justify-center font-bold text-primary text-xs shadow-sm">
                          {staff.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-(--color-text-primary) truncate">{staff.name}</span>
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">Rank #{idx + 1}</span>
                          </div>
                          <p className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-normal mt-0.5">{staff.totalOrders} Orders</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[8px] font-bold text-(--color-text-muted) uppercase tracking-normal">Performance</span>
                          <span className="text-xs font-bold text-(--color-text-primary)">₹{staff.revenue.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-(--color-bg-soft) rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(staff.revenue / (analytics?.staffPerformance[0]?.revenue || 1)) * 100}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-primary rounded-full "
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                  <Users size={32} className="mb-4" />
                  <p className="text-[10px] font-bold uppercase tracking-normal">No Staff Data Yet</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Control Center */}
        <SlideIn direction="down">
          <div className="bg-(--color-surface) p-6 md:p-10 rounded-xl border border-(--color-border) shadow-sm space-y-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={activeTab === 'items' ? "Search food items..." : "Search food categories..."}
                  className="w-full pl-14 pr-6 py-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm shadow-inner transition-all text-(--color-text-primary)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-3 h-14 px-6 rounded-xl border transition-all font-bold text-xs uppercase tracking-normal ${showFilters ? 'bg-primary border-primary-dark text-(--color-bg-base) shadow-lg ' : 'bg-(--color-surface) border-(--color-border) text-(--color-text-muted) hover:border-primary/30'}`}
                >
                  <Filter size={18} />
                  Filters
                </button>

                <div className="h-10 w-px bg-(--color-border) mx-1 hidden sm:block" />
                <div className="flex items-center gap-3 flex-1 sm:flex-none">
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (activeTab === 'items') {
                        setEditingItem(null);
                        setImagePreview(null);
                        setShowItemModal(true);
                      } else {
                        setEditingCategory(null);
                        setShowCategoryModal(true);
                      }
                    }}
                    className="flex-1 sm:flex-none h-14 px-8 rounded-xl bg-primary text-(--color-bg-base) border-none hover:bg-primary/90 transition-all gap-3"
                  >
                    <Plus size={20} strokeWidth={3} />
                    <span className="font-bold text-xs uppercase tracking-normal">Add New</span>
                  </Button>

                  <ExportActions
                    data={activeTab === 'items' ? filteredItems : filteredCategories}
                    columns={activeTab === 'items' ? [
                      { header: 'Name', key: 'name' },
                      { header: 'Category', key: item => item.category?.name || 'Uncategorized' },
                      { header: 'Price', key: 'price' },
                      { header: 'Sale Price', key: 'discountedPrice' },
                      { header: 'Available', key: item => item.isAvailable ? 'Yes' : 'No' }
                    ] : [
                      { header: 'Name', key: 'name' },
                      { header: 'Order', key: 'sortOrder' },
                      { header: 'Status', key: item => item.isActive ? 'Active' : 'Inactive' }
                    ]}
                    filename={activeTab === 'items' ? 'inventory' : 'categories'}
                  />
                </div>
              </div>
            </div>
            {menuItems.some(i => i.dietaryType === 'veg') && menuItems.some(i => i.dietaryType === 'non-veg') && (
              <div className="flex bg-(--color-surface-soft) p-1 rounded-xl border border-(--color-border) mt-4 w-fit">
                {[
                  { id: 'All', label: 'All Items' },
                  { id: 'veg', label: 'Veg Only', color: 'text-success' },
                  { id: 'non-veg', label: 'Non-Veg', color: 'text-danger' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDietaryFilter(f.id)}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-normal transition-all ${dietaryFilter === f.id
                      ? 'bg-primary text-(--color-bg-base) shadow-sm'
                      : 'text-(--color-text-muted) hover:text-(--color-text-primary)'
                      } ${f.color || ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push('/dashboard/admin/expenses')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 text-danger text-[10px] font-bold uppercase tracking-normal hover:bg-danger hover:text-(--color-bg-base) transition-all"
              >
                <TrendingDown size={14} /> Expenses
              </button>
              <button
                onClick={() => router.push('/dashboard/admin/revenue')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 text-success text-[10px] font-bold uppercase tracking-normal hover:bg-success hover:text-(--color-bg-base) transition-all"
              >
                <TrendingUp size={14} /> Income
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-8 mt-6 bg-(--color-surface-soft) rounded-xl border border-(--color-border) shadow-inner">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                      <PremiumSelect
                        label="Category"
                        value={selectedCategory}
                        onChange={(val) => setSelectedCategory(val)}
                        options={[
                          { label: 'All Categories', value: 'All' },
                          ...categories.map(cat => ({ label: cat.name, value: cat.name }))
                        ]}
                      />

                      {activeTab !== 'categories' && (
                        <>
                          <PremiumSelect
                            label="Status"
                            value={availabilityFilter}
                            onChange={(val) => setAvailabilityFilter(val)}
                            options={[
                              { label: 'All Status', value: 'All' },
                              { label: 'Active Only', value: 'Available' },
                              { label: 'Inactive Only', value: 'Unavailable' }
                            ]}
                          />

                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Min Price</label>
                            <div className="relative">
                              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={14} />
                              <input
                                type="number"
                                min="0"
                                onKeyDown={blockNegative}
                                placeholder="Min"
                                className="w-full pl-10 pr-4 py-4 bg-(--color-surface) border border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm shadow-sm transition-all text-(--color-text-primary)"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Max Price</label>
                            <div className="relative">
                              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={14} />
                              <input
                                type="number"
                                min="0"
                                onKeyDown={blockNegative}
                                placeholder="Max"
                                className="w-full pl-10 pr-4 py-4 bg-(--color-surface) border border-(--color-border) rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm shadow-sm transition-all text-(--color-text-primary)"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                              />
                            </div>
                          </div>

                          <PremiumSelect
                            label="Dietary"
                            value={dietaryFilter}
                            onChange={(val) => setDietaryFilter(val)}
                            options={[
                              { label: 'All Dietary', value: 'All' },
                              { label: 'Veg Only', value: 'veg' },
                              { label: 'Non-Veg Only', value: 'non-veg' }
                            ]}
                          /></>
                      )}
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('All');
                          setAvailabilityFilter('All');
                          setMinPrice('');
                          setMaxPrice('');
                          setDietaryFilter('All');
                          setCurrentPage(1);
                        }}
                        className="text-[10px] font-bold uppercase tracking-normal text-primary-dark dark:text-primary hover:opacity-80 transition-colors py-2 px-4 bg-primary/10 rounded-xl"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SlideIn>

        {refetching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : activeTab === 'items' ? (
          /* Items Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredItems.map((item, i) => (
                <SlideIn key={item._id} delay={i * 0.05}>
                  <CardHover>
                    <div className={`group bg-(--color-surface) rounded-xl overflow-hidden border border-(--color-border) relative flex flex-col h-full transition-all duration-300 ${!item.isAvailable && 'opacity-60 grayscale'}`}>
                      {/* Image */}
                      <div className="h-52 relative overflow-hidden bg-(--color-surface-soft)">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-(--color-text-muted)">
                            <ImageIcon size={48} strokeWidth={1} />
                          </div>
                        )}
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                          <span className="px-3 py-1 bg-(--color-surface)/80  rounded-full text-[10px] font-bold uppercase tracking-normal border border-(--color-border) text-(--color-text-primary)">
                            {item.category?.name || 'Uncategorized'}
                          </span>
                          <span className={`px-3 py-1  rounded-full text-[8px] font-bold uppercase tracking-normal border self-start ${item.dietaryType === 'veg' ? 'bg-success/20 border-success/30 text-success' : 'bg-danger/20 border-danger/30 text-danger'
                            }`}>
                            {item.dietaryType}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleAvailability(item._id)}
                          className={`absolute top-4 right-4 p-2 rounded-xl  border transition-all ${item.isAvailable ? 'bg-success/20 border-success/30 text-success' : 'bg-danger/20 border-danger/30 text-danger'}`}
                        >
                          {item.isAvailable ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        </button>

                        {item.discountedPrice && (
                          <div className="absolute bottom-4 left-4">
                            <span className="px-3 py-1 bg-primary text-(--color-bg-base) rounded-full text-[10px] font-bold uppercase tracking-normal shadow-lg ">
                              Sale
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-6 md:p-8 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-bold tracking-tight line-clamp-1 text-(--color-text-primary)">{item.name}</h3>
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-primary flex items-center">
                              <IndianRupee size={16} />{item.discountedPrice || item.price}
                            </span>
                            {(item.discountedPrice || item.originalPrice) && (
                              <span className="text-[10px] text-(--color-text-muted) line-through font-bold">
                                ₹{item.originalPrice || item.price}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-(--color-text-muted) line-clamp-2 font-medium mb-6 leading-relaxed">
                          {item.description || 'No description added.'}
                        </p>

                        <div className="mt-auto flex items-center justify-between border-t border-(--color-border) pt-5">
                          <div className="flex items-center gap-2 text-(--color-text-muted) text-[10px] font-bold uppercase tracking-normal">
                            <Clock size={14} className="text-primary-dark dark:text-primary" />
                            {item.preparationTime} Min
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                                setImagePreview(item.image);
                                fetchRecipe(item._id);
                              }}
                              className="p-3 rounded-xl bg-(--color-surface-soft) hover:bg-primary text-(--color-text-muted) hover:text-(--color-bg-base) transition-all shadow-sm"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteItem(item._id)}
                              className="p-3 rounded-xl bg-danger/10 hover:bg-[rgba(var(--color-danger-rgb),0.12)] text-danger hover:text-(--color-bg-base) transition-all shadow-sm"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHover>
                </SlideIn>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* Categories Management */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map((cat, i) => (
              <SlideIn key={cat._id} delay={i * 0.05}>
                <Card className="!p-8 group relative overflow-hidden border border-(--color-border) hover:border-primary/30 transition-all">
                  <div className="absolute top-0 right-0 p-8 text-primary opacity-5 group-hover:opacity-10 transition-opacity">
                    <Layers size={80} />
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                      {cat.icon || '🍽️'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-(--color-text-primary)">{cat.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                          Items: {menuItems.filter(m => (m.category?._id || m.category) === cat._id).length}
                        </p>
                        <div className="h-1 w-1 rounded-full bg-(--color-border)" />
                        <p className="text-[9px] font-bold uppercase tracking-normal text-primary">
                          Sold: {analytics.categorySales.find(cs => cs.name === cat.name)?.count || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-(--color-text-muted) font-medium mb-8 min-h-10">{cat.description || 'No description added.'}</p>

                  <div className="flex justify-between items-center pt-4 border-t border-(--color-border)">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-normal ${cat.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingCategory(cat); setShowCategoryModal(true); }}
                        className="p-2.5 rounded-xl bg-(--color-surface-soft) hover:bg-primary text-(--color-text-muted) hover:text-(--color-bg-base) transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteCategory(cat._id)}
                        className="p-2.5 rounded-xl bg-danger/10 hover:bg-[rgba(var(--color-danger-rgb),0.12)] text-danger hover:text-(--color-bg-base) transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </Card>
              </SlideIn>
            ))}
          </div>
        )}

        {/* Item Modal */}
        <Modal
          isOpen={showItemModal}
          onClose={() => { setShowItemModal(false); setEditingItem(null); setImagePreview(null); setShowRecipeEditor(false); }}
          title={editingItem ? "Edit Item" : "Add New Item"}
          maxWidth="max-w-5xl"
        >
          <form onSubmit={handleItemSubmit} className="p-2 space-y-12">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-10">

                {/* Specifications */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <UtensilsCrossed size={16} />
                    </div>
                    <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Details</h4>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Item Name</label>
                      <input
                        name="name"
                        defaultValue={editingItem?.name}
                        required
                        className="w-full px-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                        placeholder="e.g. Masala Dosa"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <input type="hidden" name="category" value={itemCategory} />
                        <PremiumSelect
                          label="Category"
                          value={itemCategory}
                          onChange={(val) => setItemCategory(val)}
                          placeholder="Select Category"
                          options={categories.map(cat => ({ label: cat.name, value: cat._id }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Prep Time (Min)</label>
                        <div className="relative">
                          <input
                            name="preparationTime"
                            type="number"
                            min="0"
                            onKeyDown={blockNonInteger}
                            defaultValue={editingItem?.preparationTime || 10}
                            required
                            className="w-full px-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                          />
                          <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Description</label>
                      <textarea
                        name="description"
                        defaultValue={editingItem?.description}
                        rows="3"
                        className="w-full px-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all resize-none text-(--color-text-primary)"
                        placeholder="Describe the item..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Dietary Type</label>
                      <div className="flex gap-4">
                        {['veg', 'non-veg'].map((type) => {
                          const isInvalid = !isGlobalItem && selectedBranches.some(branchId => {
                            const branch = locations.find(l => l._id === branchId);
                            if (branch?.dietaryType === 'veg' && type === 'non-veg') return true;
                            if (branch?.dietaryType === 'non-veg' && type === 'veg') return true;
                            return false;
                          });

                          return (
                            <label
                              key={type}
                              className={`flex-1 flex items-center justify-center gap-3 p-4 bg-(--color-bg-soft) rounded-xl border transition-all ${isInvalid ? 'opacity-40 cursor-not-allowed border-danger/20' : 'border-(--color-border) cursor-pointer hover:border-primary/50'}`}
                            >
                              <input
                                type="radio"
                                name="dietaryType"
                                value={type}
                                checked={itemDietaryType === type}
                                onChange={() => !isInvalid && setItemDietaryType(type)}
                                disabled={isInvalid}
                                className="w-4 h-4 accent-primary"
                              />
                              <span className={`text-[10px] font-bold uppercase tracking-normal ${type === 'veg' ? 'text-success' : 'text-danger'}`}>
                                {type}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {!isGlobalItem && selectedBranches.some(branchId => {
                        const branch = locations.find(l => l._id === branchId);
                        return branch?.dietaryType === 'veg' || branch?.dietaryType === 'non-veg';
                      }) && (
                          <p className="text-[8px] font-bold text-primary mt-2 uppercase tracking-tight italic">
                            * Some selected branches have strict dietary restrictions.
                          </p>
                        )}
                    </div>
                  </div>
                </section>

                {/* Pricing */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center text-success">
                      <IndianRupee size={16} />
                    </div>
                    <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Pricing</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Base Price (₹)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) font-bold">₹</span>
                          <input
                            name="price"
                            type="number"
                            min="0"
                            onKeyDown={blockNegative}
                            defaultValue={editingItem?.price}
                            required
                            className="w-full pl-10 pr-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                          />
                        </div>
                      </div>
                      {(user?.role === 'admin' || user?.role === 'location_admin' || user?.role === 'super_admin') && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-normal text-primary-dark dark:text-primary ml-1">Cost Price (₹)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50 font-bold">₹</span>
                            <input
                              name="costPrice"
                              type="number"
                              min="0"
                              onKeyDown={blockNegative}
                              defaultValue={editingItem?.costPrice || 0}
                              required
                              className="w-full pl-10 pr-5 py-4 bg-primary/5 rounded-xl border border-primary/20 outline-none focus:ring-2 focus:ring-primary font-bold text-primary-dark dark:text-primary transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 p-5 bg-(--color-surface-soft) rounded-xl border border-dashed border-(--color-border)">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Original Price (Strikethrough ₹)</label>
                        <input
                          name="originalPrice"
                          type="number"
                          min="0"
                          onKeyDown={blockNegative}
                          defaultValue={editingItem?.originalPrice}
                          className="w-full px-4 py-3 bg-(--color-surface) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                          placeholder="The 'Old' price"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Offer Price (New Payable ₹)</label>
                        <input
                          name="discountedPrice"
                          type="number"
                          min="0"
                          onKeyDown={blockNegative}
                          defaultValue={editingItem?.discountedPrice}
                          className="w-full px-4 py-3 bg-(--color-surface) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                          placeholder="The 'Sale' price"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-5 space-y-10">

                {/* Visuals */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <ImageIcon size={16} />
                    </div>
                    <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Item Photo</h4>
                  </div>

                  <div
                    onClick={() => itemFileRef.current.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-(--color-border) flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all overflow-hidden relative group"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} className="w-full h-full object-cover transition-transform duration-700" />
                        <div className="absolute inset-0 bg-(--color-bg-deep)/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-(--color-bg-base) p-6 text-center">
                          <div className="h-12 w-12 rounded-full bg-(--color-bg-base)/20  flex items-center justify-center mb-3">
                            <ImageIcon size={20} />
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-normal">Change Image</p>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center space-y-4">
                        <div className="h-20 w-20 rounded-xl bg-(--color-bg-soft) flex items-center justify-center mx-auto text-(--color-text-muted) transition-transform group-hover:text-primary">
                          <ImageIcon size={32} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Add Image</p>
                          <p className="text-[8px] text-(--color-text-muted) uppercase mt-1">PNG / WEBP Supported</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    name="image" 
                    ref={itemFileRef} 
                    onChange={handleImageChange} 
                    className="hidden" 
                    accept="image/*"
                    required={!editingItem}
                  />
                </section>

                {/* Status */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-(--color-text-muted)/10 flex items-center justify-center text-(--color-text-muted)">
                      <Zap size={16} />
                    </div>
                    <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Settings</h4>
                  </div>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between p-5 bg-(--color-bg-soft) rounded-xl border border-(--color-border) cursor-pointer group">
                      <span className="text-xs font-bold text-(--color-text-primary)">Available for ordering</span>
                      <input
                        type="checkbox"
                        name="isAvailable"
                        defaultChecked={editingItem ? editingItem.isAvailable : true}
                        className="w-5 h-5 accent-primary rounded-lg"
                      />
                    </label>

                    {(user?.role === 'admin' || user?.role === 'super_admin' || user?.permissions?.manageGlobalMenu === true) && (
                      <div className="space-y-4">
                        <label className="flex items-center justify-between p-5 bg-(--color-bg-soft) rounded-xl border border-(--color-border) cursor-pointer group">
                          <div>
                            <span className="text-xs font-bold text-(--color-text-primary) block">Global Item</span>
                            <span className="text-[8px] font-bold text-(--color-text-muted) uppercase tracking-tight italic">Available for every branch</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isGlobalItem}
                            onChange={(e) => setIsGlobalItem(e.target.checked)}
                            className="w-5 h-5 accent-primary rounded-lg"
                          />
                        </label>

                        {!isGlobalItem && (
                          <>
                            <div className="space-y-3 p-5 bg-(--color-bg-soft) rounded-xl border border-(--color-border)">
                              <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Target Branches</label>
                              <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                                {locations.map(loc => (
                                  <label key={loc._id} className="flex items-center gap-3 p-3 bg-(--color-surface) rounded-xl border border-(--color-border) cursor-pointer hover:border-primary/20 transition-all">
                                    <input
                                      type="checkbox"
                                      checked={selectedBranches.includes(loc._id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedBranches([...selectedBranches, loc._id]);
                                        } else {
                                          setSelectedBranches(selectedBranches.filter(id => id !== loc._id));
                                        }
                                      }}
                                      className="w-4 h-4 accent-primary rounded"
                                    />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-bold text-(--color-text-primary) truncate">{loc.name}</span>
                                      <span className={`text-[7px] font-bold uppercase tracking-tight ${loc.dietaryType === 'veg' ? 'text-success' : loc.dietaryType === 'non-veg' ? 'text-danger' : 'text-primary'}`}>
                                        {loc.dietaryType}
                                      </span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {selectedBranches.length > 0 && (
                              <div className="space-y-4 p-5 bg-(--color-bg-soft) rounded-xl border border-(--color-border)">
                                <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2">Branch Stock List</h4>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                                  {locations.filter(l => selectedBranches.includes(l._id)).map(loc => {
                                    const bStock = editingItem?.branchStocks?.find(bs => bs.branch === loc._id);
                                    return (
                                      <div key={loc._id} className="flex items-center justify-between p-3 bg-(--color-surface) rounded-xl border border-(--color-border)">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold text-(--color-text-primary)">{loc.name}</span>
                                          <span className="text-[7px] text-(--color-text-muted) uppercase tracking-normal">{loc.city}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="relative w-20">
                                            <input
                                              type="number"
                                              min="0"
                                              onKeyDown={blockNonInteger}
                                              name={`stock_${loc._id}`}
                                              defaultValue={bStock ? bStock.stock : (editingItem?.stock || 0)}
                                              className="w-full pl-3 pr-2 py-2 bg-(--color-surface-soft) border border-(--color-border) rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary text-(--color-text-primary)"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Current Stock Level</label>
                      <div className="relative">
                        <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted)" size={16} />
                        <input
                          name="stock"
                          type="number"
                          min="0"
                          onKeyDown={blockNonInteger}
                          defaultValue={editingItem?.stock || 0}
                          className="w-full pl-12 pr-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Customizations / modifiers */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Customizations (optional)</p>
                      <p className="text-[8px] text-(--color-text-muted) uppercase mt-0.5">Sizes, add-ons, sugar / spice level</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModifierGroups((p) => [...p, { name: '', selectionType: 'single', required: false, maxSelections: 0, options: [{ label: '', priceDelta: 0 }] }])}
                      className="flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-normal rounded-lg border border-primary/20 hover:bg-primary hover:text-(--color-on-primary) transition-all"
                    >
                      <Plus size={12} /> Add group
                    </button>
                  </div>

                  {modifierGroups.map((g, gi) => (
                    <div key={gi} className="p-4 rounded-xl border border-(--color-border) bg-(--color-bg-soft) space-y-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        <input
                          value={g.name}
                          onChange={(e) => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, name: e.target.value } : x)))}
                          placeholder="Group name (e.g. Size)"
                          className="flex-1 min-w-32 px-3 py-2 bg-(--color-surface-soft) rounded-lg border border-(--color-border) outline-none font-bold text-xs text-(--color-text-primary)"
                        />
                        <div className="w-32">
                          <PremiumSelect
                            value={g.selectionType}
                            onChange={(v) => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, selectionType: v } : x)))}
                            options={[{ label: 'Pick one', value: 'single' }, { label: 'Pick many', value: 'multiple' }]}
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                          <input type="checkbox" checked={g.required} onChange={(e) => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, required: e.target.checked } : x)))} /> Required
                        </label>
                        <button type="button" onClick={() => setModifierGroups((p) => p.filter((_, i) => i !== gi))} className="p-2 text-danger hover:bg-danger/10 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {g.options.map((o, oi) => (
                        <div key={oi} className="flex gap-2 items-center pl-3">
                          <input
                            value={o.label}
                            onChange={(e) => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, options: x.options.map((y, j) => (j === oi ? { ...y, label: e.target.value } : y)) } : x)))}
                            placeholder="Option (e.g. Large)"
                            className="flex-1 px-3 py-2 bg-(--color-surface-soft) rounded-lg border border-(--color-border) outline-none font-medium text-xs text-(--color-text-primary)"
                          />
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted) text-xs">₹</span>
                            <input
                              type="number"
                              onKeyDown={blockNegative}
                              value={o.priceDelta}
                              onChange={(e) => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, options: x.options.map((y, j) => (j === oi ? { ...y, priceDelta: Number(e.target.value) || 0 } : y)) } : x)))}
                              placeholder="+ price"
                              className="w-full pl-7 pr-2 py-2 bg-(--color-surface-soft) rounded-lg border border-(--color-border) outline-none font-bold text-xs text-(--color-text-primary)"
                            />
                          </div>
                          <button type="button" onClick={() => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, options: x.options.filter((_, j) => j !== oi) } : x)))} className="p-2 text-(--color-text-muted) hover:text-danger">
                            <X size={14} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setModifierGroups((p) => p.map((x, i) => (i === gi ? { ...x, options: [...x.options, { label: '', priceDelta: 0 }] } : x)))}
                        className="ml-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-normal text-primary hover:opacity-80"
                      >
                        <Plus size={11} /> Add option
                      </button>
                    </div>
                  ))}
                </section>

                {/* Recipe */}
                <div
                  onClick={() => setShowRecipeEditor(!showRecipeEditor)}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${showRecipeEditor ? 'bg-primary/10 border-primary/30' : 'bg-(--color-bg-soft) border-(--color-border) hover:border-primary/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${showRecipeEditor ? 'bg-primary text-(--color-bg-base)' : 'bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-normal ${showRecipeEditor ? 'text-primary-dark dark:text-primary' : 'text-(--color-text-muted)'}`}>Recipe</p>
                        <p className="text-[8px] text-(--color-text-muted) uppercase mt-0.5">Ingredients & Prep</p>
                      </div>
                    </div>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all ${showRecipeEditor ? 'bg-primary border-primary text-(--color-bg-base) rotate-180' : 'border-(--color-border) text-(--color-text-muted)'}`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipe Editor */}
            <AnimatePresence>
              {showRecipeEditor && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="space-y-10 pt-10 border-t border-(--color-border)"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Ingredients */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <List size={18} className="text-primary" />
                          <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Ingredients</h4>
                        </div>
                        <button
                          type="button"
                          onClick={addIngredient}
                          className="px-4 py-1.5 rounded-full bg-primary/10 text-[9px] font-bold uppercase text-primary-dark dark:text-primary hover:bg-primary hover:text-(--color-bg-base) transition-all"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-3">
                        {recipeData.ingredients.map((ing, idx) => (
                          <motion.div
                            layout
                            key={idx}
                            className="flex gap-3 items-center p-2 bg-(--color-bg-soft) rounded-xl border border-(--color-border)"
                          >
                            <div className="flex-[3]">
                              <input
                                placeholder="Name"
                                value={ing.name}
                                onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                                className="w-full px-4 py-2.5 bg-(--color-surface) rounded-xl border border-(--color-border) text-xs font-bold outline-none focus:ring-1 focus:ring-primary text-(--color-text-primary)"
                              />
                            </div>
                            <div className="flex-[1.5]">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={ing.quantity}
                                onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                                className="w-full px-4 py-2.5 bg-(--color-surface) rounded-xl border border-(--color-border) text-xs font-bold text-center outline-none text-(--color-text-primary)"
                              />
                            </div>
                            <div className="flex-2">
                              <PremiumSelect
                                value={ing.unit}
                                onChange={(val) => updateIngredient(idx, 'unit', val)}
                                options={[
                                  { label: 'Grams', value: 'grams' },
                                  { label: 'ML', value: 'ml' },
                                  { label: 'Pcs', value: 'pcs' },
                                  { label: 'TSP', value: 'tsp' }
                                ]}
                                className="!py-0"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeIngredient(idx)}
                              className="h-10 w-10 flex items-center justify-center text-danger hover:bg-danger/10 rounded-xl transition-all"
                            >
                              <Minus size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Zap size={18} className="text-primary" />
                          <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Steps</h4>
                        </div>
                        <button
                          type="button"
                          onClick={addInstruction}
                          className="px-4 py-1.5 rounded-full bg-primary/10 text-[9px] font-bold uppercase text-primary-dark dark:text-primary hover:bg-primary hover:text-(--color-bg-base) transition-all"
                        >
                          + Add
                        </button>
                      </div>
                      <div className="space-y-4">
                        {recipeData.instructions.map((ins, idx) => (
                          <motion.div layout key={idx} className="flex gap-4 group">
                            <div className="h-10 w-10 rounded-[1rem] bg-primary flex items-center justify-center text-(--color-bg-base) text-xs font-bold shrink-0 shadow-lg ">
                              {ins.step}
                            </div>
                            <textarea
                              placeholder="Describe this step..."
                              value={ins.text}
                              onChange={(e) => updateInstruction(idx, e.target.value)}
                              rows="2"
                              className="w-full px-5 py-3 bg-(--color-bg-soft) rounded-xl border border-(--color-border) text-xs font-bold resize-none outline-none focus:ring-1 focus:ring-primary transition-all text-(--color-text-primary)"
                            />
                            <button
                              type="button"
                              onClick={() => removeInstruction(idx)}
                              className="h-10 w-10 flex items-center justify-center text-danger hover:bg-danger/10 rounded-xl transition-all h-fit"
                            >
                              <Minus size={16} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Notes</label>
                    <textarea
                      value={recipeData.notes}
                      onChange={(e) => setRecipeData(prev => ({ ...prev, notes: e.target.value }))}
                      rows="2"
                      className="w-full px-6 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold resize-none text-(--color-text-primary)"
                      placeholder="Special instructions..."
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Global Actions */}
            <div className="pt-10 flex items-center justify-end gap-6 border-t border-(--color-border)">
              <button
                type="button"
                onClick={() => { setShowItemModal(false); setEditingItem(null); setImagePreview(null); }}
                className="px-8 py-4 text-xs font-bold uppercase tracking-normal text-(--color-text-muted) hover:text-danger transition-all"
              >
                Cancel
              </button>
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                className="!py-5 !px-12 !rounded-xl shadow-sm bg-primary  text-xs font-bold uppercase tracking-normal text-(--color-bg-base)"
              >
                {editingItem ? 'Save Updates' : 'Add Item'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Category Modal */}
        <Modal
          isOpen={showCategoryModal}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
          title={editingCategory ? "Update Category" : "Add New Category"}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCategorySubmit} className="p-2 space-y-10">

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Layers size={16} />
                </div>
                <h4 className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Category Details</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-6 space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mb-2.5 ml-1">Category Name</label>
                  <input
                    name="name"
                    defaultValue={editingCategory?.name}
                    required
                    className="w-full px-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                    placeholder="e.g. South Indian"
                  />
                </div>
                <div className="md:col-span-6 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Icon</label>
                  <div className="flex gap-3">
                    <div className="relative group shrink-0">
                      <input
                        name="icon"
                        value={categoryIcon}
                        onChange={(e) => setCategoryIcon(e.target.value)}
                        required
                        className="w-20 px-2 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold text-center text-2xl transition-all text-(--color-text-primary)"
                      />
                    </div>
                    <div className="flex-1 bg-(--color-bg-soft) rounded-xl border border-(--color-border) p-2 overflow-hidden">
                      <div className="flex flex-wrap gap-1.5 h-14 overflow-y-auto no-scrollbar justify-center items-center">
                        {SUGGESTED_ICONS.map(icon => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setCategoryIcon(icon)}
                            className={`h-8 w-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-all text-lg ${categoryIcon === icon ? 'bg-primary/20 scale-110' : ''}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingCategory?.description}
                  rows="3"
                  className="w-full px-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all resize-none text-(--color-text-primary)"
                  placeholder="Write a short description for this category..."
                />
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">Sort Order</label>
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={editingCategory?.sortOrder || 0}
                    required
                    className="w-full px-5 py-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) outline-none focus:ring-2 focus:ring-primary/30 font-bold transition-all text-(--color-text-primary)"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center gap-5 cursor-pointer select-none group p-4 bg-(--color-bg-soft) rounded-xl border border-(--color-border) hover:border-primary/20 transition-all">
                    <div className="relative">
                      <input type="checkbox" name="isActive" defaultChecked={editingCategory ? editingCategory.isActive : true} className="peer hidden" />
                      <div className="w-14 h-7 bg-(--color-bg-soft) rounded-full peer-checked:bg-primary transition-colors shadow-inner"></div>
                      <div className="absolute left-1 top-1 w-5 h-5 bg-(--color-bg-base) rounded-full transition-transform peer-checked:translate-x-7 shadow-sm"></div>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) group-hover:text-primary transition-colors">Active</span>
                      <span className="text-[8px] text-(--color-text-muted) uppercase tracking-tight">Show in list</span>
                    </div>
                  </label>
                </div>
              </div>
            </section>

            <div className="pt-8 flex items-center justify-end gap-6 border-t border-(--color-border)">
              <button
                type="button"
                onClick={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                className="px-8 py-4 text-xs font-bold uppercase tracking-normal text-(--color-text-muted) hover:text-danger transition-all"
              >
                Cancel
              </button>
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                className="!py-5 !px-12 !rounded-xl shadow-sm  text-xs font-bold uppercase tracking-normal bg-primary text-(--color-bg-base)"
              >
                {editingCategory ? 'Save Category' : 'Add Category'}
              </Button>
            </div>
          </form>
        </Modal>

        {(filteredItems.length === 0 && activeTab === 'items' && !loading) || (filteredCategories.length === 0 && activeTab === 'categories' && !loading) ? (
          <div className="text-center py-32 bg-primary/[0.02] rounded-[4rem] border border-dashed border-primary/20 col-span-full w-full">
            <UtensilsCrossed size={64} className="mx-auto text-primary/10 mb-6" strokeWidth={1} />
            <h3 className="text-2xl font-bold text-(--color-text-primary) tracking-tight">No {activeTab === 'items' ? 'Items' : 'Categories'} Found</h3>
            <p className="text-(--color-text-muted) font-medium mt-2 max-w-sm mx-auto">The {activeTab === 'items' ? 'menu' : 'category'} list is currently empty for the selected filters. Add a new {activeTab === 'items' ? 'item' : 'category'} to begin.</p>
            <Button variant="outline" className="mt-8 px-10 rounded-xl" icon={Plus} onClick={() => { if (activeTab === 'items') { setEditingItem(null); setImagePreview(null); setShowItemModal(true); } else setShowCategoryModal(true); }}>Add {activeTab === 'items' ? 'Item' : 'Category'}</Button>
          </div>
        ) : null}
        {activeTab === 'items' && totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-6 bg-(--color-surface) border border-(--color-border) rounded-xl mt-10 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:opacity-80 text-(--color-text-primary)"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 rounded-xl bg-(--color-surface-soft) border border-(--color-border) text-[10px] font-bold uppercase tracking-normal disabled:opacity-30 transition-all hover:opacity-80 text-(--color-text-primary)"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </PageTransition>
  );
}
