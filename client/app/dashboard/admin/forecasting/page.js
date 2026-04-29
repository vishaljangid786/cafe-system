'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Calendar, Clock, MapPin, RefreshCcw, Award, Percent
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import toast from 'react-hot-toast';

export default function ForecastingDashboard() {
  const [locations, setLocations] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [selectedBranch]);

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data || []);
    } catch (err) {
      console.error('Failed to load branches');
    }
  };

  const fetchForecast = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/analytics/forecasting?branchId=${selectedBranch}`);
      setForecast(res.data.data);
    } catch (err) {
      toast.error('Forecasting telemetry mapping failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-xs font-black uppercase tracking-widest text-zinc-400">Extrapolating performance matrix data...</div>;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-4">
                <TrendingUp className="text-amber-500" size={36} /> 
                Smart <span className="text-amber-600">Forecasting</span>
              </h1>
              <p className="text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest">Statistical projections based on historical schemas</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="all">Global Network</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <button onClick={fetchForecast} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-500/30 text-zinc-500">
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>
        </SlideIn>

        {/* Prediction Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-[2.5rem] text-white shadow-xl">
            <Calendar size={24} className="opacity-80" />
            <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-80">Expected Today Revenue</p>
            <h2 className="text-4xl font-black mt-2 tracking-tight">₹{forecast?.expectedTodayRevenue?.toLocaleString() || 0}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold opacity-90">
              <Percent size={14} /> Confidence {forecast?.confidenceScore}%
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-[2.5rem] text-white shadow-xl">
            <TrendingUp size={24} className="opacity-80" />
            <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-80">Weekly Revenue Estimate</p>
            <h2 className="text-4xl font-black mt-2 tracking-tight">₹{forecast?.weeklyRevenueEstimate?.toLocaleString() || 0}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold opacity-90">
              <Percent size={14} /> Standard Deviation Checked
            </div>
          </div>

          <div className="p-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2.5rem] text-white shadow-xl">
            <Award size={24} className="opacity-80" />
            <p className="text-[10px] font-black uppercase tracking-widest mt-4 opacity-80">Best Category Forecast</p>
            <h2 className="text-4xl font-black mt-2 tracking-tight">{forecast?.bestCategoryForecast || 'N/A'}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold opacity-90">
              Leading high volume transactions.
            </div>
          </div>
        </div>

        {/* Tactical Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Slowest Business Days</p>
              <h3 className="text-2xl font-black mt-2 text-zinc-900 dark:text-white">{forecast?.slowBusinessDays || 'N/A'}</h3>
              <p className="text-xs text-zinc-500 mt-1">Recommended for promotions & maintenance</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <Calendar size={24} />
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Peak Hours Forecast</p>
              <h3 className="text-2xl font-black mt-2 text-zinc-900 dark:text-white">{forecast?.peakHoursForecast || 'N/A'}</h3>
              <p className="text-xs text-zinc-500 mt-1">Deploy additional personnel to limit throughput queue</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* Monthly Projection Chart */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/50 p-10 rounded-[2.5rem] shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-8">Next Month Revenue Trends (Extrapolated)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast?.nextMonthSalesTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a15" />
                <XAxis dataKey="day" fontSize={10} stroke="#71717a" />
                <YAxis fontSize={10} stroke="#71717a" />
                <Tooltip contentStyle={{ background: '#18181b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff', fontSize: '11px' }} />
                <Bar dataKey="projected" fill="#d97706" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
