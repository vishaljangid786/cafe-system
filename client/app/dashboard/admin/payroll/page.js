'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { Wallet, Filter, MapPin, ChevronRight, Download, Receipt } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion } from 'framer-motion';

export default function GlobalPayrollPage() {
  const monthInputRef = useRef(null);
  const [salaries, setSalaries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedLocation, setSelectedLocation] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [salRes, locRes] = await Promise.all([
          api.get(`/salary/all?month=${month}`),
          api.get('/locations')
        ]);
        setSalaries(salRes.data.data);
        setStats({
          totalPayroll: salRes.data.totalPayrollCost,
          locationTotals: salRes.data.locationTotals
        });
        setLocations(locRes.data.data);
      } catch (err) {
        console.error('Failed to fetch salary matrix');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [month]);

  const filteredSalaries = salaries.filter(s => 
    selectedLocation === 'All' || s.locationName === selectedLocation
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <SlideIn direction="down">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight">
                <Wallet className="mr-3 text-amber-600" size={28} /> Global Payroll Matrix
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-1">Manage salary payouts and costs across all locations.</p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div 
                onClick={() => monthInputRef.current?.showPicker()}
                className="flex items-center px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 focus-within:ring-2 focus-within:ring-amber-500 cursor-pointer hover:border-amber-500/50 transition-colors"
              >
                <input 
                  ref={monthInputRef}
                  type="month" 
                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 cursor-pointer"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <select 
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 focus:ring-2 focus:ring-amber-500 outline-none text-sm font-bold text-gray-700 dark:text-zinc-200 appearance-none pr-10 relative font-bold"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="All">All Locations</option>
                {locations.map(l => <option key={l._id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </SlideIn>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideIn delay={0.1}>
            <div className="bg-amber-600 p-6 rounded-2xl shadow-lg shadow-amber-600/20 text-white h-full">
              <p className="text-xs font-black uppercase tracking-widest opacity-80">Total Monthly Payout</p>
              <p className="text-3xl font-black mt-1">₹{stats?.totalPayroll?.toLocaleString() || 0}</p>
              <div className="mt-4 flex items-center text-xs font-medium opacity-90">
                <Receipt size={14} className="mr-1" /> Includes all verified attendance
              </div>
            </div>
          </SlideIn>
          
          <SlideIn delay={0.2}>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 h-full">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">Avg Salary / Personnel</p>
              <p className="text-3xl font-black text-gray-900 dark:text-zinc-100 mt-1">
                ₹{salaries.length > 0 ? (stats?.totalPayroll / salaries.length).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}
              </p>
            </div>
          </SlideIn>

          <SlideIn delay={0.3}>
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 h-full">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">Personnel Count</p>
              <p className="text-3xl font-black text-gray-900 dark:text-zinc-100 mt-1">{salaries.length}</p>
            </div>
          </SlideIn>
        </div>

        {/* Salary Table */}
        <SlideIn direction="up" delay={0.4}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4 text-center">Present Days</th>
                    <th className="px-6 py-4 text-right">Base Salary</th>
                    <th className="px-6 py-4 text-right">Calculated Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {loading ? (
                    [1,2,3,4].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="5" className="px-6 py-6"><div className="h-4 bg-gray-100 dark:bg-zinc-800 rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-zinc-500">No payroll records found for this period.</td>
                    </tr>
                  ) : (
                    filteredSalaries.map((s, idx) => (
                      <motion.tr 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + idx * 0.03 }}
                        key={s._id} 
                        className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{s.name}</p>
                            <p className="text-[10px] font-medium text-gray-500">{s.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded-md">
                            {s.locationName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-black text-amber-600">{s.payableDays}</span>
                          <span className="text-[10px] text-gray-400 ml-1">/ {s.daysInMonth || 30}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500 dark:text-zinc-500 font-medium">
                          ₹{s.monthlySalary?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-black text-gray-900 dark:text-zinc-100 group-hover:text-amber-600 transition-colors">
                            ₹{s.calculatedSalary?.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </span>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SlideIn>
      </div>
    </PageTransition>
  );
}
