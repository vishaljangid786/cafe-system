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

  const COLORS = ['var(--color-primary)', 'var(--color-accent)', '#ea580c', '#f43f5e', '#8b5cf6'];

  const chartColors = {
    grid: 'var(--color-border)',
    text: 'var(--color-text-muted)',
    tooltipBg: 'var(--color-surface)',
    tooltipBorder: 'var(--color-border)',
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
    const timer = setTimeout(() => {
      fetchSummary();
    }, 0);

    return () => clearTimeout(timer);
  }, [month]);

  return (
    <PageTransition>
      <div className="space-y-8">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center glass-card p-6 md:p-8 rounded-xl premium-shadow gap-6">
            <div>
              <Link href="/dashboard/admin" className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-normal flex items-center mb-4 hover:translate-x-[-4px] transition-transform w-fit">
                <ArrowLeft size={14} className="mr-2" /> Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] flex items-center tracking-tight leading-none">
                <LayoutDashboard className="mr-3 text-[var(--color-primary)]" size={32} /> Monthly <span className="ml-2 text-[var(--color-primary)]">Summary</span>
              </h1>
              <p className="text-[var(--color-text-muted)] text-sm mt-3 font-medium uppercase tracking-normal text-[10px]">Staff Performance & Attendance Overview</p>
            </div>
            <div
              onClick={() => monthInputRef.current?.showPicker()}
              className="bg-[var(--color-bg-soft)] p-2 rounded-xl border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors"
            >
              <input
                ref={monthInputRef}
                type="month"
                className="bg-transparent border-none outline-none p-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-normal cursor-pointer"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </SlideIn>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 h-96 bg-[var(--color-surface-soft)] animate-pulse rounded-xl"></div>
            <div className="h-96 bg-[var(--color-surface-soft)] animate-pulse rounded-xl"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <SlideIn className="lg:col-span-2" delay={0.1}>
                <div className="glass-card p-8 rounded-xl premium-shadow h-full">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight mb-8">Branch Attendance</h2>
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
                        <Bar dataKey="totalPresentDays" fill="var(--color-success)" name="Present" radius={[6, 6, 0, 0]} barSize={32} />
                        <Bar dataKey="totalAbsentDays" fill="var(--color-danger)" name="Absent" radius={[6, 6, 0, 0]} barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </SlideIn>

              <SlideIn delay={0.2}>
                <div className="glass-card p-8 rounded-xl premium-shadow h-full">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight mb-8">Staff Count</h2>
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
                      <div key={idx} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">
                        <span className="flex items-center"><div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div> {loc.locationName}</span>
                        <span className="text-[var(--color-text-primary)]">{loc.totalStaff} Staff</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SlideIn>
            </div>

            <SlideIn direction="up" delay={0.3}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {summary.map((loc, idx) => {
                  const totalDays = loc.totalPresentDays + loc.totalAbsentDays;
                  const percentage = totalDays > 0 ? (loc.totalPresentDays / totalDays) * 100 : 0;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className="glass-card p-6 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-primary)] transition-colors">
                            {loc.locationName}
                          </h3>
                          <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mt-1">
                            {loc.totalStaff} Staff Members
                          </p>
                        </div>
                        <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-tight shadow-sm border ${
                          percentage > 90 
                            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20' 
                            : percentage > 75 
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' 
                            : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20'
                        }`}>
                          {percentage.toFixed(1)}% PERF
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-[var(--color-surface-soft)] p-4 rounded-xl border border-[var(--color-border)]">
                          <p className="text-[9px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">Presents</p>
                          <p className="text-2xl font-bold text-[var(--color-success)]">{loc.totalPresentDays}</p>
                        </div>
                        <div className="bg-[var(--color-surface-soft)] p-4 rounded-xl border border-[var(--color-border)]">
                          <p className="text-[9px] font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-1">Absents</p>
                          <p className="text-2xl font-bold text-[var(--color-danger)]">{loc.totalAbsentDays}</p>
                        </div>
                      </div>

                      <div className="w-full bg-[var(--color-bg-soft)] rounded-full h-2 overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className={`h-full rounded-full ${
                            percentage > 90 ? 'bg-[var(--color-success)] ' 
                            : percentage > 75 ? 'bg-[var(--color-primary)] ' 
                            : 'bg-[var(--color-danger)] '
                          }`}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </SlideIn>
          </>
        )}
      </div>
    </PageTransition>
  );
}
