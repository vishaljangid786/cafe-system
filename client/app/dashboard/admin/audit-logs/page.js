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
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalLogs(res.data.pagination?.total || 0);
    } catch (err) {
      console.error('Could not load activity history. Please try again.');
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
      <div className="space-y-6 pb-10 max-w-7xl mx-auto">

        {/* Header */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide rounded-full border border-primary/15">
                  Admin Only
                </span>
                <span className="text-(--color-text-muted) text-[11px] font-medium">Activity History</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-(--color-text-primary) flex items-center gap-2.5">
                <ShieldAlert className="text-primary h-6 w-6 shrink-0" />
                Activity History
              </h1>
              <p className="text-sm text-(--color-text-muted) max-w-md">A full record of every action across all branches.</p>
            </div>

            <div className="flex items-center gap-5 bg-(--color-surface) px-5 py-3.5 rounded-xl border border-(--color-border)">
              <div>
                <p className="text-[11px] font-medium text-(--color-text-muted) mb-0.5">Total Actions</p>
                <p className="text-xl font-semibold text-(--color-text-primary)">{totalLogs}</p>
              </div>
              <div className="h-9 w-px bg-(--color-border)" />
              <div>
                <p className="text-[11px] font-medium text-(--color-text-muted) mb-0.5">Status</p>
                <p className="text-xl font-semibold text-success">Active</p>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Information Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SecurityCard
            title="Activity"
            value={totalLogs > 100 ? 'High' : 'Normal'}
            icon={<Activity size={18} className="text-secondary" />}
            sub="Activity level across all branches"
          />
          <SecurityCard
            title="Access Level"
            value="Admin"
            icon={<User size={18} className="text-primary" />}
            sub="Only admins can view this page"
          />
          <SecurityCard
            title="Records"
            value="100%"
            icon={<ShieldAlert size={18} className="text-success" />}
            sub="All records are saved"
          />
        </div>

        {/* Command Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sticky-filter z-30">
          <div className="relative flex-1 min-w-0 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filter by user ID..."
              aria-label="Filter audit logs by user ID"
              className="w-full pl-10 pr-4 py-2.5 bg-(--color-bg-soft) border border-(--color-border) rounded-xl text-sm font-medium text-(--color-text-primary) focus:ring-2 focus:ring-primary/15 focus:border-primary transition outline-none"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:shrink-0">
            <PremiumSelect
              className="flex-1 sm:flex-none sm:w-48"
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
        <div className="bg-(--color-surface) rounded-xl border border-(--color-border) shadow-sm overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-(--color-surface-soft) text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
                  <th className="px-5 py-3.5">Action Details</th>
                  <th className="px-5 py-3.5">Done By</th>
                  <th className="px-5 py-3.5 text-center">Type</th>
                  <th className="px-5 py-3.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                <AnimatePresence mode="popLayout">
                  {refetching ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-6">
                        <TableSkeleton rows={6} cols={4} />
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-24 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <ShieldAlert size={44} />
                          <p className="text-xs font-medium mt-3">No activity found</p>
                        </div>
                      </td>
                    </tr>
                  ) : logs.map((log, idx) => (
                    <motion.tr
                      key={log._id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group hover:bg-primary/3 transition-colors border-l-2 border-transparent hover:border-primary"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${getActionColor(log.action)}`}>
                            <Activity size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-(--color-text-primary) truncate">{log.action?.replace(/_/g, ' ') || 'Unknown action'}</p>
                            <p className="text-xs text-(--color-text-muted) mt-0.5 max-w-62.5 truncate">{log.details || 'No details'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-(--color-surface-soft) flex items-center justify-center font-semibold text-[11px] text-(--color-text-muted) border border-(--color-border) shrink-0">
                            {log.performedBy?.name?.substring(0, 2).toUpperCase() || 'SY'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-(--color-text-primary) truncate">{log.performedBy?.name || 'System'}</p>
                            <p className="text-[10px] font-medium text-(--color-text-muted) uppercase tracking-wide mt-0.5">{log.performedBy?.role || 'SYSTEM'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${getActionColor(log.action)}`}>
                          {log.action?.includes('PROMOTE') ? 'Critical' : 'Operational'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="text-xs font-medium text-(--color-text-primary)">{new Date(log.createdAt).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-(--color-text-muted) mt-0.5">{new Date(log.createdAt).toLocaleDateString()}</p>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Quick Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-4 bg-(--color-surface-soft)/50 flex items-center justify-between border-t border-(--color-border)">
              <p className="text-xs font-medium text-(--color-text-muted)">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-(--color-surface) border border-(--color-border) rounded-lg text-xs font-semibold active:scale-95 disabled:opacity-30 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-(--color-text-primary) text-(--color-bg-base) rounded-lg text-xs font-semibold active:scale-95 disabled:opacity-30 transition-all"
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
    <div className="bg-(--color-surface) p-5 rounded-xl border border-(--color-border) transition-colors hover:border-(--color-border-strong)">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-(--color-surface-soft) rounded-lg">
          {icon}
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-success" />
      </div>
      <p className="text-[11px] font-medium text-(--color-text-muted) mb-1">{title}</p>
      <h3 className="text-2xl font-semibold text-(--color-text-primary) tracking-tight">{value}</h3>
      <p className="text-xs text-(--color-text-muted) mt-1">{sub}</p>
    </div>
  );
}
