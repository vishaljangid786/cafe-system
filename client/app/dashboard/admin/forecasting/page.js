'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { StatGridSkeleton, ChartSkeleton } from '@/app/components/ui/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Calendar, Clock, RefreshCcw, Award, Percent
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import useBranchScope from '../../../hooks/useBranchScope';
import { Money } from '@/app/components/ui/Money';
import { formatIndianCompact } from '@/app/utils/formatNumber';

export default function ForecastingDashboard() {
  const { singleBranchId } = useBranchScope();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);

  const fetchForecast = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const res = await api.get(`/analytics/forecasting?branchId=${singleBranchId}&period=${selectedPeriod}`);
      setForecast(res.data.data);
    } catch (err) {
      console.error('Could not load forecast. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchForecast();
    }, 0);

    return () => clearTimeout(timer);
  }, [singleBranchId, selectedPeriod]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight flex items-center gap-3">
                <TrendingUp className="text-primary" size={24} />
                Sales <span className="text-primary">Forecast</span>
              </h1>
              <p className="text-(--color-text-secondary) text-sm font-medium mt-1 tracking-normal">Estimates based on your past sales</p>
            </div>

            <div className="flex items-center gap-4">
              <PremiumSelect
                value={selectedPeriod}
                onChange={(val) => setSelectedPeriod(val)}
                options={[
                  { label: 'Today', value: 'today' },
                  { label: 'Weekly', value: 'week' },
                  { label: 'Monthly', value: 'month' },
                  { label: 'Financial Year', value: 'FY' }
                ]}
                className="min-w-[150px]"
              />

              <button onClick={fetchForecast} className="p-3 bg-(--color-surface) border border-(--color-border) rounded-xl hover:border-primary/30 text-(--color-text-muted)">
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>
        </SlideIn>

        {refetching ? (
          <>
            <StatGridSkeleton count={3} />
            <StatGridSkeleton count={2} />
            <ChartSkeleton />
          </>
        ) : (
          <>
        {/* Prediction Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 bg-gradient-to-br from-primary to-primary rounded-xl text-white shadow-sm">
            <Calendar size={24} className="opacity-80" />
            <p className="text-[11px] font-medium uppercase tracking-normal mt-4 opacity-80">Expected Today Revenue</p>
            <h2 className="text-2xl font-semibold mt-2 tracking-tight"><Money value={forecast?.expectedTodayRevenue || 0} /></h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium opacity-90">
              <Percent size={14} /> Confidence {forecast?.confidenceScore}%
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-primary to-primary rounded-xl text-white shadow-sm">
            <TrendingUp size={24} className="opacity-80" />
            <p className="text-[11px] font-medium uppercase tracking-normal mt-4 opacity-80">Weekly Revenue Estimate</p>
            <h2 className="text-2xl font-semibold mt-2 tracking-tight"><Money value={forecast?.weeklyRevenueEstimate || 0} /></h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium opacity-90">
              <Percent size={14} /> Based on recent sales
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-success to-success rounded-xl text-white shadow-sm">
            <Award size={24} className="opacity-80" />
            <p className="text-[11px] font-medium uppercase tracking-normal mt-4 opacity-80">Best Category Forecast</p>
            <h2 className="text-2xl font-semibold mt-2 tracking-tight">{forecast?.bestCategoryForecast || 'N/A'}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium opacity-90">
              Your top-selling category.
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 bg-(--color-surface) border border-(--color-border) rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Slowest Business Days</p>
              <h3 className="text-2xl font-semibold mt-2 text-(--color-text-primary)">{forecast?.slowBusinessDays || 'N/A'}</h3>
              <p className="text-xs text-(--color-text-secondary) mt-1">Recommended for promotions & maintenance</p>
            </div>
            <div className="h-6 w-6 rounded-xl bg-danger/10 text-danger flex items-center justify-center border border-danger/20">
              <Calendar size={16} />
            </div>
          </div>

          <div className="p-5 bg-(--color-surface) border border-(--color-border) rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-normal text-(--color-text-muted)">Peak Hours Forecast</p>
              <h3 className="text-2xl font-semibold mt-2 text-(--color-text-primary)">{forecast?.peakHoursForecast || 'N/A'}</h3>
              <p className="text-xs text-(--color-text-secondary) mt-1">Add extra staff to keep wait times low</p>
            </div>
            <div className="h-6 w-6 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Clock size={16} />
            </div>
          </div>
        </div>

        {/* Monthly Projection Chart */}
        <div className="bg-(--color-surface)/80  border border-(--color-border) p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium uppercase tracking-normal text-(--color-text-muted) mb-6">Expected Revenue Next Month</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast?.nextMonthSalesTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" fontSize={10} stroke="var(--color-text-muted)" />
                <YAxis fontSize={10} stroke="var(--color-text-muted)" width={70} tickFormatter={(v) => formatIndianCompact(v, { currency: true })} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '1rem', color: 'var(--color-text-primary)', fontSize: '11px' }} formatter={(v) => formatIndianCompact(v, { currency: true })} />
                <Bar dataKey="projected" fill="var(--color-primary)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
