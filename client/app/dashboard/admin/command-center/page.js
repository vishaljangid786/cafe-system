'use client';
import { useState, useEffect, useRef } from 'react';
import api from '../../../services/api';
import {
  ShoppingBag, Flame, Users, DollarSign, Clock,
  Heart, AlertCircle, RefreshCcw, Bell
} from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import getSocketUrl from '../../../services/socketUrl';
import toast from 'react-hot-toast';
import useBranchScope from '../../../hooks/useBranchScope';
import LoadingScreen from '../../../components/ui/LoadingScreen';
import { progress } from '../../../components/ui/TopProgressBar';
import { CardSkeleton } from '../../../components/ui/Skeleton';
import { formatIndianCompact } from '../../../utils/formatNumber';

const SOCKET_URL = getSocketUrl();

export default function CommandCenterPage() {
  const { singleBranchId } = useBranchScope();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const didInitRef = useRef(false);

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
      const res = await api.get(`/analytics/command-center?branchId=${singleBranchId}`);
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
      fetchStats();
    }, 0);
    
    // Setup real-time socket connections
    if (!SOCKET_URL) return;

    const socket = io(SOCKET_URL, { withCredentials: true });
    
    socket.on('connect', () => {
      socket.emit('join_session', { branchId: singleBranchId });
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
  }, [singleBranchId]);

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <SlideIn direction="down">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-(--color-text-primary) tracking-tight">
                Live <span className="text-primary">Control Panel</span>
              </h1>
              <p className="text-(--color-text-secondary) text-sm font-medium mt-1 tracking-normal flex items-center gap-2">
                <span className="w-2 h-2 bg-success rounded-full animate-ping" />
                Live updates from your cafe
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => fetchStats()}
                className={`p-3 bg-(--color-surface) border border-(--color-border) rounded-xl hover:border-primary/30 transition-all text-(--color-text-muted) ${refetching ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <RefreshCcw size={16} className={refetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </SlideIn>

        {refetching ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <>
        {/* Real-Time Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'New Orders Now', value: stats?.ordersIncomingNow || 0, icon: ShoppingBag, color: 'from-primary to-secondary', anim: stats?.ordersIncomingNow > 0 },
            { label: 'Kitchen Busy Level', value: stats?.kitchenBusyLevel || 0, icon: Flame, color: 'from-danger to-(--color-danger-dark)', anim: stats?.kitchenBusyLevel > 5 },
            { label: 'Tables Occupied', value: stats?.tablesOccupied || 0, icon: Users, color: 'from-primary-dark to-primary' },
            { label: "Today's Revenue", value: formatIndianCompact(stats?.revenueTodayLive || 0, { currency: true }), icon: DollarSign, color: 'from-success to-(--color-success-dark)' }
          ].map((stat, i) => (
            <SlideIn key={i} delay={i * 0.1}>
              <div className={`p-5 bg-gradient-to-br ${stat.color} rounded-xl text-white shadow-sm relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <stat.icon size={120} />
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-medium tracking-normal opacity-80">{stat.label}</span>
                  {stat.anim && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--color-surface) opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-(--color-surface)"></span>
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-semibold mt-6 tracking-tight">{stat.value}</h2>
              </div>
            </SlideIn>
          ))}
        </div>

        {/* Secondary Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Active Online Staff */}
          <div className="p-5 bg-(--color-surface) border border-(--color-border) rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted)">Staff Online</p>
              <h3 className="text-2xl font-semibold mt-2 text-(--color-text-primary)">{stats?.activeStaffOnline || 0}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <Users size={20} />
            </div>
          </div>

          {/* Pending Orders > 10 Min */}
          <div className={`p-5 bg-(--color-surface) border rounded-xl flex items-center justify-between shadow-sm transition-all ${stats?.pendingOrdersOver10Min > 0 ? 'border-danger/30' : 'border-(--color-border)'}`}>
            <div>
              <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted)">Orders Waiting &gt; 10 Mins</p>
              <h3 className={`text-2xl font-semibold mt-2 ${stats?.pendingOrdersOver10Min > 0 ? 'text-danger' : 'text-(--color-text-primary)'}`}>{stats?.pendingOrdersOver10Min || 0}</h3>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${stats?.pendingOrdersOver10Min > 0 ? 'bg-danger/10 text-danger border-danger/20' : 'bg-(--color-surface-soft) text-(--color-text-muted) border-(--color-border)'}`}>
              <Clock size={20} />
            </div>
          </div>

          {/* Branch Health Score */}
          <div className="p-5 bg-(--color-surface) border border-(--color-border) rounded-xl flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium tracking-normal text-(--color-text-muted)">Branch Health Score</p>
              <h3 className="text-2xl font-semibold mt-2 text-(--color-text-primary)">{stats?.branchHealthScore || 100}%</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center border border-success/20">
              <Heart size={20} />
            </div>
          </div>
        </div>
          </>
        )}

        {/* Alerts & Operational Logs */}
        <div className="bg-(--color-surface) border border-(--color-border) p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-(--color-text-primary) tracking-tight">Live Alerts</h3>
              <p className="text-[11px] font-medium text-(--color-text-muted) tracking-normal mt-1">Updated in real time</p>
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
                  className="p-4 bg-(--color-surface-soft) border border-(--color-border) rounded-xl flex items-center gap-4 hover:border-primary/20 transition-all font-medium text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-(--color-text-primary) font-semibold">{alert.title}</span>
                  <span className="text-(--color-text-secondary)">{alert.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {alerts.length === 0 && (
              <div className="text-xs font-medium text-(--color-text-muted) opacity-50 text-center py-6">No alerts right now.</div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
