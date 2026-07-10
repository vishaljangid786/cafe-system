'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import useBranchScope from '../../../hooks/useBranchScope';
import { toMonthInput } from '@/app/utils/dateInput';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, Users, Calendar, Wallet, Loader2, ArrowLeft } from 'lucide-react';
import { PageTransition, SlideIn, CardHover } from '../../../components/ui/AnimatedContainer';
import Link from 'next/link';
import { motion } from 'framer-motion'
import { useTheme } from '../../../context/ThemeContext';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { ChartSkeleton, CardSkeleton } from '@/app/components/ui/Skeleton';

export default function MonthlySummaryPage() {
  const { theme } = useTheme();
  const { singleBranchId, scopeKey } = useBranchScope();
  const monthInputRef = useRef(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [month, setMonth] = useState(toMonthInput());

  const isDark = theme === 'dark';

  const COLORS = ['var(--color-primary)', 'var(--color-accent)', '#ea580c', '#f43f5e', '#8b5cf6'];

  const chartColors = {
    grid: 'var(--color-border)',
    text: 'var(--color-text-muted)',
    tooltipBg: 'var(--color-surface)',
    tooltipBorder: 'var(--color-border)',
  };

  const fetchSummary = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const params = new URLSearchParams({ month });
      if (singleBranchId && singleBranchId !== 'all') params.append('locationId', singleBranchId);
      const res = await api.get(`/attendance/monthly-summary?${params.toString()}`);
      setSummary(res.data.data);
    } catch (error) {
      console.error('Failed to fetch monthly summary:', error);
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSummary();
    }, 0);

    return () => clearTimeout(timer);
  }, [month, scopeKey]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6">
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row justify-between md:items-center glass-card p-5 md:p-6 rounded-xl premium-shadow gap-5">
            <div>
              <Link href="/dashboard/admin" className="text-[11px] font-medium text-primary tracking-wide flex items-center mb-3 hover:translate-x-[-4px] transition-transform w-fit">
                <ArrowLeft size={14} className="mr-2" /> Back to Dashboard
              </Link>
              <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) flex items-center tracking-tight leading-none">
                <LayoutDashboard className="mr-3 text-primary" size={28} /> Monthly <span className="ml-2 text-primary">Summary</span>
              </h1>
              <p className="text-(--color-text-muted) mt-3 font-medium tracking-wide text-[11px]">Staff Performance & Attendance Overview</p>
            </div>
            <div
              onClick={() => monthInputRef.current?.showPicker()}
              className="bg-(--color-bg-soft) p-2 rounded-xl border border-(--color-border) cursor-pointer hover:border-primary/50 transition-colors"
            >
              <input
                ref={monthInputRef}
                type="month"
                className="bg-transparent border-none outline-none p-2 text-sm font-medium text-(--color-text-primary) tracking-wide cursor-pointer"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </SlideIn>

        {refetching ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2"><ChartSkeleton /></div>
              <ChartSkeleton />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <SlideIn className="lg:col-span-2" delay={0.1}>
                <div className="glass-card p-6 rounded-xl premium-shadow h-full">
                  <h2 className="text-xl font-semibold text-(--color-text-primary) tracking-tight mb-6">Branch Attendance</h2>
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
                <div className="glass-card p-6 rounded-xl premium-shadow h-full">
                  <h2 className="text-xl font-semibold text-(--color-text-primary) tracking-tight mb-6">Staff Count</h2>
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
                  <div className="mt-6 space-y-3">
                    {summary.map((loc, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] font-medium tracking-wide text-(--color-text-muted)">
                        <span className="flex items-center"><div className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div> {loc.locationName}</span>
                        <span className="text-(--color-text-primary)">{loc.totalStaff} Staff</span>
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
                      className="glass-card p-5 rounded-xl border border-(--color-border) hover:border-primary/40 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-semibold text-(--color-text-primary) tracking-tight group-hover:text-primary transition-colors">
                            {loc.locationName}
                          </h3>
                          <p className="text-[11px] font-medium tracking-wide text-(--color-text-muted) mt-1">
                            {loc.totalStaff} Staff Members
                          </p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-xl text-[11px] font-medium tracking-tight border ${
                          percentage > 90 
                            ? 'bg-success/10 text-success border-success/20' 
                            : percentage > 75 
                            ? 'bg-primary/10 text-primary border-primary/20' 
                            : 'bg-danger/10 text-danger border-danger/20'
                        }`}>
                          {percentage.toFixed(1)}% Present
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-(--color-surface-soft) p-4 rounded-xl border border-(--color-border)">
                          <p className="text-[11px] font-medium tracking-wide text-(--color-text-muted) mb-1">Present Days</p>
                          <p className="text-2xl font-semibold text-success">{loc.totalPresentDays}</p>
                        </div>
                        <div className="bg-(--color-surface-soft) p-4 rounded-xl border border-(--color-border)">
                          <p className="text-[11px] font-medium tracking-wide text-(--color-text-muted) mb-1">Absent Days</p>
                          <p className="text-2xl font-semibold text-danger">{loc.totalAbsentDays}</p>
                        </div>
                      </div>

                      <div className="w-full bg-(--color-bg-soft) rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className={`h-full rounded-full ${
                            percentage > 90 ? 'bg-success ' 
                            : percentage > 75 ? 'bg-primary ' 
                            : 'bg-danger '
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
