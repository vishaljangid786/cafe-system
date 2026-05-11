'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, X, Loader2, Search, UserCheck, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { motion } from 'framer-motion';

const permissionList = [
  { key: 'viewRevenue', label: 'View Revenue' },
  { key: 'editRevenue', label: 'Edit Revenue' },
  { key: 'viewOrders', label: 'View Orders' },
  { key: 'manageOrders', label: 'Manage Orders' },
  { key: 'forceComplete', label: 'Force Complete' },
  { key: 'exportReports', label: 'Export Reports' },
  { key: 'manageStaff', label: 'Manage Staff' },
  { key: 'manageNotifications', label: 'Manage Notifications' },
  { key: 'viewAnalytics', label: 'View Analytics' },
  { key: 'manageCoupons', label: 'Manage Coupons' },
];

export default function PermissionManager({ className = "" }) {
  const { user: currentUser, selectedLocation } = useAuth();
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editedPermissions, setEditedPermissions] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSubordinates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      const allUsers = res.data.data || [];

      let filtered = [];
      const currentBranchId = selectedLocation?._id || currentUser?.assignedLocation?._id || currentUser?.assignedLocation;

      if (currentUser?.role === 'super_admin') {
        // Super Admin can manage everyone except themselves
        filtered = allUsers.filter(u => u._id !== currentUser?._id);
      } else if (currentUser?.role === 'admin') {
        // Admin can manage branch_admins, chefs, and staff
        const allowedRoles = ['branch_admin', 'chef', 'staff'];
        filtered = allUsers.filter(u => allowedRoles.includes(u.role));
      } else if (currentUser?.role === 'branch_admin') {
        // Branch Admin can manage chefs and staff in their branch
        const allowedRoles = ['chef', 'staff'];
        filtered = allUsers.filter(u => 
          allowedRoles.includes(u.role) && 
          (u.assignedLocation?._id === currentBranchId || u.assignedLocation === currentBranchId)
        );
      }

      setSubordinates(filtered);
    } catch (err) {
      console.error('Failed to fetch subordinates:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        fetchSubordinates();
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [currentUser, selectedLocation]);

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditedPermissions(user.permissions || {});
    setIsModalOpen(true);
    setError('');
  };

  const handlePermissionToggle = (key) => {
    setEditedPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await api.put(`/users/${selectedUser._id}/permissions`, {
        permissions: editedPermissions
      });
      setIsModalOpen(false);
      fetchSubordinates(); // Refresh list
    } catch (err) {
      console.error('Failed to update permissions:', err);
      setError(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = subordinates.filter(sub => 
    sub.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && subordinates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-primary)] animate-pulse">Establishing Secure Link</p>
      </div>
    );
  }

  return (
    <div className={`space-y-10 ${className}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="px-4 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-[var(--color-primary)]/20 shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.1)]">
              System: STAFF_PERMISSIONS
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
            <span className="text-[var(--color-text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">Operational Permission Control</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-[var(--color-text-primary)] flex items-center gap-3 sm:gap-4 italic uppercase">
            <ShieldCheck className="text-[var(--color-primary)] h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16 drop-shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]" />
            Staff <span className="text-[var(--color-text-muted)] not-italic">Permissions</span>
          </h1>
          <p className="max-w-2xl text-sm font-medium text-[var(--color-text-muted)] leading-relaxed">
            Assign specific operational permissions to your subordinates. 
            {currentUser?.role === 'branch_admin' && <span className="text-primary font-bold ml-1 italic">Allowed for branch staff only.</span>}
          </p>
        </div>

        <div className="relative group w-full md:w-80">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search by name, email or role..."
            className="w-full pl-14 pr-6 py-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[2rem] text-sm font-bold text-[var(--color-text-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl rounded-[3.5rem] border border-[var(--color-border)] p-20 text-center space-y-6">
          <Shield className="mx-auto h-16 w-16 text-[var(--color-text-muted)]/30" />
          <p className="text-[var(--color-text-muted)] font-black uppercase tracking-widest italic">No manageable subordinates identified in the current sector.</p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)]/40 backdrop-blur-2xl rounded-[3.5rem] border border-[var(--color-border)] shadow-2xl overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full min-w-[800px] text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-[var(--color-surface-soft)] text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                  <th className="px-10 py-6">Staff Member</th>
                  <th className="px-10 py-6">Staff Level</th>
                  <th className="px-10 py-6 text-center">Active Permissions</th>
                  <th className="px-10 py-6 text-right">Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[var(--color-border)]">
                {filteredUsers.map((sub, idx) => {
                  const activeCount = Object.values(sub.permissions || {}).filter(Boolean).length;
                  return (
                    <motion.tr 
                      key={sub._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group hover:bg-[var(--color-primary)]/[0.02] transition-all"
                    >
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center font-black text-xl text-[var(--color-primary)] shadow-lg group-hover:scale-110 transition-transform">
                            {sub.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-base font-black text-[var(--color-text-primary)] italic tracking-tight">{sub.name}</div>
                            <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">{sub.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <span className="px-4 py-1.5 rounded-full bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[9px] font-black uppercase tracking-widest text-[var(--color-text-secondary)]">
                          {sub.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center justify-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full ${activeCount > 0 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-[var(--color-text-muted)]"}`} />
                          <span className="text-sm font-black text-[var(--color-text-primary)]">
                            {activeCount} <span className="text-[var(--color-text-muted)] text-[10px] uppercase font-bold tracking-widest">/ {permissionList.length} Permissions Set</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <button
                          onClick={() => handleEditClick(sub)}
                          className="px-6 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-[var(--color-primary)]/20"
                        >
                          Change Permissions
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Permission Settings: ${selectedUser?.name}`}
      >
        <div className="space-y-8">
          {error && (
            <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl text-xs font-bold italic text-center animate-pulse">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {permissionList.map(({ key, label }) => {
              const isChecked = editedPermissions[key] || false;
              const superiorHasPermission = currentUser?.role === 'super_admin' || (currentUser?.permissions && currentUser.permissions[key]);
              
              return (
                <div 
                  key={key}
                  onClick={() => superiorHasPermission && handlePermissionToggle(key)}
                  className={`p-5 rounded-[2rem] border transition-all flex items-center justify-between cursor-pointer group/item ${
                    isChecked 
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.03] shadow-[0_10px_20px_rgba(var(--color-primary-rgb),0.05)]' 
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-soft)]'
                  } ${!superiorHasPermission ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-[var(--color-text-primary)] italic uppercase tracking-tight">{label}</span>
                    {!superiorHasPermission && (
                      <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest italic flex items-center gap-1">
                        <X size={8} /> Permission Denied
                      </span>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all ${
                    isChecked 
                      ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30' 
                      : 'border-[var(--color-border)] group-hover/item:border-[var(--color-primary)]/50'
                  }`}>
                    {isChecked && <Check size={18} strokeWidth={4} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-[var(--color-border)]">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-8 py-4 bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-[var(--color-border)] transition-all cursor-pointer order-2 sm:order-1"
            >
              Abort Mission
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-4 bg-[var(--color-primary)] hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-2xl shadow-[var(--color-primary)]/30 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 order-1 sm:order-2 min-w-[180px]"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : (
                <>
                  <ShieldCheck size={16} />
                  Save Permissions
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
