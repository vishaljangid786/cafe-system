'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, X, Loader2, Search, UserCheck } from 'lucide-react';
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
  const { user: currentUser } = useAuth();
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
      let roleFilter = '';
      
      if (currentUser?.role === 'super_admin') {
        roleFilter = 'admin';
      } else if (currentUser?.role === 'admin') {
        roleFilter = 'branch_admin'; // Simplification: admin manages branch_admins
      } else if (currentUser?.role === 'branch_admin') {
        roleFilter = 'staff'; // Simplification: branch_admin manages staff
      }

      const res = await api.get(`/users?role=${roleFilter}`);
      setSubordinates(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch subordinates:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSubordinates();
    }
  }, [currentUser]);

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
    sub.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2 text-[var(--color-text-primary)]">
            <Shield className="text-amber-500" size={28} />
            Authority Management
          </h2>
          <p className="text-[var(--color-text-muted)] text-sm font-medium">Assign operational gates to your direct subordinates.</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl text-sm font-bold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-amber-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl border border-[var(--color-border)]">
          <p className="text-[var(--color-text-muted)] font-bold">No subordinates found for your role.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] shadow-sm">
          <table className="w-full text-left border-collapse bg-[var(--color-bg-soft)]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-zinc-50 dark:bg-zinc-900/50">
                <th className="p-4 text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">User</th>
                <th className="p-4 text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Role</th>
                <th className="p-4 text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Permissions Active</th>
                <th className="p-4 text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((sub) => {
                const activeCount = Object.values(sub.permissions || {}).filter(Boolean).length;
                return (
                  <tr key={sub._id} className="border-b border-[var(--color-border)] hover:bg-zinc-100/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-lg">
                        {sub.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--color-text-primary)]">{sub.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{sub.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md bg-zinc-200 dark:bg-zinc-800 text-[var(--color-text-muted)]">
                        {sub.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                        <UserCheck size={16} className={activeCount > 0 ? "text-emerald-500" : "text-zinc-400"} />
                        {activeCount} / {permissionList.length}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleEditClick(sub)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Manage Permissions for ${selectedUser?.name}`}
      >
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-xs font-bold italic">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {permissionList.map(({ key, label }) => {
              const isChecked = editedPermissions[key] || false;
              // Check if superior has this permission (if not Super Admin)
              const superiorHasPermission = currentUser?.role === 'super_admin' || (currentUser?.permissions && currentUser.permissions[key]);
              
              return (
                <div 
                  key={key}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                    isChecked 
                      ? 'border-amber-500 bg-amber-500/5' 
                      : 'border-[var(--color-border)] hover:border-zinc-300 dark:hover:border-zinc-700'
                  } ${!superiorHasPermission ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">{label}</span>
                    {!superiorHasPermission && (
                      <span className="text-[10px] text-rose-500 italic">You don't have this permission</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePermissionToggle(key)}
                    disabled={!superiorHasPermission}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                      isChecked 
                        ? 'bg-amber-500 border-amber-500 text-black' 
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-amber-500'
                    }`}
                  >
                    {isChecked && <Check size={14} strokeWidth={3} />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 bg-[var(--color-bg-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-bold text-xs rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
