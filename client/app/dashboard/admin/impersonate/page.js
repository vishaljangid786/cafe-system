'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import { 
  Users, Search, Shield, ShieldAlert, 
  ArrowRightLeft, UserCircle, LogOut 
} from 'lucide-react';
import { PageTransition } from '@/app/components/ui/AnimatedContainer';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '@/app/components/ui/Button';

export default function ImpersonatePage() {
  const router = useRouter();
  const { user, impersonate, exitImpersonation } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [impersonating, setImpersonating] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      let allUsers = res.data.data;

      // Hierarchical Filtering Logic
      let filtered = [];
      
      if (user?.role === 'super_admin') {
        // Super Admin can impersonate everyone except themselves
        filtered = allUsers.filter(u => u._id !== user?._id);
      } else if (user?.role === 'admin') {
        // Admin can impersonate everyone except Super Admins and themselves
        filtered = allUsers.filter(u => u.role !== 'super_admin' && u._id !== user?._id);
      } else if (user?.role === 'branch_admin') {
        // Branch Admin can only impersonate staff and chefs of their branch
        filtered = allUsers.filter(u => 
          ['staff', 'chef'].includes(u.role) && 
          u.assignedLocation?._id === (user.assignedLocation?._id || user.assignedLocation)
        );
      }

      setUsers(filtered);
    } catch (err) {
      toast.error('Failed to sync user database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !['super_admin', 'admin', 'branch_admin'].includes(user.role) && !user?.impersonatedBy) {
      toast.error('Access Denied: Insufficient clearance for identity management');
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
      toast.loading(`Establishing session as ${userName}...`, { id: 'impersonate' });
      const res = await impersonate(userId);
      if (res.success) {
        toast.success(`Identity assumed: ${userName}`, { id: 'impersonate' });
      } else {
        toast.error(res.message || 'Impersonation sequence failed', { id: 'impersonate' });
      }
    } catch (err) {
      toast.error('Critical failure in identity swap', { id: 'impersonate' });
    } finally {
      setImpersonating(false);
    }
  };

  const handleExitImpersonation = async () => {
    try {
      setImpersonating(true);
      toast.loading('Restoring original identity...', { id: 'exit-impersonate' });
      const res = await exitImpersonation();
      if (res.success) {
        toast.success('Original identity restored', { id: 'exit-impersonate' });
      } else {
        toast.error(res.message || 'Failed to restore identity', { id: 'exit-impersonate' });
      }
    } catch (err) {
      toast.error('Critical failure in identity restoration', { id: 'exit-impersonate' });
    } finally {
      setImpersonating(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSecurityLabel = () => {
    if (user?.isImpersonating) return 'ACTIVE SESSION: IMPERSONATING';
    if (user?.role === 'super_admin') return 'Security Level: SUPER ADMIN';
    if (user?.role === 'admin') return 'Security Level: ADMIN';
    if (user?.role === 'branch_admin') return 'Security Level: BRANCH MANAGER';
    return 'Security Level: UNKNOWN';
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-primary)] animate-pulse">Syncing Identities</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-10 pb-20">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-1.5 ${user?.isImpersonating ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'} text-[10px] font-black uppercase tracking-[0.2em] rounded-full border shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.1)]`}>
                {getSecurityLabel()}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              <span className="text-[var(--color-text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">Identity Management</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-[var(--color-text-primary)] flex items-center gap-3 sm:gap-4 italic uppercase">
              <ShieldAlert className={`${user?.isImpersonating ? 'text-[var(--color-danger)]' : 'text-[var(--color-primary)]'} h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16 drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]`} />
              Impersonate <span className="text-[var(--color-text-muted)] not-italic">Center</span>
            </h1>
            <p className="max-w-2xl text-sm font-medium text-[var(--color-text-muted)] leading-relaxed">
              Assume the identity of staff members to debug issues or assist with operations. 
              {user?.role === 'branch_admin' && <span className="text-primary font-bold ml-1">Limited to your current branch personnel.</span>}
              <span className="text-[var(--color-danger)] font-bold ml-1 italic">Exercise caution: all actions are logged.</span>
            </p>
          </div>

          {user?.isImpersonating && (
            <Button 
              variant="danger" 
              className="h-12 sm:h-16 w-full md:w-auto px-6 sm:px-10 !rounded-3xl shadow-2xl shadow-[var(--color-danger)]/20"
              icon={LogOut}
              onClick={handleExitImpersonation}
              disabled={impersonating}
            >
              Exit Impersonation
            </Button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative group max-w-2xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search by name, email or role..."
            className="w-full pl-14 pr-6 py-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[2rem] text-sm font-bold text-[var(--color-text-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Identity Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((u, idx) => (
            <motion.div
              key={u._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group relative overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[2.5rem] p-6 hover:shadow-2xl transition-all duration-500"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center relative group-hover:scale-110 transition-transform overflow-hidden shadow-lg">
                  {u.profileImageUrl ? (
                    <img src={u.profileImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle size={32} className="text-[var(--color-primary)]" />
                  )}
                  <div className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface)] ${!u.isBlocked ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-[var(--color-text-primary)] truncate italic uppercase tracking-tighter">{u.name}</h3>
                  <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest truncate">{u.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Role</span>
                  <div className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {u.role.replace('_', ' ')}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Status</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${u.isBlocked ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                    {u.isBlocked ? 'Restricted' : 'Active'}
                  </span>
                </div>

                {u.assignedLocation && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Branch</span>
                    <span className="text-[9px] font-black text-primary uppercase truncate max-w-[150px]">
                      {u.assignedLocation.name || 'Assigned'}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-8">
                <Button 
                  variant="primary" 
                  className="w-full !rounded-2xl h-12 shadow-lg shadow-[var(--color-primary)]/20 group-hover:bg-black group-hover:text-primary transition-colors"
                  icon={ArrowRightLeft}
                  onClick={() => handleImpersonate(u._id, u.name)}
                  disabled={impersonating || u.isBlocked}
                >
                  Assume Identity
                </Button>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <Shield size={120} />
              </div>
            </motion.div>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <Users className="mx-auto h-16 w-16 text-[var(--color-text-muted)]/30" />
            <p className="text-sm font-bold text-[var(--color-text-muted)]">No identities found matching your criteria</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
