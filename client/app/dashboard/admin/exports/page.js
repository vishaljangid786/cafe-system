'use client';
import { useState, useEffect } from 'react';
import api from '@/app/services/api';
import { 
  Download, FileText, Table as TableIcon, 
  FileSpreadsheet, Calendar, MapPin, 
  Filter, CheckCircle2, Loader2, ChevronRight
} from 'lucide-react';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import { useAuth } from '@/app/context/AuthContext';

export default function ExportCenter() {
  const { user, selectedLocationIds } = useAuth();
  const hasAccess = user?.role === 'super_admin' || user?.permissions?.exportReports === true;

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);

  const [filters, setFilters] = useState({
    type: 'orders',
    format: 'pdf',
    startDate: '',
    endDate: '',
    branchId: 'all'
  });

  const categories = [
    { id: 'orders', name: 'Order History', icon: <FileText size={18} /> },
    { id: 'revenue', name: 'Revenue & TXs', icon: <FileText size={18} /> },
    { id: 'staff', name: 'Staff Directory', icon: <FileText size={18} /> },
    { id: 'payroll', name: 'Payroll Records', icon: <FileText size={18} /> },
    { id: 'attendance', name: 'Attendance Logs', icon: <FileText size={18} /> },
    { id: 'coupons', name: 'Coupon Analytics', icon: <FileText size={18} /> },
    { id: 'inventory', name: 'Inventory Status', icon: <FileText size={18} /> }
  ];

  const formats = [
    { id: 'pdf', name: 'Professional PDF', icon: <FileText className="text-[var(--color-danger)]" /> },
    { id: 'excel', name: 'Microsoft Excel', icon: <FileSpreadsheet className="text-[var(--color-success)]" /> },
    { id: 'csv', name: 'Standard CSV', icon: <TableIcon className="text-[var(--color-primary)]" /> }
  ];

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleExport = async () => {
    try {
      setLoading(true);
      const exportFilters = { ...filters };
      // Multi-branch subset from Navbar overrides single branchId
      if (selectedLocationIds.length > 1) {
        delete exportFilters.branchId;
        exportFilters.locationIds = selectedLocationIds.join(',');
      }
      const query = new URLSearchParams(exportFilters).toString();
      const response = await api.get(`/export?${query}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = filters.format === 'excel' ? 'xlsx' : filters.format;
      link.setAttribute('download', `CafeOS_${filters.type}_${new Date().toISOString().split('T')[0]}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`${filters.type.toUpperCase()} exported successfully!`);
    } catch (err) {
      toast.error('Export failed. Please check your filters.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess && user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Download size={60} className="text-[var(--color-danger)] opacity-20" />
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] italic uppercase">Entry Restricted</h2>
        <p className="text-[var(--color-text-muted)] font-bold text-sm tracking-normal uppercase">Permission Denied: EXPORT_GEN_RESTRICTED</p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <SlideIn>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
                <Download className="text-[var(--color-primary)] h-10 w-10" />
                Information <span className="text-[var(--color-primary)]">Export</span>
              </h1>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-2">Generate branded business reports in multiple formats.</p>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Category Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-6 flex items-center gap-2">
                <Filter size={14} /> 1. Select Data Category
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilters({ ...filters, type: cat.id })}
                    className={`flex items-center justify-between p-5 rounded-xl border transition-all ${
                      filters.type === cat.id 
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${filters.type === cat.id ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}>
                        {cat.icon}
                      </div>
                      <span className={`font-bold ${filters.type === cat.id ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{cat.name}</span>
                    </div>
                    {filters.type === cat.id && <CheckCircle2 className="text-[var(--color-primary)]" size={18} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Date and Branch Filters */}
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-2">
                  <Calendar size={12} /> Start Date
                </label>
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full p-3 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-[var(--color-text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-2">
                  <Calendar size={12} /> End Date
                </label>
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full p-3 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-[var(--color-text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] flex items-center gap-2">
                  <MapPin size={12} /> Target Branch
                </label>
                {selectedLocationIds.length > 1 ? (
                  <div className="w-full p-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-xl text-xs font-bold text-[var(--color-primary)] uppercase tracking-normal">
                    {selectedLocationIds.length} branches selected via Navbar
                  </div>
                ) : (
                  <PremiumSelect
                    value={filters.branchId}
                    onChange={(val) => setFilters({ ...filters, branchId: val })}
                    options={[
                      { label: 'Global Network', value: 'all' },
                      ...locations.map(loc => ({ label: loc.name, value: loc._id }))
                    ]}
                    className="w-full"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Format and Action */}
          <div className="space-y-6">
            <div className="bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-xl p-8 shadow-sm relative overflow-hidden h-full flex flex-col justify-between border border-[var(--color-border)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/20 hidden -mr-16 -mt-16 rounded-full" />
              
              <div className="space-y-8 relative z-10">
                <h2 className="text-xs font-bold uppercase tracking-normal text-[var(--color-text-muted)]">2. Delivery Format</h2>
                <div className="space-y-3">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilters({ ...filters, format: f.id })}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        filters.format === f.id 
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-soft)] hover:border-[var(--color-primary)]/30'
                      }`}
                    >
                      {f.icon}
                      <span className="font-bold text-sm">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-8 relative z-10">
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="w-full py-5 bg-[var(--color-primary)] hover:bg-[var(--color-secondary)] disabled:bg-[var(--color-surface-soft)] disabled:text-[var(--color-text-muted)] text-white font-bold uppercase tracking-normal rounded-xl transition-all shadow-sm  flex items-center justify-center gap-3 active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      Generate Export
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
