'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, Users, Calendar, Wallet, Loader2, ArrowLeft } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Link from 'next/link';
import { motion } from 'framer-motion'

export default function MonthlySummaryPage() {
  const monthInputRef = useRef(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/monthly-summary?month=${month}`);
      setSummary(res.data.data);
    } catch (error) {
      console.error('Failed to fetch monthly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [month]);

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800 gap-6">
            <div>
              <Link href="/dashboard/admin" className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center mb-4 hover:translate-x-[-4px] transition-transform w-fit">
                <ArrowLeft size={14} className="mr-2" /> Back to Dashboard
              </Link>
              <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 flex items-center tracking-tight leading-none">
                <LayoutDashboard className="mr-3 text-amber-600" size={32} /> Monthly <span className="ml-2 text-amber-600">Summary</span>
              </h1>
              <p className="text-gray-500 dark:text-zinc-500 text-sm mt-3 font-medium uppercase tracking-widest text-[10px]">Staff Performance & Attendance Overview</p>
            </div>
            <div
              onClick={() => monthInputRef.current?.showPicker()}
              className="bg-gray-50 dark:bg-zinc-800 p-2 rounded-2xl border border-gray-200 dark:border-zinc-700 cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <input
                ref={monthInputRef}
                type="month"
                className="bg-transparent border-none outline-none p-2 text-sm font-black text-gray-900 dark:text-zinc-100 uppercase tracking-widest cursor-pointer"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </SlideIn>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 h-96 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-[2.5rem]"></div>
            <div className="h-96 bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-[2.5rem]"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <SlideIn className="lg:col-span-2" delay={0.1}>
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800">
                  <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 tracking-tight mb-8">Branch Attendance</h2>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="locationName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
                        <Bar dataKey="totalPresentDays" fill="#10B981" name="Present" radius={[6, 6, 0, 0]} barSize={32} />
                        <Bar dataKey="totalAbsentDays" fill="#EF4444" name="Absent" radius={[6, 6, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </SlideIn>

              <SlideIn delay={0.2}>
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 h-full">
                  <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100 tracking-tight mb-8">Staff Count</h2>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={summary}
                          dataKey="totalStaff"
                          nameKey="locationName"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={8}
                          stroke="none"
                        >
                          {summary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-8 space-y-3">
                    {summary.map((loc, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span className="flex items-center"><div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div> {loc.locationName}</span>
                        <span className="text-gray-900 dark:text-zinc-100">{loc.totalStaff} Staff</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SlideIn>
            </div>

            <SlideIn direction="up" delay={0.3}>
              <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Branch Name</th>
                        <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Total Staff</th>
                        <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Presents</th>
                        <th className="px-8 py-6 text-center text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Absents</th>
                        <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                      {summary.map((loc, idx) => {
                        const totalDays = loc.totalPresentDays + loc.totalAbsentDays;
                        const percentage = totalDays > 0 ? (loc.totalPresentDays / totalDays) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-8 py-6 whitespace-nowrap text-sm font-black text-gray-900 dark:text-zinc-100 tracking-tight group-hover:text-amber-600 transition-colors">{loc.locationName}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-center text-sm font-bold text-gray-600 dark:text-zinc-400">{loc.totalStaff}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-center text-sm font-black text-green-600">{loc.totalPresentDays}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-center text-sm font-black text-red-600">{loc.totalAbsentDays}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end">
                                <span className={`text-xs font-black mr-3 tracking-tighter ${percentage > 90 ? 'text-green-600' : percentage > 75 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {percentage.toFixed(1)}%
                                </span>
                                <div className="w-20 bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    className={`h-full rounded-full ${percentage > 90 ? 'bg-green-500' : percentage > 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </SlideIn>
          </>
        )}
      </div>
    </PageTransition>
  );
}
