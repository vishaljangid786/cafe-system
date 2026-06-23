'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/app/services/api';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';
import { TableSkeleton } from '@/app/components/ui/Skeleton';
import { useAuth } from '@/app/context/AuthContext';
import {
  ShieldAlert, Activity, User, Clock,
  Search, Filter, ChevronRight,
  Download, Calendar, AlertCircle
} from 'lucide-react';
import { PageTransition, SlideIn } from '@/app/components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import ExportActions from '@/app/components/ui/ExportActions';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const didInitRef = useRef(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  
  const columns = [
    { header: 'Action', key: 'action' },
    { header: 'Done By', key: 'performedBy.name' },
    { header: 'Role', key: 'performedBy.role' },
    { header: 'Details', key: 'details' },
    { header: 'Time', key: (log) => new Date(log.createdAt).toLocaleString() }
  ];

  const fetchLogs = async () => {
    const isInitial = !didInitRef.current;
    if (isInitial) setLoading(true);
    else setRefetching(true);
    progress.start();
    try {
      const res = await api.get(`/super-admin/audit-logs?page=${page}&actionType=${actionFilter}&userId=${searchUserId}`);
      setLogs(res.data.data);
      setTotalPages(res.data.pagination.pages);
      setTotalLogs(res.data.pagination.total);
    } catch (err) {
      toast.error('Could not load activity history. Please try again.');
    } finally {
      didInitRef.current = true;
      setLoading(false);
      setRefetching(false);
      progress.done();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 0);

    return () => clearTimeout(timer);
  }, [page, actionFilter, searchUserId]);

  const getActionColor = (type) => {
    if (!type || typeof type !== 'string') return 'text-secondary bg-secondary/10';
    const upperType = type.toUpperCase();
    if (upperType.includes('PROMOTE') || upperType.includes('CREATE')) return 'text-success bg-success/10';
    if (upperType.includes('DELETE') || upperType.includes('BLOCK')) return 'text-danger bg-danger/10';
    if (upperType.includes('LOGIN')) return 'text-primary bg-primary/10';
    return 'text-secondary bg-secondary/10';
  };

  if (loading) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-10 pb-20 max-w-7xl mx-auto">

        {/* Global Security Header */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-normal rounded-full border border-primary/20 ">
                  Admin Only
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-(--color-text-muted) text-[10px] font-bold uppercase tracking-normal">Activity History</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-(--color-text-primary) flex items-center gap-4">
                <ShieldAlert className="text-primary h-12 w-12 shrink-0 drop-shadow-sm" />
                ACTIVITY <span className="text-primary">HISTORY</span>
              </h1>
              <p className="text-sm font-medium text-(--color-text-secondary) max-w-md">A full record of every action across all branches.</p>
            </div>

            <div className="flex items-center gap-6 bg-(--color-surface)/40  p-6 rounded-xl border border-(--color-border) shadow-sm">
              <div className="text-right">
                <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Total Actions</p>
                <p className="text-2xl font-bold text-(--color-text-primary)">{totalLogs}</p>
              </div>
              <div className="h-12 w-[1px] bg-(--color-border)" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">Status</p>
                <p className="text-2xl font-bold text-success">ACTIVE</p>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Information Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SecurityCard
            title="Activity"
            value={totalLogs > 100 ? 'HIGH' : 'NORMAL'}
            icon={<Activity className="text-secondary" />}
            sub="Activity level across all branches"
          />
          <SecurityCard
            title="Access Level"
            value="ADMIN"
            icon={<User className="text-primary" />}
            sub="Only admins can view this page"
          />
          <SecurityCard
            title="Records"
            value="100%"
            icon={<ShieldAlert className="text-success" />}
            sub="All records are saved"
          />
        </div>

        {/* Command Bar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 sticky-filter z-30">
          <div className="relative flex-1 min-w-0 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Filter by user ID..."
              aria-label="Filter audit logs by user ID"
              className="w-full pl-12 pr-5 py-3.5 bg-(--color-bg-soft) border border-(--color-border) rounded-xl text-sm font-bold text-(--color-text-primary) focus:ring-4 focus:ring-primary/10 transition-all outline-none"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PremiumSelect
              className="min-w-45 flex-1 sm:flex-none"
              value={actionFilter}
              onChange={(val) => setActionFilter(val)}
              options={[
                { label: 'All Actions', value: '' },
                { label: 'Promotion', value: 'PROMOTE' },
                { label: 'Deletion', value: 'DELETE' },
                { label: 'Login', value: 'LOGIN' }
              ]}
            />
            <ExportActions
              data={logs}
              columns={columns}
              filename={`AuditLogs_${new Date().toISOString().split('T')[0]}`}
            />
          </div>
        </div>

        {/* Data List */}
        <div className="bg-(--color-surface)/40  rounded-xl border border-(--color-border) shadow-sm overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-(--color-surface-soft) text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">
                  <th className="px-10 py-6">Action Details</th>
                  <th className="px-10 py-6">Done By</th>
                  <th className="px-10 py-6 text-center">Type</th>
                  <th className="px-10 py-6 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y border-(--color-border)">
                <AnimatePresence mode="popLayout">
                  {refetching ? (
                    <tr>
                      <td colSpan="4" className="px-10 py-8">
                        <TableSkeleton rows={6} cols={4} />
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-10 py-32 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <ShieldAlert size={60} />
                          <p className="text-xs font-bold uppercase tracking-normal mt-4">No activity found</p>
                        </div>
                      </td>
                    </tr>
                  ) : logs.map((log, idx) => (
                    <motion.tr
                      key={log._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group hover:bg-primary/[0.02] dark:hover:bg-primary/[0.05] transition-all cursor-pointer border-l-2 border-transparent hover:border-primary"
                    >
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg transition-transform ${getActionColor(log.action)}`}>
                            <Activity size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-(--color-text-primary) italic uppercase tracking-tight">{log.action?.replace(/_/g, ' ') || 'Unknown action'}</p>
                            <p className="text-[10px] font-bold text-(--color-text-muted) mt-1 max-w-[250px] truncate">{log.details || 'No details'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-(--color-surface-soft) flex items-center justify-center font-bold text-[10px] text-(--color-text-muted) border border-(--color-border)">
                            {log.performedBy?.name?.substring(0, 2).toUpperCase() || 'SY'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-(--color-text-primary)">{log.performedBy?.name || 'System'}</p>
                            <p className="text-[9px] font-bold text-primary-dark dark:text-primary uppercase tracking-normal mt-0.5">{log.performedBy?.role || 'SYSTEM'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-normal border shadow-sm ${getActionColor(log.action)}`}>
                          {log.action?.includes('PROMOTE') ? 'Critical' : 'Operational'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <p className="text-xs font-bold text-(--color-text-primary) italic">{new Date(log.createdAt).toLocaleTimeString()}</p>
                        <p className="text-[9px] font-bold text-(--color-text-muted) uppercase tracking-tight mt-1">{new Date(log.createdAt).toLocaleDateString()}</p>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Quick Pagination */}
          {totalPages > 1 && (
            <div className="px-10 py-8 bg-(--color-surface-soft)/50 flex items-center justify-between border-t border-(--color-border)">
              <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Page {page} of {totalPages}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-6 py-2.5 bg-(--color-surface) border border-(--color-border) rounded-xl text-[10px] font-bold uppercase tracking-normal  active:scale-95 disabled:opacity-30 transition-all shadow-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-6 py-2.5 bg-(--color-text-primary) text-(--color-bg-base) rounded-xl text-[10px] font-bold uppercase tracking-normal  active:scale-95 disabled:opacity-30 transition-all shadow-sm "
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function SecurityCard({ title, value, icon, sub }) {
  return (
    <div className="bg-(--color-surface)/40  p-8 rounded-xl border border-(--color-border) shadow-sm group  transition-all duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="p-4 bg-(--color-surface-soft) rounded-xl group-hover:rotate-12 transition-transform duration-500">
          {icon}
        </div>
        <div className="h-2 w-2 rounded-full bg-success " />
      </div>
      <p className="text-[10px] font-bold text-(--color-text-muted) uppercase tracking-normal mb-1">{title}</p>
      <h3 className="text-4xl font-bold text-(--color-text-primary) tracking-tight italic">{value}</h3>
      <p className="text-[9px] font-bold text-(--color-text-secondary) italic mt-2">{sub}</p>
    </div>
  );
}
