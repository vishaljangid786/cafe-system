'use client';

import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Activity, Search, Shield, User, Clock, Info, ShieldAlert, ChevronRight, Filter } from 'lucide-react';
import { PageTransition, SlideIn } from '../../../components/ui/AnimatedContainer';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [searchUserId, setSearchUserId] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/super-admin/audit-logs?page=${page}&actionType=${actionFilter}&userId=${searchUserId}`);
      setLogs(res.data.data);
      setPages(res.data.pagination.pages);
    } catch (err) {
      toast.error('Failed to retrieve security protocols');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, searchUserId]);

  const getActionColor = (type) => {
    if (type.includes('PROMOTE') || type.includes('CREATE')) return 'text-emerald-500 bg-emerald-500/10';
    if (type.includes('DELETE') || type.includes('BLOCK')) return 'text-rose-500 bg-rose-500/10';
    if (type.includes('LOGIN')) return 'text-amber-500 bg-amber-500/10';
    return 'text-blue-500 bg-blue-500/10';
  };

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">
        {/* Security Header */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-amber-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-1000">
            <ShieldAlert size={200} className="text-amber-500" strokeWidth={1} />
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                  <Activity size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white leading-none">Security Audit Logs</h1>
                  <p className="text-zinc-500 font-bold mt-1 text-sm">Real-time surveillance of administrative interventions.</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <select 
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-zinc-500 focus:ring-0 cursor-pointer"
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Protocols</option>
                <option value="USER_PROMOTE">Promotion</option>
                <option value="USER_DEMOTE">Demotion</option>
                <option value="USER_BLOCK">Blocklist</option>
                <option value="ORDER_CANCEL">Cancellations</option>
                <option value="COUPON_CREATE">Coupons</option>
                <option value="LOCATION_DELETE">Branch Deletion</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search & Filter Matrix */}
        <div className="flex flex-col md:flex-row gap-4 sticky-filter">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search by Investigator ID (User ID)..."
              className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold text-sm text-zinc-900 dark:text-zinc-100 shadow-sm"
              value={searchUserId}
              onChange={(e) => { setSearchUserId(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full stack-table-mobile">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Timestamp</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Investigator</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Protocol</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Intervention Details</th>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Network Vector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                <AnimatePresence mode="wait">
                  {loading ? (
                    [1,2,3,4,5].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-8 py-6 h-16 bg-zinc-50/50 dark:bg-zinc-900/20" />
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center text-zinc-500 font-bold italic">No security events detected in current matrix.</td>
                    </tr>
                  ) : (
                    logs.map((log, idx) => (
                      <motion.tr 
                        key={log._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        <td className="px-8 py-5" data-label="Timestamp">
                          <div className="flex items-center gap-3">
                            <Clock size={14} className="text-zinc-400" />
                            <div className="space-y-0.5">
                              <p className="text-xs font-black text-zinc-900 dark:text-zinc-100">{new Date(log.createdAt).toLocaleDateString()}</p>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase">{new Date(log.createdAt).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5" data-label="Investigator">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 font-black text-[10px]">
                              {log.user?.name?.substring(0, 2).toUpperCase() || 'SYS'}
                            </div>
                            <div>
                              <p className="text-xs font-black text-zinc-900 dark:text-zinc-100">{log.user?.name || 'Automated System'}</p>
                              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">{log.user?.role?.replace('_', ' ') || 'Process'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5" data-label="Protocol">
                          <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-current transition-colors ${getActionColor(log.actionType)}`}>
                            {log.actionType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-8 py-5" data-label="Intervention">
                          <div className="max-w-xs">
                            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 leading-relaxed">{log.description}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5" data-label="Network Vector">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-500 tracking-tighter font-mono">{log.metadata?.ip || '0.0.0.0'}</p>
                            <p className="text-[8px] font-medium text-zinc-400 line-clamp-1">{log.metadata?.userAgent || 'Core/Kernel'}</p>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Console */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-10">
            <button
              disabled={page === 1}
              onClick={() => setPage(prev => prev - 1)}
              className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:border-amber-500/50 hover:text-amber-500 transition-all shadow-sm"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 px-6 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm font-black tracking-widest text-[10px]">
              <span className="text-zinc-900 dark:text-white">{page}</span>
              <span className="text-zinc-400">/ {pages}</span>
            </div>
            <button
              disabled={page === pages}
              onClick={() => setPage(prev => prev + 1)}
              className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 disabled:opacity-20 hover:border-amber-500/50 hover:text-amber-500 transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
