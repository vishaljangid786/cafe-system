'use client';
import { useState, useEffect } from 'react';
import api from '../../../services/api';
import {
  ShoppingBag, Flame, Users, DollarSign, Clock,
  Heart, AlertCircle, MapPin, RefreshCcw, Bell
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function CommandCenterPage() {
  const [locations, setLocations] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchStats();
    
    // Setup real-time socket connections
    const socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      socket.emit('join_session', { role: 'admin' });
    });

    const handleRealTimeEvent = () => {
      fetchStats();
    };

    socket.on('order:new', handleRealTimeEvent);
    socket.on('order:update', handleRealTimeEvent);
    socket.on('order:ready', (data) => {
      handleRealTimeEvent();
      setAlerts(prev => [
        { id: Date.now(), title: 'Order Ready', message: data.message || 'Fulfillment Ready', type: 'success' },
        ...prev.slice(0, 4)
      ]);
    });
    socket.on('order:cancel', handleRealTimeEvent);

    return () => socket.close();
  }, [selectedBranch]);

  const fetchInitialData = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data || []);
    } catch (error) {
      toast.error('Failed to initialize location models');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get(`/analytics/command-center?branchId=${selectedBranch}`);
      setStats(res.data.data);
    } catch (error) {
      console.error('Command center fetch fail');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 text-xs font-black uppercase tracking-widest text-zinc-400">Loading Command Telemetry...</div>;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                Operations <span className="text-amber-500">Command Center</span>
              </h1>
              <p className="text-zinc-500 text-sm font-medium mt-1 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                Live Operational Signals Monitoring
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm text-xs font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="all">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={fetchStats}
                className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-500/30 transition-all text-zinc-500"
              >
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>
        </SlideIn>

        {/* Real-Time Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Orders Incoming Now', value: stats?.ordersIncomingNow || 0, icon: ShoppingBag, color: 'from-amber-500 to-orange-600', anim: stats?.ordersIncomingNow > 0 },
            { label: 'Kitchen Busy Level', value: stats?.kitchenBusyLevel || 0, icon: Flame, color: 'from-rose-500 to-red-600', anim: stats?.kitchenBusyLevel > 5 },
            { label: 'Tables Occupied', value: stats?.tablesOccupied || 0, icon: Users, color: 'from-blue-500 to-indigo-600' },
            { label: 'Revenue Today Live', value: `₹${stats?.revenueTodayLive?.toLocaleString() || 0}`, icon: DollarSign, color: 'from-emerald-500 to-teal-600' }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.1}>
              <div className={`p-8 bg-gradient-to-br ${stat.color} rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-125 transition-transform duration-700">
                  <stat.icon size={120} />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{stat.label}</span>
                  {stat.anim && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                    </span>
                  )}
                </div>
                <h2 className="text-4xl font-black mt-6 tracking-tight">{stat.value}</h2>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Secondary Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Online Staff */}
          <div className="p-8 bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Staff Synchronized</p>
              <h3 className="text-3xl font-black mt-2 text-zinc-900 dark:text-white">{stats?.activeStaffOnline || 0}</h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shadow-sm">
              <Users size={24} />
            </div>
          </div>

          {/* Pending Orders > 10 Min */}
          <div className={`p-8 bg-white dark:bg-zinc-950/20 border rounded-[2.5rem] flex items-center justify-between shadow-sm transition-all ${stats?.pendingOrdersOver10Min > 0 ? 'border-rose-500/30' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bottlenecks &gt; 10 Mins</p>
              <h3 className={`text-3xl font-black mt-2 ${stats?.pendingOrdersOver10Min > 0 ? 'text-rose-500' : 'text-zinc-900 dark:text-white'}`}>{stats?.pendingOrdersOver10Min || 0}</h3>
            </div>
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center border shadow-sm ${stats?.pendingOrdersOver10Min > 0 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
              <Clock size={24} />
            </div>
          </div>

          {/* Branch Health Score */}
          <div className="p-8 bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Branch Health Score</p>
              <h3 className="text-3xl font-black mt-2 text-zinc-900 dark:text-white">{stats?.branchHealthScore || 100}%</h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-sm">
              <Heart size={24} />
            </div>
          </div>
        </div>

        {/* Alerts & Operational Logs */}
        <div className="bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800 p-10 rounded-[2.5rem] shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">System Operational Alerts</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Direct synchronization telemetry</p>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {alerts.map(alert => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-center gap-4 hover:border-amber-500/20 transition-all font-bold text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-zinc-900 dark:text-zinc-100 font-black">{alert.title}</span>
                  <span className="text-zinc-500">{alert.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {alerts.length === 0 && (
              <div className="text-xs italic font-bold text-zinc-400 opacity-50 text-center py-6">No emergency operational interrupts recorded.</div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
