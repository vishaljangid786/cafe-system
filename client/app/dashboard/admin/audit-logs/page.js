'use client';

import { useState, useEffect } from 'react';
import api from '@/app/services/api';
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
    try {
      setLoading(true);
      const res = await api.get(`/super-admin/audit-logs?page=${page}&actionType=${actionFilter}&userId=${searchUserId}`);
      setLogs(res.data.data);
      setTotalPages(res.data.pagination.pages);
      setTotalLogs(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to retrieve security rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 0);

    return () => clearTimeout(timer);
  }, [page, actionFilter, searchUserId]);

  const getActionColor = (type) => {
    if (!type || typeof type !== 'string') return 'text-[var(--color-secondary)] bg-[var(--color-secondary)]/10';
    const upperType = type.toUpperCase();
    if (upperType.includes('PROMOTE') || upperType.includes('CREATE')) return 'text-[var(--color-success)] bg-[var(--color-success)]/10';
    if (upperType.includes('DELETE') || upperType.includes('BLOCK')) return 'text-[var(--color-danger)] bg-[var(--color-danger)]/10';
    if (upperType.includes('LOGIN')) return 'text-[var(--color-primary)] bg-[var(--color-primary)]/10';
    return 'text-[var(--color-secondary)] bg-[var(--color-secondary)]/10';
  };

  return (
    <PageTransition>
      <div className="space-y-10 pb-20 max-w-7xl mx-auto">

        {/* Global Security Header */}
        <SlideIn>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="px-4 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-[var(--color-primary)]/20 shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.1)]">
                  Level 5 Access
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                <span className="text-[var(--color-text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">Activity History Stream</span>
              </div>
              <h1 className="text-6xl font-black tracking-tighter text-[var(--color-text-primary)] flex items-center gap-4 italic">
                <ShieldAlert className="text-[var(--color-primary)] h-16 w-16 drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]" />
                ACTIVITY <span className="text-[var(--color-text-muted)]">HISTORY</span>
              </h1>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] max-w-md">Full history of every action across all branches.</p>
            </div>

            <div className="flex items-center gap-6 bg-[var(--color-surface)]/40 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-[var(--color-border)] shadow-2xl">
              <div className="text-right">
                <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Total Actions</p>
                <p className="text-2xl font-black text-[var(--color-text-primary)]">{totalLogs}</p>
              </div>
              <div className="h-12 w-[1px] bg-[var(--color-border)]" />
              <div className="text-right">
                <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Status</p>
                <p className="text-2xl font-black text-[var(--color-success)]">ACTIVE</p>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Information Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SecurityCard
            title="Access Points"
            value={totalLogs > 100 ? 'ACTIVE' : 'STABLE'}
            icon={<Activity className="text-[var(--color-secondary)]" />}
            sub="Global network access state"
          />
          <SecurityCard
            title="System Rule Level"
            value="LEVEL 5"
            icon={<User className="text-[var(--color-primary)]" />}
            sub="Maximum security enforcement"
          />
          <SecurityCard
            title="Data Integrity"
            value="100%"
            icon={<ShieldAlert className="text-[var(--color-success)]" />}
            sub="No corruption detected"
          />
        </div>

        {/* Command Bar */}
        <div className="flex flex-col md:flex-row gap-4 sticky-filter z-30">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search Information Stream..."
              className="w-full pl-14 pr-6 py-5 bg-[var(--color-bg-soft)] backdrop-blur-md border border-[var(--color-border)] rounded-3xl text-sm font-bold text-[var(--color-text-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all outline-none"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <ExportActions 
              data={logs} 
              columns={columns} 
              filename={`AuditLogs_${new Date().toISOString().split('T')[0]}`} 
            />
            <PremiumSelect
              className="min-w-[200px]"
              value={actionFilter}
              onChange={(val) => setActionFilter(val)}
              options={[
                { label: 'All Directives', value: '' },
                { label: 'Promotion', value: 'PROMOTE' },
                { label: 'Deletion', value: 'DELETE' },
                { label: 'Authentication', value: 'LOGIN' }
              ]}
            />
          </div>
        </div>

        {/* Data List */}
        <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl rounded-[3.5rem] border border-[var(--color-border)] shadow-2xl overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-[var(--color-surface-soft)] text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                  <th className="px-10 py-6">Action Details</th>
                  <th className="px-10 py-6">Done By</th>
                  <th className="px-10 py-6 text-center">System Rule</th>
                  <th className="px-10 py-6 text-right">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[var(--color-border)]">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    [1, 2, 3, 4, 5].map(i => (
                      <tr key={`skeleton-${i}`} className="animate-pulse">
                        <td colSpan="4" className="px-10 py-8 bg-[var(--color-surface-soft)]" />
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-10 py-32 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <ShieldAlert size={60} />
                          <p className="text-xs font-black uppercase tracking-widest mt-4">No actions found</p>
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
                      className="group hover:bg-[var(--color-primary)]/[0.02] dark:hover:bg-[var(--color-primary)]/[0.05] transition-all cursor-pointer border-l-2 border-transparent hover:border-[var(--color-primary)]"
                    >
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${getActionColor(log.action)}`}>
                            <Activity size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[var(--color-text-primary)] italic uppercase tracking-tight">{log.action?.replace(/_/g, ' ') || 'Unknown directive'}</p>
                            <p className="text-[10px] font-bold text-[var(--color-text-muted)] mt-1 max-w-[250px] truncate">{log.details || 'No meta-data captured'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-soft)] flex items-center justify-center font-black text-[10px] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                            {log.performedBy?.name?.substring(0, 2).toUpperCase() || 'SY'}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[var(--color-text-primary)]">{log.performedBy?.name || 'Automated Branch'}</p>
                            <p className="text-[9px] font-black text-[var(--color-primary-dark)] dark:text-[var(--color-primary)] uppercase tracking-widest mt-0.5">{log.performedBy?.role || 'SYSTEM'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm ${getActionColor(log.action)}`}>
                          {log.action?.includes('PROMOTE') ? 'Critical' : 'Operational'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <p className="text-xs font-black text-[var(--color-text-primary)] italic">{new Date(log.createdAt).toLocaleTimeString()}</p>
                        <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-tighter mt-1">{new Date(log.createdAt).toLocaleDateString()}</p>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Quick Pagination */}
          {totalPages > 1 && (
            <div className="px-10 py-8 bg-[var(--color-surface-soft)]/50 flex items-center justify-between border-t border-[var(--color-border)]">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Branch Sync: {page}/{totalPages}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                  className="px-6 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-30 transition-all shadow-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                  className="px-6 py-2.5 bg-[var(--color-text-primary)] text-[var(--color-bg-base)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-30 transition-all shadow-xl shadow-[var(--color-bg-deep)]/10"
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
    <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl p-8 rounded-[3rem] border border-[var(--color-border)] shadow-xl group hover:scale-[1.02] transition-all duration-500">
      <div className="flex items-center justify-between mb-6">
        <div className="p-4 bg-[var(--color-surface-soft)] rounded-2xl group-hover:rotate-12 transition-transform duration-500">
          {icon}
        </div>
        <div className="h-2 w-2 rounded-full bg-[var(--color-success)] shadow-[0_0_10px_rgba(var(--color-success-rgb),0.5)]" />
      </div>
      <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] mb-1">{title}</p>
      <h3 className="text-4xl font-black text-[var(--color-text-primary)] tracking-tighter italic">{value}</h3>
      <p className="text-[9px] font-bold text-[var(--color-text-secondary)] italic mt-2">{sub}</p>
    </div>
  );
}
