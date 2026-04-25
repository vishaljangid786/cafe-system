'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, Users, Calendar, Wallet, Loader2, ArrowLeft } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Link from 'next/link';
import { motion } from 'framer-motion'
import { useTheme } from '../../../context/ThemeContext';

export default function MonthlySummaryPage() {
  const { theme } = useTheme();
  const monthInputRef = useRef(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const isDark = theme === 'dark';

  const COLORS = isDark 
    ? ['#fbbf24', '#34d399', '#60a5fa', '#f87171', '#a78bfa'] // Amber 400, Emerald 400, Blue 400, Red 400, Violet 400
    : ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6']; // Amber 500, Emerald 500, Blue 500, Red 500, Violet 500

  const chartColors = {
    grid: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    text: isDark ? '#71717a' : '#71717a', // zinc-500
    tooltipBg: isDark ? '#18181b' : '#ffffff', // zinc-900 or white
    tooltipBorder: isDark ? '#27272a' : '#e4e4e7', // zinc-800 or zinc-200
  };

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
          <div className="flex flex-col md:flex-row justify-between md:items-center glass-card p-6 md:p-8 rounded-[2rem] premium-shadow gap-6">
            <div>
              <Link href="/dashboard/admin" className="text-xs font-black text-[var(--color-primary)] uppercase tracking-widest flex items-center mb-4 hover:translate-x-[-4px] transition-transform w-fit">
                <ArrowLeft size={14} className="mr-2" /> Back to Dashboard
              </Link>
              <h1 className="text-3xl font-black text-[var(--color-text-primary)] flex items-center tracking-tight leading-none">
                <LayoutDashboard className="mr-3 text-[var(--color-primary)]" size={32} /> Monthly <span className="ml-2 text-[var(--color-primary)]">Summary</span>
              </h1>
              <p className="text-[var(--color-text-muted)] text-sm mt-3 font-medium uppercase tracking-widest text-[10px]">Staff Performance & Attendance Overview</p>
            </div>
            <div
              onClick={() => monthInputRef.current?.showPicker()}
              className="bg-[var(--color-bg-soft)] p-2 rounded-2xl border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors"
            >
              <input
                ref={monthInputRef}
                type="month"
                className="bg-transparent border-none outline-none p-2 text-sm font-black text-[var(--color-text-primary)] uppercase tracking-widest cursor-pointer"
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
                <div className="glass-card p-8 rounded-[2.5rem] premium-shadow h-full">
                  <h2 className="text-xl font-black text-[var(--color-text-primary)] tracking-tight mb-8">Branch Attendance</h2>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                        <XAxis dataKey="locationName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.text }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: chartColors.text }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: chartColors.tooltipBg,
                            borderColor: chartColors.tooltipBorder,
                            borderRadius: '16px', 
                            border: '1px solid',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                          }}
                          itemStyle={{ fontWeight: 900, fontSize: '12px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: chartColors.text }} />
                        <Bar dataKey="totalPresentDays" fill="#10B981" name="Present" radius={[6, 6, 0, 0]} barSize={32} />
                        <Bar dataKey="totalAbsentDays" fill="#EF4444" name="Absent" radius={[6, 6, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </SlideIn>

              <SlideIn delay={0.2}>
                <div className="glass-card p-8 rounded-[2.5rem] premium-shadow h-full">
                  <h2 className="text-xl font-black text-[var(--color-text-primary)] tracking-tight mb-8">Staff Count</h2>
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
                          stroke={isDark ? '#18181b' : '#ffffff'}
                          strokeWidth={2}
                        >
                          {summary.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: chartColors.tooltipBg,
                            borderColor: chartColors.tooltipBorder,
                            borderRadius: '16px', 
                            border: '1px solid',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-8 space-y-3">
                    {summary.map((loc, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                        <span className="flex items-center"><div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div> {loc.locationName}</span>
                        <span className="text-[var(--color-text-primary)]">{loc.totalStaff} Staff</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SlideIn>
            </div>

            <SlideIn direction="up" delay={0.3}>
              <div className="glass-card rounded-[2.5rem] premium-shadow overflow-hidden border border-[var(--color-border)]">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-[var(--color-bg-soft)] border-b border-[var(--color-border)]">
                        <th className="px-8 py-6 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Branch Name</th>
                        <th className="px-8 py-6 text-center text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Total Staff</th>
                        <th className="px-8 py-6 text-center text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Presents</th>
                        <th className="px-8 py-6 text-center text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Absents</th>
                        <th className="px-8 py-6 text-right text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {summary.map((loc, idx) => {
                        const totalDays = loc.totalPresentDays + loc.totalAbsentDays;
                        const percentage = totalDays > 0 ? (loc.totalPresentDays / totalDays) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-[var(--color-bg-soft)]/50 transition-colors group">
                            <td className="px-8 py-6 whitespace-nowrap text-sm font-black text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-primary)] transition-colors">{loc.locationName}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-center text-sm font-bold text-[var(--color-text-muted)]">{loc.totalStaff}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-center text-sm font-black text-green-500">{loc.totalPresentDays}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-center text-sm font-black text-red-500">{loc.totalAbsentDays}</td>
                            <td className="px-8 py-6 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end">
                                <span className={`text-xs font-black mr-3 tracking-tighter ${percentage > 90 ? 'text-green-500' : percentage > 75 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {percentage.toFixed(1)}%
                                </span>
                                <div className="w-20 bg-[var(--color-bg-soft)] rounded-full h-1.5 overflow-hidden">
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
