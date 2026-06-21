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
  TrendingUp, Calendar, Clock, MapPin, RefreshCcw, Award, Percent
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import toast from 'react-hot-toast';
import PremiumSelect from '@/app/components/ui/PremiumSelect';

export default function ForecastingDashboard() {
  const [locations, setLocations] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data || []);
    } catch (err) {
      console.error('Failed to load branches');
    }
  };

  const fetchForecast = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const res = await api.get(`/analytics/forecasting?branchId=${selectedBranch}&period=${selectedPeriod}`);
      setForecast(res.data.data);
    } catch (err) {
      toast.error('Forecasting data mapping failed');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchForecast();
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedBranch, selectedPeriod]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight flex items-center gap-4">
                <TrendingUp className="text-[var(--color-primary)]" size={36} /> 
                Smart <span className="text-[var(--color-primary)]">Forecasting</span>
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm font-medium mt-1 uppercase tracking-normal">Predictions based on past data</p>
            </div>

            <div className="flex items-center gap-4">
              <PremiumSelect
                value={selectedBranch}
                onChange={(val) => setSelectedBranch(val)}
                options={[
                  { label: 'Global Network', value: 'all' },
                  ...locations.map(loc => ({ label: loc.name, value: loc._id }))
                ]}
                className="min-w-[180px]"
              />

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

              <button onClick={fetchForecast} className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)]/30 text-[var(--color-text-muted)]">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)] rounded-xl text-white shadow-sm">
            <Calendar size={24} className="opacity-80" />
            <p className="text-[10px] font-bold uppercase tracking-normal mt-4 opacity-80">Expected Today Revenue</p>
            <h2 className="text-4xl font-bold mt-2 tracking-tight">₹{forecast?.expectedTodayRevenue?.toLocaleString() || 0}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold opacity-90">
              <Percent size={14} /> Confidence {forecast?.confidenceScore}%
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary)] rounded-xl text-white shadow-sm">
            <TrendingUp size={24} className="opacity-80" />
            <p className="text-[10px] font-bold uppercase tracking-normal mt-4 opacity-80">Weekly Revenue Estimate</p>
            <h2 className="text-4xl font-bold mt-2 tracking-tight">₹{forecast?.weeklyRevenueEstimate?.toLocaleString() || 0}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold opacity-90">
              <Percent size={14} /> Standard Deviation Checked
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-[var(--color-success)] to-[var(--color-success)] rounded-xl text-white shadow-sm">
            <Award size={24} className="opacity-80" />
            <p className="text-[10px] font-bold uppercase tracking-normal mt-4 opacity-80">Best Category Forecast</p>
            <h2 className="text-4xl font-bold mt-2 tracking-tight">{forecast?.bestCategoryForecast || 'N/A'}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold opacity-90">
              Leading high volume transactions.
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Slowest Business Days</p>
              <h3 className="text-2xl font-bold mt-2 text-[var(--color-text-primary)]">{forecast?.slowBusinessDays || 'N/A'}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Recommended for promotions & maintenance</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-[var(--color-danger)]/10 text-[var(--color-danger)] flex items-center justify-center border border-[var(--color-danger)]/20">
              <Calendar size={24} />
            </div>
          </div>

          <div className="p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Peak Hours Forecast</p>
              <h3 className="text-2xl font-bold mt-2 text-[var(--color-text-primary)]">{forecast?.peakHoursForecast || 'N/A'}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Deploy additional staff to limit throughput queue</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* Monthly Projection Chart */}
        <div className="bg-[var(--color-surface)]/80  border border-[var(--color-border)] p-10 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-normal text-[var(--color-text-muted)] mb-8">Next Month Revenue Trends (Extrapolated)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast?.nextMonthSalesTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" fontSize={10} stroke="var(--color-text-muted)" />
                <YAxis fontSize={10} stroke="var(--color-text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: '1rem', color: 'var(--color-text-primary)', fontSize: '11px' }} />
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
