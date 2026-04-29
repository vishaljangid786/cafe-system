'use client';
import { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { 
  Download, FileText, Table as TableIcon, 
  FileSpreadsheet, Calendar, MapPin, 
  Filter, CheckCircle2, Loader2, ChevronRight
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function ExportCenter() {
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
    { id: 'revenue', name: 'Revenue & TXs', icon: <TrendingUpIcon size={18} /> },
    { id: 'staff', name: 'Staff Directory', icon: <UsersIcon size={18} /> },
    { id: 'payroll', name: 'Payroll Records', icon: <WalletIcon size={18} /> },
    { id: 'attendance', name: 'Attendance Logs', icon: <CalendarIcon size={18} /> },
    { id: 'coupons', name: 'Coupon Analytics', icon: <TicketIcon size={18} /> }
  ];

  const formats = [
    { id: 'pdf', name: 'Professional PDF', icon: <FileText className="text-rose-500" /> },
    { id: 'excel', name: 'Microsoft Excel', icon: <FileSpreadsheet className="text-emerald-600" /> },
    { id: 'csv', name: 'Standard CSV', icon: <TableIcon className="text-blue-500" /> }
  ];

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams(filters).toString();
      const response = await api.get(`/export?${query}`, {
        responseType: 'blob'
      });

      // Create download link
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

  return (
    <PageTransition>
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <SlideIn>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                <Download className="text-amber-600 h-10 w-10" />
                Intelligence <span className="text-amber-600">Export</span>
              </h1>
              <p className="text-sm font-medium text-zinc-500 mt-2">Generate branded business reports in multiple formats.</p>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Category Selection */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                <Filter size={14} /> 1. Select Data Category
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilters({ ...filters, type: cat.id })}
                    className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                      filters.type === cat.id 
                        ? 'border-amber-600 bg-amber-600/5 ring-1 ring-amber-600' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${filters.type === cat.id ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {cat.id === 'orders' && <FileText size={18} />}
                        {cat.id === 'revenue' && <TrendingUpIcon size={18} />}
                        {cat.id === 'staff' && <UsersIcon size={18} />}
                        {cat.id === 'payroll' && <WalletIcon size={18} />}
                        {cat.id === 'attendance' && <CalendarIcon size={18} />}
                        {cat.id === 'coupons' && <TicketIcon size={18} />}
                      </div>
                      <span className={`font-bold ${filters.type === cat.id ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>{cat.name}</span>
                    </div>
                    {filters.type === cat.id && <CheckCircle2 className="text-amber-600" size={18} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Date and Branch Filters */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <Calendar size={12} /> Start Date
                </label>
                <input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <Calendar size={12} /> End Date
                </label>
                <input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <MapPin size={12} /> Target Node
                </label>
                <select 
                  value={filters.branchId}
                  onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 font-bold"
                >
                  <option value="all">Global Network</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Format and Action */}
          <div className="space-y-6">
            <div className="bg-zinc-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/20 blur-3xl -mr-16 -mt-16 rounded-full" />
              
              <div className="space-y-8 relative z-10">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">2. Delivery Format</h2>
                <div className="space-y-3">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilters({ ...filters, format: f.id })}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                        filters.format === f.id 
                          ? 'border-amber-600 bg-amber-600/10' 
                          : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
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
                  className="w-full py-5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-black font-black uppercase tracking-widest rounded-3xl transition-all shadow-xl shadow-amber-600/20 flex items-center justify-center gap-3 active:scale-95"
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

// Minimal Icons for Categories
function TrendingUpIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>;
}
function UsersIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M23 7a4 4 0 0 0-4-4"></path></svg>;
}
function WalletIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>;
}
function CalendarIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
}
function TicketIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path></svg>;
}
