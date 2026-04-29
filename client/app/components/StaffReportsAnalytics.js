'use client';
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  TrendingUp, ShoppingBag, Award, XCircle, CheckCircle2, Zap,
  Filter, Calendar, Bookmark, Building, Download, Printer, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StaffReportsAnalytics({ user }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchReports();
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

  // Aggregate Category Sales over ALL staff for the Pie Chart
  const getAggregatedCategorySales = () => {
    const catTotals = {};
    data.forEach(staff => {
      Object.entries(staff.foodCategorySales || {}).forEach(([cat, val]) => {
        catTotals[cat] = (catTotals[cat] || 0) + val;
      });
    });
    return Object.entries(catTotals).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  };

  const catSalesData = getAggregatedCategorySales();

  return (
    <div className="max-w-[1600px] mx-auto pb-20 space-y-10 print:p-0 print:bg-white print:text-black">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <TrendingUp size={24} className="text-white" />
            </div>
            Staff Reports & Analytics
          </h1>
          <p className="text-xs text-zinc-500 mt-1 font-medium ml-13">Evaluate team efficiency, sales contributions, and service delivery.</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={exportCSV}
            className="px-5 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="px-5 py-3 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg"
          >
            <Printer size={16} /> Print/PDF
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block text-center pb-8 border-b border-zinc-200 mb-8">
        <h1 className="text-2xl font-bold">Staff Performance Report</h1>
        <p className="text-sm text-zinc-600 mt-2">Generated on {new Date().toLocaleString()}</p>
      </div>

      {/* Filters */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm space-y-6 print:hidden">
        <div className="flex items-center gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <Filter size={16} className="text-amber-500" />
          <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Filter Reports</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
          {/* Staff Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <User size={12} /> Staff Name
            </label>
            <input
              type="text"
              placeholder="Search staff..."
              value={filters.staffName}
              onChange={(e) => handleFilterChange('staffName', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          {/* Branch (Hidden for Branch Admin) */}
          {user?.role !== 'branch_admin' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
                <Building size={12} /> Branch
              </label>
              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange('branch', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
              >
                <option value="">All Branches</option>
                {branches.map(loc => <option key={loc._id} value={loc._id}>{loc.name}</option>)}
              </select>
            </div>
          )}

          {/* Exact Date */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Specific Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          {/* Month */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Calendar size={12} /> Month
            </label>
            <input
              type="month"
              value={filters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            />
          </div>

          {/* Financial Year */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 ml-2">
              <Bookmark size={12} /> Financial Year
            </label>
            <select
              value={filters.financialYear}
              onChange={(e) => handleFilterChange('financialYear', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 text-xs font-bold focus:border-amber-500 focus:outline-none transition-all"
            >
              <option value="">Select Year</option>
              <option value="2024">FY 2024-25</option>
              <option value="2025">FY 2025-26</option>
              <option value="2026">FY 2026-27</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl animate-pulse flex items-center justify-center font-bold text-zinc-400">
          Compiling aggregate reporting metrics...
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 print:hidden">
            {/* Sales leaderboard */}
            <div className="lg:col-span-7 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
                <TrendingUp size={16} className="text-amber-500" /> Sales Leaderboard (₹)
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
            <div className="lg:col-span-5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8 flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3">
                <Bookmark size={16} className="text-blue-500" /> Category Distribution
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
                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Performance Table */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800/50 p-8 print:p-0 print:border-0 print:shadow-none">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-3 print:hidden">
              <Award size={16} className="text-amber-500" /> Performance Analysis Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Rank</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Name</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Role</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Branch</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Sales</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Orders</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Coupons Used</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Coupon Disc.</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Est. Profit</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Cancelled %</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Avg Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((staff) => (
                    <tr key={staff._id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-all group">
                      <td className="py-4 text-xs font-black text-amber-500">#{staff.ranking}</td>
                      <td className="py-4 text-xs font-black text-zinc-800 dark:text-zinc-100">{staff.name}</td>
                      <td className="py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{staff.role}</td>
                      <td className="py-4 text-xs font-bold text-zinc-500">{staff.branchName}</td>
                      <td className="py-4 text-xs font-black text-zinc-900 dark:text-white">₹{staff.totalSales}</td>
                      <td className="py-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">{staff.ordersHandled}</td>
                      <td className="py-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">{staff.couponUsageCount}</td>
                      <td className="py-4 text-xs font-bold text-zinc-500">₹{staff.couponDiscountAmount}</td>
                      <td className="py-4 text-xs font-black text-emerald-500">₹{staff.estimatedProfitContribution}</td>
                      <td className="py-4 text-xs font-bold text-rose-500">{staff.cancelledRatio}</td>
                      <td className="py-4 text-xs font-bold text-zinc-900 dark:text-white">₹{staff.avgOrderValue}</td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan="11" className="py-10 text-center italic text-xs font-bold text-zinc-400 opacity-40">No personnel interactions tracked for this sector.</td>
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
