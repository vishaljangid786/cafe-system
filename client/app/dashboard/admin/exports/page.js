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
import useBranchScope from '@/app/hooks/useBranchScope';
import { useAuth } from '@/app/context/AuthContext';
import { progress } from '@/app/components/ui/TopProgressBar';

export default function ExportCenter() {
  const { user } = useAuth();
  const { branchIds, singleBranchId } = useBranchScope();
  const hasAccess = user?.role === 'super_admin' || user?.permissions?.exportReports === true;

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);

  const [filters, setFilters] = useState({
    type: 'orders',
    format: 'pdf',
    startDate: '',
    endDate: ''
  });

  const categories = [
    { id: 'orders', name: 'Order History', icon: <FileText size={18} /> },
    { id: 'revenue', name: 'Revenue & Payments', icon: <FileText size={18} /> },
    { id: 'staff', name: 'Staff List', icon: <FileText size={18} /> },
    { id: 'payroll', name: 'Salary Records', icon: <FileText size={18} /> },
    { id: 'attendance', name: 'Attendance Records', icon: <FileText size={18} /> },
    { id: 'coupons', name: 'Coupon Reports', icon: <FileText size={18} /> },
    { id: 'inventory', name: 'Inventory Status', icon: <FileText size={18} /> },
    { id: 'gst', name: 'GST Filing Report', icon: <FileText size={18} /> }
  ];

  const formats = [
    { id: 'pdf', name: 'PDF', icon: <FileText className="text-danger" /> },
    { id: 'excel', name: 'Excel', icon: <FileSpreadsheet className="text-success" /> },
    { id: 'csv', name: 'CSV', icon: <TableIcon className="text-primary" /> }
  ];

  const fetchLocations = async () => {
    progress.start();
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error(err);
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

  const handleExport = async () => {
    try {
      setLoading(true);
      progress.start();
      const exportFilters = { ...filters };
      // Branch scope comes from the global Navbar filter (single, all, or subset).
      if (branchIds.length > 1) {
        exportFilters.locationIds = branchIds.join(',');
      } else if (singleBranchId !== 'all') {
        exportFilters.branchId = singleBranchId;
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
      toast.error('Could not export. Please check your filters and try again.');
      console.error(err);
    } finally {
      setLoading(false);
      progress.done();
    }
  };

  if (!hasAccess && user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Download size={60} className="text-danger opacity-20" />
        <h2 className="text-2xl font-bold text-(--color-text-primary) italic uppercase">Access Restricted</h2>
        <p className="text-(--color-text-muted) font-bold text-sm tracking-normal uppercase">You do not have permission to export reports.</p>
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
              <h1 className="text-4xl font-bold text-(--color-text-primary) flex items-center gap-3">
                <Download className="text-primary h-10 w-10" />
                Export <span className="text-primary">Reports</span>
              </h1>
              <p className="text-sm font-medium text-(--color-text-secondary) mt-2">Download your business reports in different formats.</p>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Category Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-(--color-surface) rounded-xl border border-(--color-border) p-8 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-2">
                <Filter size={14} /> 1. Choose What to Export
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilters({ ...filters, type: cat.id })}
                    className={`flex items-center justify-between p-5 rounded-xl border transition-all ${
                      filters.type === cat.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-(--color-border) hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${filters.type === cat.id ? 'bg-primary text-white' : 'bg-(--color-surface-soft) text-(--color-text-muted)'}`}>
                        {cat.icon}
                      </div>
                      <span className={`font-bold ${filters.type === cat.id ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)'}`}>{cat.name}</span>
                    </div>
                    {filters.type === cat.id && <CheckCircle2 className="text-primary" size={18} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Date and Branch Filters */}
            <div className="bg-(--color-surface) rounded-xl border border-(--color-border) p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                  <Calendar size={12} /> Start Date
                </label>
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full p-3 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 text-(--color-text-primary)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                  <Calendar size={12} /> End Date
                </label>
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full p-3 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 text-(--color-text-primary)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) flex items-center gap-2">
                  <MapPin size={12} /> Branch <span className="text-(--color-text-muted)/60 normal-case font-medium">(from navbar)</span>
                </label>
                <div className="w-full p-3 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-xs font-bold text-(--color-text-primary) uppercase tracking-normal truncate">
                  {branchIds.length > 1
                    ? `${branchIds.length} branches selected`
                    : singleBranchId !== 'all'
                      ? (locations.find((loc) => loc._id === singleBranchId)?.name || 'Selected branch')
                      : 'All branches'}
                </div>
              </div>
            </div>
          </div>

          {/* Format and Action */}
          <div className="space-y-6">
            <div className="bg-(--color-surface) text-(--color-text-primary) rounded-xl p-8 shadow-sm relative overflow-hidden h-full flex flex-col justify-between border border-(--color-border)">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 hidden -mr-16 -mt-16 rounded-full" />
              
              <div className="space-y-8 relative z-10">
                <h2 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">2. Choose Format</h2>
                <div className="space-y-3">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilters({ ...filters, format: f.id })}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        filters.format === f.id 
                          ? 'border-primary bg-primary/10'
                          : 'border-(--color-border) bg-(--color-surface-soft) hover:border-primary/30'
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
                  className="w-full py-5 bg-primary hover:bg-secondary disabled:bg-(--color-surface-soft) disabled:text-(--color-text-muted) text-white font-bold uppercase tracking-normal rounded-xl transition-all shadow-sm  flex items-center justify-center gap-3 active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Preparing...
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
