'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import {
  Users, Search, Shield, ShieldAlert,
  ArrowRightLeft, UserCircle, LogOut, Filter
} from 'lucide-react';
import { PageTransition } from '@/app/components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '@/app/components/ui/Button';
import PremiumSelect from '@/app/components/ui/PremiumSelect';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { progress } from '@/app/components/ui/TopProgressBar';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  branch_admin: 'Branch Admin',
  location_admin: 'Location Admin',
  staff: 'Staff',
  chef: 'Chef',
};

export default function ImpersonatePage() {
  const router = useRouter();
  const { user, impersonate, exitImpersonation } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [impersonating, setImpersonating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      progress.start();
      const res = await api.get('/users', { params: { limit: 1000 } });
      let allUsers = res.data.data;

      // Hierarchical Filtering Logic
      let filtered = [];

      if (user?.role === 'super_admin') {
        // Super Admin can impersonate everyone except themselves
        filtered = allUsers.filter(u => u._id !== user?._id);
      } else if (user?.role === 'admin') {
        // Admin can impersonate everyone except Super Admins and themselves
        filtered = allUsers.filter(u => u.role !== 'super_admin' && u._id !== user?._id);
      } else if (user?.role === 'branch_admin' || user?.role === 'location_admin') {
        // Branch/Location Admin can only impersonate staff and chefs of their branch
        const branchIds = [
          user.assignedLocation?._id || user.assignedLocation,
          ...(user.accessibleLocations || []).map((loc) => loc._id || loc)
        ].filter(Boolean).map((id) => id.toString());
        filtered = allUsers.filter(u =>
          ['staff', 'chef'].includes(u.role) &&
          branchIds.includes((u.assignedLocation?._id || u.assignedLocation)?.toString())
        );
      }

      setUsers(filtered);
    } catch (err) {
      toast.error('Could not load users');
    } finally {
      setLoading(false);
      progress.done();
    }
  };

  useEffect(() => {
    if (user && !['super_admin', 'admin', 'branch_admin'].includes(user.role) && !user.permissions?.impersonateUsers && !user?.impersonatedBy) {
      toast.error('You do not have permission to log in as other users');
      router.push('/dashboard');
      return;
    }
    if (user) {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleImpersonate = async (userId, userName) => {
    try {
      setImpersonating(true);
      toast.loading(`Logging in as ${userName}...`, { id: 'impersonate' });
      const res = await impersonate(userId);
      if (res.success) {
        toast.success(`Logged in as: ${userName}`, { id: 'impersonate' });
      } else {
        toast.error(res.message || 'Could not log in as this user', { id: 'impersonate' });
      }
    } catch (err) {
      toast.error('Could not log in as this user', { id: 'impersonate' });
    } finally {
      setImpersonating(false);
    }
  };

  const handleExitImpersonation = async () => {
    try {
      setImpersonating(true);
      toast.loading('Switching back to your account...', { id: 'exit-impersonate' });
      const res = await exitImpersonation();
      if (res.success) {
        toast.success('Successfully switched back', { id: 'exit-impersonate' });
      } else {
        toast.error(res.message || 'Could not switch back', { id: 'exit-impersonate' });
      }
    } catch (err) {
      toast.error('Could not switch back to your account', { id: 'exit-impersonate' });
    } finally {
      setImpersonating(false);
    }
  };

  // Filter dropdown options derived from the users this person may impersonate.
  const roleOptions = useMemo(() => {
    const roles = [...new Set(users.map((u) => u.role))];
    return [{ label: 'All Roles', value: 'all' }, ...roles.map((r) => ({ label: ROLE_LABELS[r] || r, value: r }))];
  }, [users]);

  const branchOptions = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      const loc = u.assignedLocation;
      const id = (loc?._id || loc)?.toString();
      if (id && !map.has(id)) {
        map.set(id, loc?.name ? `${loc.name}${loc.city ? ' · ' + loc.city : ''}` : 'Branch');
      }
    });
    return [{ label: 'All Branches', value: 'all' }, ...[...map].map(([value, label]) => ({ label, value }))];
  }, [users]);

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Restricted', value: 'restricted' },
  ];

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter((u) => {
      const matchesSearch = !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? !u.isBlocked : !!u.isBlocked);
      const branchId = (u.assignedLocation?._id || u.assignedLocation)?.toString();
      const matchesBranch = branchFilter === 'all' || branchId === branchFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesBranch;
    });
  }, [users, searchTerm, roleFilter, statusFilter, branchFilter]);

  const activeFilterCount = [roleFilter, statusFilter, branchFilter].filter((v) => v !== 'all').length;
  const resetFilters = () => { setRoleFilter('all'); setStatusFilter('all'); setBranchFilter('all'); setSearchTerm(''); };

  const getSecurityLabel = () => {
    if (user?.isImpersonating) return 'Logged in as another user';
    if (user?.role === 'super_admin') return 'Role: Super Admin';
    if (user?.role === 'admin') return 'Role: Admin';
    if (user?.role === 'branch_admin') return 'Role: Branch Admin';
    return 'Role: Unknown';
  };

  if (loading && users.length === 0) return <LoadingScreen fullScreen={false} />;

  return (
    <PageTransition>
      <div className="space-y-8 pb-20">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 ${user?.isImpersonating ? 'bg-danger/10 text-danger border-danger/20' : 'bg-primary/10 text-primary border-primary/20'} text-[10px] font-bold uppercase tracking-normal rounded-full border `}>
                {getSecurityLabel()}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-(--color-text-muted)" />
              <span className="text-(--color-text-muted) text-[10px] font-bold uppercase tracking-normal">Log in as a user</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-(--color-text-primary) flex items-center gap-3 sm:gap-4">
              <ShieldAlert className={`${user?.isImpersonating ? 'text-danger' : 'text-primary'} h-9 w-9 sm:h-12 sm:w-12`} />
              Login As <span className="text-(--color-text-muted)">User</span>
            </h1>
            <p className="max-w-2xl text-sm font-medium text-(--color-text-muted) leading-relaxed">
              Login as any user to help them or check issues.
              {user?.role === 'branch_admin' && <span className="text-primary font-bold ml-1">You can only log in as staff from your own branch.</span>}
              <span className="text-danger font-bold ml-1">Exercise caution: all actions are logged.</span>
            </p>
          </div>

          {user?.isImpersonating && (
            <Button
              variant="danger"
              className="h-12 w-full md:w-auto px-6 !rounded-xl shadow-sm"
              icon={LogOut}
              onClick={handleExitImpersonation}
              disabled={impersonating}
            >
              Back to My Account
            </Button>
          )}
        </div>

        {/* Search + Filters */}
        <div className="card rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search by name, email or role..."
                className="w-full pl-11 pr-4 py-3 bg-(--color-surface-soft) border border-(--color-border) rounded-xl text-sm font-bold text-(--color-text-primary) focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-auto">
              <div className="sm:w-44">
                <PremiumSelect value={roleFilter} onChange={setRoleFilter} options={roleOptions} placeholder="Role" />
              </div>
              <div className="sm:w-44">
                <PremiumSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="Status" />
              </div>
              <div className="sm:w-52">
                <PremiumSelect value={branchFilter} onChange={setBranchFilter} options={branchOptions} placeholder="Branch" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-(--color-text-muted) flex items-center gap-2">
              <Filter size={13} />
              Showing {filteredUsers.length} of {users.length} {users.length === 1 ? 'user' : 'users'}
            </span>
            {(activeFilterCount > 0 || searchTerm) && (
              <button onClick={resetFilters} className="text-xs font-bold text-primary hover:underline">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <div className="card rounded-xl py-20 text-center space-y-4">
            <Users className="mx-auto h-16 w-16 text-(--color-text-muted)/30" />
            <p className="text-sm font-bold text-(--color-text-muted)">No users match your filters</p>
          </div>
        ) : (
          <div className="card rounded-xl overflow-hidden">
            <div className="responsive-table-container">
              <table className="w-full min-w-200 text-left border-separate border-spacing-0">
                <thead>
                  <tr className="bg-(--color-surface-soft) text-xs font-semibold text-(--color-text-muted)">
                    <th className="px-6 py-3.5">Member</th>
                    <th className="px-6 py-3.5">Role</th>
                    <th className="px-6 py-3.5">Branch</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--color-border)">
                  {filteredUsers.map((u, idx) => (
                    <motion.tr
                      key={u._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.025, 0.3) }}
                      className="group hover:bg-(--color-surface-soft) transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-lg bg-(--color-surface-soft) border border-(--color-border) flex items-center justify-center overflow-hidden relative shrink-0">
                            {u.profileImageUrl ? (
                              <img src={u.profileImageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <UserCircle size={22} className="text-primary" />
                            )}
                            <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-(--color-surface) ${!u.isBlocked ? 'bg-success' : 'bg-danger'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-(--color-text-primary) truncate">{u.name}</div>
                            <div className="text-xs text-(--color-text-muted) truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="chip bg-primary/10 text-primary border border-primary/20 capitalize">
                          {ROLE_LABELS[u.role] || u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-(--color-text-secondary)">
                          {u.assignedLocation?.name || '—'}
                          {u.assignedLocation?.city && <span className="text-(--color-text-muted)"> · {u.assignedLocation.city}</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${u.isBlocked ? 'text-danger' : 'text-success'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.isBlocked ? 'bg-danger' : 'bg-success'}`} />
                          {u.isBlocked ? 'Restricted' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="primary"
                          className="!rounded-lg h-10 px-5 text-xs whitespace-nowrap"
                          icon={ArrowRightLeft}
                          onClick={() => handleImpersonate(u._id, u.name)}
                          disabled={impersonating || u.isBlocked}
                        >
                          Login As
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
