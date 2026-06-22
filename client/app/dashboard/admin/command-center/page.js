'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import {
  ShoppingBag, Flame, Users, DollarSign, Clock,
  Heart, AlertCircle, MapPin, RefreshCcw, Bell
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import getSocketUrl from '../../../services/socketUrl';
import toast from 'react-hot-toast';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import LoadingScreen from '../../../components/ui/LoadingScreen';
import { progress } from '../../../components/ui/TopProgressBar';
import { CardSkeleton } from '../../../components/ui/Skeleton';

const SOCKET_URL = getSocketUrl();

export default function CommandCenterPage() {
  const [locations, setLocations] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const didInitRef = useRef(false);

  const fetchInitialData = async () => {
    try {
      const res = await api.get('/locations');
      setLocations(res.data.data || []);
    } catch (error) {
      toast.error('Could not load branches. Please try again.');
    }
  };

  // `silent` is used for real-time socket refreshes so live updates never
  // flicker a skeleton. The first call drives the full-page loader; subsequent
  // user-initiated calls (branch filter / manual refresh) show a section skeleton.
  const fetchStats = async ({ silent = false } = {}) => {
    const isInitial = !didInitRef.current;
    if (!silent) {
      if (isInitial) setLoading(true);
      else setRefetching(true);
      progress.start();
    }
    try {
      const res = await api.get(`/analytics/command-center?branchId=${selectedBranch}`);
      setStats(res.data.data);
    } catch (error) {
      console.error('Command center fetch fail');
    } finally {
      didInitRef.current = true;
      if (!silent) {
        setLoading(false);
        setRefetching(false);
        progress.done();
      }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInitialData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStats();
    }, 0);
    
    // Setup real-time socket connections
    if (!SOCKET_URL) return;

    const socket = io(SOCKET_URL, { withCredentials: true });
    
    socket.on('connect', () => {
      socket.emit('join_session', { branchId: selectedBranch });
    });

    const handleRealTimeEvent = () => {
      fetchStats({ silent: true });
    };

    socket.on('order:new', handleRealTimeEvent);
    socket.on('order:update', handleRealTimeEvent);
    socket.on('order:ready', (data) => {
      handleRealTimeEvent();
      setAlerts(prev => [
        { id: Date.now(), title: 'Order Ready', message: data.message || 'An order is ready to serve', type: 'success' },
        ...prev.slice(0, 4)
      ]);
    });
    socket.on('order:cancel', handleRealTimeEvent);

    return () => {
      clearTimeout(timer);
      socket.close();
    };
  }, [selectedBranch]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        {/* Header */}
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
                Live <span className="text-[var(--color-primary)]">Control Panel</span>
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm font-medium mt-1 uppercase tracking-normal flex items-center gap-2">
                <span className="w-2 h-2 bg-[var(--color-success)] rounded-full animate-ping" />
                Live updates from your cafe
              </p>
            </div>

            <div className="flex items-center gap-4">
              <PremiumSelect
                value={selectedBranch}
                onChange={(val) => setSelectedBranch(val)}
                options={[
                  { label: 'All Locations', value: 'all' },
                  ...locations.map(loc => ({ label: loc.name, value: loc._id }))
                ]}
                className="min-w-[200px]"
              />

              <button
                onClick={() => fetchStats()}
                className={`p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)]/30 transition-all text-[var(--color-text-muted)] ${refetching ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <RefreshCcw size={16} className={refetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </SlideIn>

        {refetching ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
        {/* Real-Time Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'New Orders Now', value: stats?.ordersIncomingNow || 0, icon: ShoppingBag, color: 'from-[var(--color-primary)] to-[var(--color-secondary)]', anim: stats?.ordersIncomingNow > 0 },
            { label: 'Kitchen Busy Level', value: stats?.kitchenBusyLevel || 0, icon: Flame, color: 'from-[var(--color-danger)] to-[var(--color-danger-dark)]', anim: stats?.kitchenBusyLevel > 5 },
            { label: 'Tables Occupied', value: stats?.tablesOccupied || 0, icon: Users, color: 'from-[var(--color-primary-dark)] to-[var(--color-primary)]' },
            { label: "Today's Revenue", value: `₹${stats?.revenueTodayLive?.toLocaleString() || 0}`, icon: DollarSign, color: 'from-[var(--color-success)] to-[var(--color-success-dark)]' }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.1}>
              <div className={`p-8 bg-gradient-to-br ${stat.color} rounded-xl text-white shadow-sm relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transition-transform duration-700">
                  <stat.icon size={120} />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-normal opacity-80">{stat.label}</span>
                  {stat.anim && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-surface)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--color-surface)]"></span>
                    </span>
                  )}
                </div>
                <h2 className="text-4xl font-bold mt-6 tracking-tight">{stat.value}</h2>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Secondary Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Online Staff */}
          <div className="p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Staff Online</p>
              <h3 className="text-3xl font-bold mt-2 text-[var(--color-text-primary)]">{stats?.activeStaffOnline || 0}</h3>
            </div>
            <div className="h-14 w-14 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20 shadow-sm">
              <Users size={24} />
            </div>
          </div>

          {/* Pending Orders > 10 Min */}
          <div className={`p-8 bg-[var(--color-surface)] border rounded-xl flex items-center justify-between shadow-sm transition-all ${stats?.pendingOrdersOver10Min > 0 ? 'border-[var(--color-danger)]/30' : 'border-[var(--color-border)]'}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Orders Waiting &gt; 10 Mins</p>
              <h3 className={`text-3xl font-bold mt-2 ${stats?.pendingOrdersOver10Min > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>{stats?.pendingOrdersOver10Min || 0}</h3>
            </div>
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center border shadow-sm ${stats?.pendingOrdersOver10Min > 0 ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}>
              <Clock size={24} />
            </div>
          </div>

          {/* Branch Health Score */}
          <div className="p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-normal text-[var(--color-text-muted)]">Branch Health Score</p>
              <h3 className="text-3xl font-bold mt-2 text-[var(--color-text-primary)]">{stats?.branchHealthScore || 100}%</h3>
            </div>
            <div className="h-14 w-14 rounded-xl bg-[var(--color-success)]/10 text-[var(--color-success)] flex items-center justify-center border border-[var(--color-success)]/20 shadow-sm">
              <Heart size={24} />
            </div>
          </div>
        </div>
          </>
        )}

        {/* Alerts & Operational Logs */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-10 rounded-xl shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-10 w-10 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-xl flex items-center justify-center border border-[var(--color-primary)]/20">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">Live Alerts</h3>
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-normal mt-1">Updated in real time</p>
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
                  className="p-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] rounded-xl flex items-center gap-4 hover:border-[var(--color-primary)]/20 transition-all font-bold text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
                  <span className="text-[var(--color-text-primary)] font-bold">{alert.title}</span>
                  <span className="text-[var(--color-text-secondary)]">{alert.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {alerts.length === 0 && (
              <div className="text-xs italic font-bold text-[var(--color-text-muted)] opacity-50 text-center py-6">No alerts right now.</div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
