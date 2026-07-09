'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Filter, UserCheck, Calendar, MapPin, Mail, Phone,
  Users, ChefHat, User, Shield, CreditCard, Layers, ArrowUpRight, Hash
} from 'lucide-react';
import api from '../../../services/api';
import PremiumSelect from '../../../components/ui/PremiumSelect';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { Money } from '@/app/components/ui/Money';
const ROLE_META = {
  all: { label: 'All People', icon: Users },
  staff: { label: 'Staff', icon: Users },
  chef: { label: 'Chefs', icon: ChefHat },
  branch_admin: { label: 'Branch Admins', icon: User },
  admin: { label: 'Main Admins', icon: Shield },
};

const DATE_PRESETS = [
  { label: 'All time', value: 'all' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

const roleLabel = (role) => {
  if (role === 'branch_admin' || role === 'location_admin') return 'Branch Admin';
  if (role === 'admin') return 'Main Admin';
  if (role === 'chef') return 'Chef';
  return 'Staff';
};

const branchText = (member) => {
  const accessible = Array.isArray(member?.accessibleLocations) ? member.accessibleLocations : [];
  if (member?.role === 'branch_admin' && accessible.length > 1) {
    return `${accessible.length} Branches`;
  }
  if (member?.assignedLocation) {
    const loc = member.assignedLocation;
    return `${loc.city ? loc.city + ' - ' : ''}${loc.name || ''}`.trim() || 'Assigned';
  }
  return 'Not Assigned';
};

/**
 * Slide-in drawer that lists people (staff / chefs / branch admins / all) for the
 * dashboard "Staff & Payroll" cards. Opening a card pre-selects that role; the user
 * can then switch role, status, search, and filter by JOIN DATE (incl. a custom range).
 *
 * `roleKey` controls both visibility (truthy = open) and the initial role.
 */
export default function PeopleDrawer({ roleKey, onClose, currentUserRole, locationId = '', staffHref }) {
  const isOpen = !!roleKey;
  const router = useRouter();

  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all | 7d | 30d | custom
  const [customDates, setCustomDates] = useState({ start: '', end: '' });

  const [people, setPeople] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // Monotonic request id so a slow earlier response can't overwrite a newer one.
  const reqSeqRef = useRef(0);

  // When the drawer opens from a specific card, adopt that role and reset filters.
  useEffect(() => {
    if (roleKey) {
      setRole(roleKey);
      setStatus('');
      setSearch('');
      setDateFilter('all');
      setCustomDates({ start: '', end: '' });
    }
  }, [roleKey]);

  // Esc to close + lock background scroll while open (mirrors Modal behaviour).
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const fetchPeople = useCallback(async () => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role && role !== 'all') params.append('role', role);
      if (status) params.append('status', status);
      if (search.trim()) params.append('search', search.trim());
      if (locationId) params.append('locationId', locationId);

      // Join-date window
      const now = new Date();
      let start = '';
      let end = '';
      if (dateFilter === 'custom') {
        start = customDates.start;
        end = customDates.end;
      } else if (dateFilter !== 'all') {
        const d = new Date();
        if (dateFilter === '7d') d.setDate(now.getDate() - 7);
        else if (dateFilter === '30d') d.setMonth(now.getMonth() - 1);
        start = d.toISOString().split('T')[0];
        end = now.toISOString().split('T')[0];
      }
      if (start) params.append('joinedStart', start);
      if (end) params.append('joinedEnd', end);
      params.append('limit', '100');

      const res = await api.get(`/users?${params.toString()}`);
      if (seq !== reqSeqRef.current) return; // a newer request superseded this one
      setPeople(res.data?.data || []);
      setTotal(res.data?.pagination?.total ?? res.data?.data?.length ?? 0);
    } catch (error) {
      if (seq !== reqSeqRef.current) return;
      console.error('Could not load the list. Please try again.');
      setPeople([]);
      setTotal(0);
    } finally {
      if (seq === reqSeqRef.current) setLoading(false);
    }
  }, [role, status, search, dateFilter, customDates, locationId]);

  // Debounced fetch on any filter change (covers the search input keystrokes).
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(fetchPeople, 250);
    return () => clearTimeout(t);
  }, [isOpen, fetchPeople]);

  const HeaderIcon = (ROLE_META[role] || ROLE_META.all).icon;
  const customInvalid = dateFilter === 'custom' && customDates.start && customDates.end
    && customDates.start > customDates.end;

  const roleOptions = [
    { label: 'All People', value: 'all' },
    ...(currentUserRole === 'super_admin' ? [{ label: 'Main Admin', value: 'admin' }] : []),
    { label: 'Branch Admins', value: 'branch_admin' },
    { label: 'Staff', value: 'staff' },
    { label: 'Chef', value: 'chef' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-9998"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed top-0 right-0 h-full w-full max-w-xl z-9999 bg-(--color-surface) border-l border-(--color-border) shadow-(--shadow-md) flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-(--color-border) flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <HeaderIcon size={22} />
                </div>
                <div>
                  <p className="text-lg font-bold text-(--color-text-primary) leading-none">
                    {(ROLE_META[role] || ROLE_META.all).label}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) mt-1.5">
                    {loading ? 'Loading…' : `${total} ${total === 1 ? 'person' : 'people'}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-lg bg-(--color-surface-soft) border border-(--color-border) flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text-primary) hover:border-(--color-border-strong) transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-(--color-border) shrink-0 space-y-3 bg-(--color-surface-soft)/30">
              {/* Search */}
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3 text-(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Search by name, email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-(--color-bg-soft) border border-(--color-border) focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-medium outline-none transition-all text-(--color-text-primary)"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 text-(--color-text-muted) hover:text-danger transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Role + Status */}
              <div className="flex flex-col sm:flex-row gap-3">
                <PremiumSelect
                  icon={Filter}
                  value={role}
                  onChange={setRole}
                  options={roleOptions}
                  className="flex-1"
                />
                <PremiumSelect
                  icon={UserCheck}
                  value={status}
                  onChange={setStatus}
                  options={[
                    { label: 'All Status', value: '' },
                    { label: 'Active', value: 'active' },
                    { label: 'Blocked', value: 'blocked' },
                  ]}
                  className="flex-1"
                />
              </div>

              {/* Join-date presets */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={13} className="text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted)">Joined</span>
                </div>
                <div className="flex items-center gap-2 bg-(--color-bg-soft) p-1.5 rounded-xl border border-(--color-border) overflow-x-auto no-scrollbar">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setDateFilter(p.value)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-normal rounded-lg transition-all whitespace-nowrap ${dateFilter === p.value
                        ? 'bg-primary text-(--color-on-primary) shadow-sm'
                        : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-surface)'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {dateFilter === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-(--color-text-muted) mb-1.5 ml-1">From</label>
                      <input
                        type="date"
                        value={customDates.start}
                        max={customDates.end || undefined}
                        onChange={(e) => setCustomDates((c) => ({ ...c, start: e.target.value }))}
                        className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-2.5 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-(--color-text-muted) mb-1.5 ml-1">To</label>
                      <input
                        type="date"
                        value={customDates.end}
                        min={customDates.start || undefined}
                        onChange={(e) => setCustomDates((c) => ({ ...c, end: e.target.value }))}
                        className="w-full bg-(--color-bg-soft) border border-(--color-border) rounded-xl p-2.5 text-xs font-bold text-(--color-text-primary) outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {customInvalid && (
                      <p className="col-span-2 text-[10px] font-bold text-danger ml-1">Start date must be on or before end date.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {loading && people.length === 0 ? (
                <LoadingScreen fullScreen={false} />
              ) : people.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-(--color-text-muted)">
                  <Users size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-normal">No people found</p>
                  <p className="text-xs mt-1 italic opacity-70">Try adjusting the filters above.</p>
                </div>
              ) : (
                people.map((member, idx) => (
                  <motion.div
                    key={member._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    className="p-4 rounded-xl bg-(--color-surface-soft)/50 border border-(--color-border) hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 font-bold">
                          {member.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-(--color-text-primary) truncate">{member.name}</p>
                          <div className="flex items-center flex-wrap gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-normal">
                              {roleLabel(member.role)}
                            </span>
                            {member.isBlocked && (
                              <span className="px-2 py-0.5 rounded-full bg-danger/10 text-danger text-[9px] font-bold uppercase tracking-normal">
                                Blocked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {member.monthlySalary != null && (
                        <div className="text-right shrink-0">
                          <p className="text-[8px] font-bold uppercase text-(--color-text-muted) tracking-normal">Salary</p>
                          <p className="text-sm font-bold text-(--color-text-primary)"><Money value={Number(member.monthlySalary)} /></p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-medium text-(--color-text-muted)">
                      {member.email && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail size={12} className="text-primary shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-primary shrink-0" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={12} className="text-primary shrink-0" />
                        <span className="truncate">{branchText(member)}</span>
                      </div>
                      {member.createdAt && (
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-primary shrink-0" />
                          <span>Joined {new Date(member.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {staffHref && (
              <div className="px-6 py-4 border-t border-(--color-border) shrink-0">
                <button
                  onClick={() => { onClose(); router.push(staffHref); }}
                  className="w-full py-3 rounded-xl bg-(--color-text-primary) text-(--color-surface) text-[11px] font-bold uppercase tracking-normal flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                >
                  Open Full Staff Directory
                  <ArrowUpRight size={15} />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
