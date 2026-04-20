'use client';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Wallet, Users, 
  Coffee, Calendar, Zap, Activity, Clock
} from 'lucide-react';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { StatWidget } from '../../components/ui/StatWidget';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { ActivityTimeline } from '../../components/ui/ActivityTimeline';
import { Button } from '../../components/ui/Button';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const { selectedLocation } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [compareData, setCompareData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock time-series data
  const revenueSeries = [
    { name: '08:00', value: 4000 },
    { name: '10:00', value: 3000 },
    { name: '12:00', value: 2000 },
    { name: '14:00', value: 2780 },
    { name: '16:00', value: 1890 },
    { name: '18:00', value: 2390 },
    { name: '20:00', value: 3490 },
    { name: '22:00', value: 4000 },
  ];

  const orderSeries = [
    { day: 'Mon', count: 45 },
    { day: 'Tue', count: 52 },
    { day: 'Wed', count: 38 },
    { day: 'Thu', count: 65 },
    { day: 'Fri', count: 89 },
    { day: 'Sat', count: 120 },
    { day: 'Sun', count: 95 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const query = selectedLocation ? `?locationId=${selectedLocation._id}` : '';
        const analyticsPath = selectedLocation ? '/analytics/location' : '/analytics/all';
        
        const [statsRes, compareRes] = await Promise.all([
          api.get(`${analyticsPath}${query}`),
          api.get('/analytics/compare-locations?sort=highest profit')
        ]);
        
        setAnalytics(statsRes.data.data);
        setCompareData(compareRes.data.data);
      } catch (error) {
        console.error("Failed to fetch location analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedLocation]);

  if (loading) return (
    <div className="space-y-8 p-4 md:p-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <CardSkeleton /><CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-black tracking-tighter text-foreground"
          >
            {selectedLocation ? `${selectedLocation.city} Hub` : 'Global Network'} <span className="text-accent">Intelligence</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground font-medium mt-2"
          >
            {selectedLocation ? `Operational metrics for ${selectedLocation.name}.` : 'Real-time synchronization across all operational hubs.'}
          </motion.p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={Calendar}>History</Button>
          <Button variant="primary" icon={Zap}>Sync Matrix</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatWidget 
          label="Total Revenue" 
          value={`₹${analytics?.totalRevenue?.toLocaleString() || 0}`} 
          icon={TrendingUp} trend="+12.5%" isUp={true} color="amber"
        />
        <StatWidget 
          label="Net Profit" 
          value={`₹${analytics?.profit?.toLocaleString() || 0}`} 
          icon={Wallet} trend="+18.3%" isUp={true} color="green"
        />
        <StatWidget 
          label="Operational Expense" 
          value={`₹${analytics?.totalExpense?.toLocaleString() || 0}`} 
          icon={TrendingDown} trend="+4.2%" isUp={false} color="red"
        />
        <StatWidget 
          label="Active Terminals" 
          value="42" icon={Coffee} trend="Live" isUp={true} color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="!p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <CardTitle>Revenue Velocity</CardTitle>
                <CardDescription>Intraday fiscal performance tracking.</CardDescription>
              </div>
              <div className="flex bg-muted p-1 rounded-xl">
                {['1H', '24H', '7D', '30D'].map(t => (
                  <button key={t} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${t === '24H' ? 'bg-background text-accent shadow-sm' : 'text-muted-foreground'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#71717a'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#71717a'}} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', color: '#fafafa'}} cursor={{ stroke: '#f59e0b', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="!p-8">
              <CardTitle className="mb-6">Node Rankings</CardTitle>
              <div className="space-y-6">
                {compareData.slice(0, 4).map((loc, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>{loc.city} - {loc.locationName}</span>
                      <span className="text-foreground">₹{loc.revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(loc.revenue / Math.max(...compareData.map(b => b.revenue))) * 100}%` }}
                        transition={{ duration: 1, delay: idx * 0.1 }}
                        className="h-full bg-accent rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="!p-8">
              <CardTitle className="mb-2">Order Distribution</CardTitle>
              <CardDescription className="mb-6">Weekly throughput volume.</CardDescription>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orderSeries}>
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#71717a'}} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-8">
          <Card className="!p-8 h-full bg-accent/5 border-accent/10">
            <div className="flex items-center justify-between mb-8">
              <CardTitle>Activity Feed</CardTitle>
              <Activity className="text-accent" size={18} />
            </div>
            <ActivityTimeline 
              items={[
                {
                  title: 'Location Shift',
                  description: `Now monitoring ${selectedLocation ? selectedLocation.city : 'Global Network'}.`,
                  time: 'JUST NOW',
                  type: 'system',
                  icon: <Zap size={16} />
                },
                {
                  title: 'High Volume Alert',
                  description: 'MI Road hub exceeded threshold capacity.',
                  time: '12 MIN AGO',
                  type: 'order',
                  icon: <Zap size={16} />
                },
                {
                  title: 'Personnel Onboarding',
                  description: 'New staff matrix updated for CP location.',
                  time: '2 HOURS AGO',
                  type: 'staff',
                  icon: <Users size={16} />
                }
              ]}
            />
            <Button variant="outline" className="w-full mt-10 !rounded-2xl" icon={Clock}>Audit Logs</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
