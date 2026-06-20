'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, X, Search, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { Button } from './Button';
import { Spinner } from './Spinner';
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
      <div className="flex items-center justify-center p-20">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <div className={`space-y-10 ${className}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <ShieldCheck className="text-[var(--color-primary)] h-7 w-7" />
            Staff Permissions
          </h1>
          <p className="max-w-2xl text-sm text-[var(--color-text-muted)] leading-relaxed">
            Choose what each team member is allowed to do.
            {currentUser?.role === 'branch_admin' && <span className="text-[var(--color-primary)] font-medium ml-1">Branch staff only.</span>}
          </p>
        </div>

        <div className="relative group w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by name, email or role..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="card rounded-xl p-16 text-center space-y-4">
          <Shield className="mx-auto h-14 w-14 text-[var(--color-text-muted)]/40" />
          <p className="text-[var(--color-text-muted)]">No team members to manage here yet.</p>
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full min-w-[800px] text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-[var(--color-surface-soft)] text-xs font-semibold text-[var(--color-text-muted)]">
                  <th className="px-6 py-3">Staff Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-center">Active Permissions</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredUsers.map((sub, idx) => {
                  const activeCount = Object.values(sub.permissions || {}).filter(Boolean).length;
                  return (
                    <motion.tr
                      key={sub._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="group hover:bg-[var(--color-surface-soft)] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-lg bg-[var(--color-surface-soft)] border border-[var(--color-border)] flex items-center justify-center font-semibold text-base text-[var(--color-primary)]">
                            {sub.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text-primary)]">{sub.name}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{sub.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="chip bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-secondary)] capitalize">
                          {sub.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${activeCount > 0 ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"}`} />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {activeCount} <span className="text-[var(--color-text-muted)] text-xs">/ {permissionList.length} set</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditClick(sub)}
                          className="px-4 py-2 bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] hover:border-[var(--color-primary)] font-medium text-sm rounded-lg transition-colors cursor-pointer"
                        >
                          Edit
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
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)] border border-[rgba(var(--color-danger-rgb),0.2)] rounded-lg text-sm font-medium text-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {permissionList.map(({ key, label }) => {
              const isChecked = editedPermissions[key] || false;
              const superiorHasPermission = currentUser?.role === 'super_admin' || (currentUser?.permissions && currentUser.permissions[key]);

              return (
                <div
                  key={key}
                  onClick={() => superiorHasPermission && handlePermissionToggle(key)}
                  className={`p-4 rounded-lg border transition-colors flex items-center justify-between cursor-pointer group/item ${
                    isChecked
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-soft)]'
                  } ${!superiorHasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
                    {!superiorHasPermission && (
                      <span className="text-xs text-[var(--color-danger)] flex items-center gap-1">
                        <X size={10} /> Not allowed
                      </span>
                    )}
                  </div>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                    isChecked
                      ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-on-primary)]'
                      : 'border-[var(--color-border-strong)] group-hover/item:border-[var(--color-primary)]'
                  }`}>
                    {isChecked && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-[var(--color-border)]">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="order-2 sm:order-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              icon={ShieldCheck}
              className="order-1 sm:order-2"
            >
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
