'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton, ChartSkeleton } from '@/app/components/ui/Skeleton';
import {
  TrendingUp, ShoppingBag, Award, XCircle, CheckCircle2, Zap,
  Filter, Calendar, Bookmark, Building, Download, Printer, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PremiumSelect from './ui/PremiumSelect';

const COLORS = ['#f59e0b', '#ea580c', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StaffReportsAnalytics({ user }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    staffName: '',
    branch: '',
    date: '',
    month: '',
    financialYear: ''
  });

  const fetchBranches = async () => {
    try {
      const res = await api.get('/locations');
      setBranches(res.data.data || []);
    } catch (error) {
      console.error('Failed to load branches');
    }
  };

  const fetchReports = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = {};
      if (filters.staffName) params.staffName = filters.staffName;
      if (filters.branch) params.branch = filters.branch;
      if (filters.date) params.date = filters.date;
      if (filters.month) params.month = filters.month;
      if (filters.financialYear) params.financialYear = filters.financialYear;

      const res = await api.get('/analytics/staff-reports', { params });
      setData(res.data.data || []);
    } catch (error) {
      toast.error('Failed to load staff reports');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBranches();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports();
    }, 0);

    return () => clearTimeout(timer);
  }, [filters]);

  const handleFilterChange = (key, value) => {
    // If setting one time filter, clear the others
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'date') { updated.month = ''; updated.financialYear = ''; }
      if (key === 'month') { updated.date = ''; updated.financialYear = ''; }
      if (key === 'financialYear') { updated.date = ''; updated.month = ''; }
      return updated;
    });
  };

  const resetFilters = () => {
    setFilters({
      staffName: '',
      branch: '',
      date: '',
      month: '',
      financialYear: ''
    });
    toast.success('Filters reset to default');
  };

  const exportCSV = () => {
    const headers = ['Ranking', 'Name', 'Role', 'Branch', 'Total Sales (₹)', 'Orders Handled', 'Coupon Usage', 'Profit Contribution (₹)', 'Cancelled Ratio', 'Avg Order Value (₹)'];
    const rows = data.map(s => [
      s.ranking,
      s.name,
      s.role.toUpperCase(),
      s.branchName,
      s.totalSales,
      s.ordersHandled,
      s.couponUsageCount,
      s.estimatedProfitContribution,
      s.cancelledRatio,
      s.avgOrderValue
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Staff_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    window.print();
  };

  // Total Category Sales over ALL staff for the Pie Chart
  const getTotaldCategorySales = () => {
    const catTotals = {};
    data.forEach(staff => {
      Object.entries(staff.foodCategorySales || {}).forEach(([cat, val]) => {
        catTotals[cat] = (catTotals[cat] || 0) + val;
      });
    });
    return Object.entries(catTotals).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  };

  const catSalesData = getTotaldCategorySales();

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <div className="max-w-[1600px] mx-auto pb-20 space-y-10 print:p-0 print:bg-(--color-surface) print:text-(--color-on-primary)">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-(--color-text-primary) tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg ">
              <TrendingUp size={24} className="text-(--color-on-primary)" />
            </div>
            Staff Reports & Analytics
          </h1>
          <p className="text-xs text-(--color-text-secondary) mt-1 font-medium ml-13">See how your team is doing on sales and service.</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={exportCSV}
            className="px-5 py-3 bg-(--color-surface-soft) hover:bg-(--color-surface) text-(--color-text-secondary) rounded-xl text-xs font-bold uppercase tracking-normal transition-all flex items-center gap-2 shadow-sm border border-(--color-border)"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="px-5 py-3 bg-primary text-(--color-on-primary) rounded-xl text-xs font-bold uppercase tracking-normal transition-all flex items-center gap-2 shadow-lg"
          >
            <Printer size={16} /> Print/PDF
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block text-center pb-8 border-b border-(--color-border) mb-8">
        <h1 className="text-2xl font-bold">Staff Performance Report</h1>
        <p className="text-sm text-(--color-text-secondary) mt-2">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* Filters */}
      <div className="bg-(--color-surface)/80  p-8 rounded-xl border border-(--color-border) shadow-sm space-y-6 print:hidden">
        <div className="flex items-center justify-between pb-4 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Filter Reports</span>
          </div>
          <button 
            onClick={resetFilters}
            className="px-4 py-2 bg-(--color-surface-soft) hover:bg-(--color-surface) text-(--color-text-muted) hover:text-danger rounded-xl text-[9px] font-bold uppercase tracking-normal transition-all border border-(--color-border) active:scale-95 flex items-center gap-2 group"
          >
            <CheckCircle2 size={12} className="group-hover:rotate-12 transition-transform" /> Reset Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
          {/* Staff Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <User size={12} /> Staff Name
            </label>
            <input
              type="text"
              placeholder="Search staff..."
              value={filters.staffName}
              onChange={(e) => handleFilterChange('staffName', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) text-xs font-bold focus:border-primary focus:outline-none transition-all text-(--color-text-primary)"
            />
          </div>

          {/* Branch (Hidden for Branch Admin) */}
          {user?.role !== 'branch_admin' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
                <Building size={12} /> Branch
              </label>
              <PremiumSelect
                value={filters.branch}
                onChange={(val) => handleFilterChange('branch', val)}
                options={[
                  { label: 'All Branches', value: '' },
                  ...branches.map(loc => ({ label: loc.name, value: loc._id }))
                ]}
                className="w-full"
              />
            </div>
          )}

          {/* Exact Date */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Specific Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) text-xs font-bold focus:border-primary focus:outline-none transition-all text-(--color-text-primary)"
            />
          </div>

          {/* Month */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Month
            </label>
            <input
              type="month"
              value={filters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) text-xs font-bold focus:border-primary focus:outline-none transition-all text-(--color-text-primary)"
            />
          </div>

          {/* Financial Year */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal flex items-center gap-1.5 ml-2">
              <Bookmark size={12} /> Financial Year
            </label>
            <PremiumSelect
              value={filters.financialYear}
              onChange={(val) => handleFilterChange('financialYear', val)}
              options={[
                { label: 'Select Year', value: '' },
                { label: 'FY 2024-25', value: '2024' },
                { label: 'FY 2025-26', value: '2025' },
                { label: 'FY 2026-27', value: '2026' }
              ]}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {refetching ? (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 print:hidden">
            <div className="lg:col-span-7"><ChartSkeleton /></div>
            <div className="lg:col-span-5"><ChartSkeleton /></div>
          </div>
          <TableSkeleton rows={6} cols={11} />
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 print:hidden">
            {/* Sales leaderboard */}
            <div className="lg:col-span-7 bg-(--color-surface)/80  rounded-xl border border-(--color-border) p-8">
              <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-primary" /> Sales Leaderboard (₹)
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.slice(0, 10)} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="totalSales" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Sales Share */}
            <div className="lg:col-span-5 bg-(--color-surface)/80  rounded-xl border border-(--color-border) p-8 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3">
                <Bookmark size={16} className="text-primary" /> Category Distribution
              </h3>
              <div className="flex-1 min-h-[250px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={catSalesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {catSalesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {catSalesData.slice(0, 6).map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-(--color-text-secondary) dark:text-(--color-text-muted) truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Performance Table */}
          <div className="bg-(--color-surface)/80  rounded-xl border border-(--color-border) p-8 print:p-0 print:border-0 print:shadow-none">
            <h3 className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) mb-6 flex items-center gap-3 print:hidden">
              <Award size={16} className="text-primary" /> Staff Performance List
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-(--color-border)">
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Rank</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Name</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Role</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Branch</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Total Sales</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Orders</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Coupons Used</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Coupon Disc.</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Est. Profit</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Cancelled %</th>
                    <th className="py-4 text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Avg Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((staff) => (
                    <tr key={staff._id} className="border-b border-(--color-border)/50 hover:bg-(--color-surface-soft)/30 transition-all group">
                      <td className="py-4 text-xs font-bold text-primary">#{staff.ranking}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-primary) dark:text-(--color-text-primary)">{staff.name}</td>
                      <td className="py-4 text-[10px] font-bold text-(--color-text-muted) uppercase tracking-wider">{staff.role}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-muted)">{staff.branchName}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-primary) dark:text-white">₹{staff.totalSales}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-secondary) dark:text-(--color-text-muted)">{staff.ordersHandled}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-secondary) dark:text-(--color-text-muted)">{staff.couponUsageCount}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-muted)">₹{staff.couponDiscountAmount}</td>
                      <td className="py-4 text-xs font-bold text-success">₹{staff.estimatedProfitContribution}</td>
                      <td className="py-4 text-xs font-bold text-danger">{staff.cancelledRatio}</td>
                      <td className="py-4 text-xs font-bold text-(--color-text-primary) dark:text-white">₹{staff.avgOrderValue}</td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan="11" className="py-10 text-center italic text-xs font-bold text-(--color-text-muted) opacity-40">No staff records found for the selected filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
