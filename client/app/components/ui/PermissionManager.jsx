'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, X, Search, ShieldCheck, Plus, Trash2, Pencil, Layers } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

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
  // Page-access permissions (unlock normally role-locked pages)
  { key: 'manageBranches', label: 'Open Branches Page' },
  { key: 'viewAuditLogs', label: 'Open Security Logs' },
  { key: 'impersonateUsers', label: 'Login As Users' },
  { key: 'viewAdminCenter', label: 'Open Admin Center' },
  { key: 'manageGlobalMenu', label: 'Manage Global Menu' },
  { key: 'sendGlobalNotifications', label: 'Send Global Notifications' },
];

const ROLE_FILTERS = [
  { label: 'All Roles', value: 'all' },
  { label: 'Admin', value: 'admin' },
  { label: 'Branch Admin', value: 'branch_admin' },
  { label: 'Chef', value: 'chef' },
  { label: 'Staff', value: 'staff' },
];

const emptyPerms = () => permissionList.reduce((acc, { key }) => ({ ...acc, [key]: false }), {});

export default function PermissionManager({ className = "" }) {
  const { user: currentUser, selectedLocation } = useAuth();
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editedPermissions, setEditedPermissions] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Saved roles (permission presets)
  const [presets, setPresets] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [roleName, setRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState(emptyPerms());
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState('');

  // A non-super-admin can only grant permissions they themselves hold.
  const actorCanGrant = (key) => currentUser?.role === 'super_admin' || !!currentUser?.permissions?.[key];

  const fetchSubordinates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      const allUsers = res.data.data || [];

      let filtered = [];
      const selectedBranchId = selectedLocation?._id || selectedLocation;
      const allowedBranchIds = selectedBranchId
        ? [selectedBranchId]
        : [
            currentUser?.assignedLocation?._id || currentUser?.assignedLocation,
            ...(currentUser?.accessibleLocations || []).map((loc) => loc._id || loc)
          ].filter(Boolean);
      const allowedBranchSet = new Set(allowedBranchIds.map((id) => id.toString()));

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
          allowedBranchSet.has((u.assignedLocation?._id || u.assignedLocation)?.toString())
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

  const fetchPresets = async () => {
    try {
      const res = await api.get('/permission-presets');
      setPresets(res.data.data || []);
    } catch (err) {
      console.error('Failed to load roles');
    }
  };

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        fetchSubordinates();
        fetchPresets();
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

  // Fill the toggles from a saved role, but only for permissions the current
  // user is actually allowed to grant (so the save never hits a 403).
  const applyPresetToEdit = (presetId) => {
    if (!presetId) return;
    const preset = presets.find(p => p._id === presetId);
    if (!preset) return;
    const next = {};
    permissionList.forEach(({ key }) => {
      next[key] = !!preset.permissions?.[key] && actorCanGrant(key);
    });
    setEditedPermissions(next);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await api.put(`/users/${selectedUser._id}/permissions`, {
        permissions: editedPermissions
      });
      toast.success('Permissions updated');
      setIsModalOpen(false);
      fetchSubordinates(); // Refresh list
    } catch (err) {
      console.error('Failed to update permissions:', err);
      setError(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // ---- Saved role (preset) management ----
  const openCreateRole = () => {
    setEditingPreset(null);
    setRoleName('');
    setRolePerms(emptyPerms());
    setRoleError('');
    setShowRoleModal(true);
  };

  const openEditRole = (preset) => {
    setEditingPreset(preset);
    setRoleName(preset.name);
    setRolePerms({ ...emptyPerms(), ...preset.permissions });
    setRoleError('');
    setShowRoleModal(true);
  };

  const toggleRolePerm = (key) => {
    if (!actorCanGrant(key)) return;
    setRolePerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      setRoleError('Please enter a role name');
      return;
    }
    try {
      setSavingRole(true);
      setRoleError('');
      if (editingPreset) {
        await api.put(`/permission-presets/${editingPreset._id}`, { name: roleName.trim(), permissions: rolePerms });
        toast.success('Role updated');
      } else {
        await api.post('/permission-presets', { name: roleName.trim(), permissions: rolePerms });
        toast.success('Role created');
      }
      setShowRoleModal(false);
      fetchPresets();
    } catch (err) {
      setRoleError(err.response?.data?.message || 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (preset) => {
    if (!confirm(`Delete role "${preset.name}"? This will not change any user who already has these permissions.`)) return;
    try {
      await api.delete(`/permission-presets/${preset._id}`);
      toast.success('Role deleted');
      fetchPresets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete role');
    }
  };

  const canModifyPreset = (preset) =>
    currentUser?.role === 'super_admin' || preset.createdBy === currentUser?._id;

  const filteredUsers = subordinates.filter(sub => {
    const matchesSearch =
      sub.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.role?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || sub.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading && subordinates.length === 0) {
    return (
      <div className="flex items-center justify-center p-20">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <ShieldCheck className="text-[var(--color-primary)] h-7 w-7" />
            Staff Permissions
          </h1>
          <p className="max-w-2xl text-sm text-[var(--color-text-muted)] leading-relaxed">
            Choose what each team member is allowed to do, or build reusable roles you can apply in one click.
            {currentUser?.role === 'branch_admin' && <span className="text-[var(--color-primary)] font-medium ml-1">Branch staff only.</span>}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreateRole} className="w-full md:w-auto">
          Create Role
        </Button>
      </div>

      {/* Saved Roles (presets) */}
      <div className="card rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Saved Roles</h2>
          <span className="text-xs text-[var(--color-text-muted)]">({presets.length})</span>
        </div>
        {presets.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            No roles yet. Click <span className="font-semibold text-[var(--color-text-primary)]">Create Role</span> to make a reusable set of permissions you can apply to any team member.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((preset) => {
              const count = Object.values(preset.permissions || {}).filter(Boolean).length;
              const editable = canModifyPreset(preset);
              return (
                <div key={preset._id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{preset.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{count} permission{count === 1 ? '' : 's'}</p>
                    {preset.createdByName && (
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">by {preset.createdByName}</p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditRole(preset)} title="Edit role" className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteRole(preset)} title="Delete role" className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/40 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative group flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by name, email or role..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input sm:w-56 appearance-none cursor-pointer"
        >
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
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

      {/* Edit user permissions */}
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

          {presets.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-muted)]">Apply a saved role</label>
              <select
                defaultValue=""
                onChange={(e) => { applyPresetToEdit(e.target.value); e.target.value = ''; }}
                className="input appearance-none cursor-pointer"
              >
                <option value="" disabled>Choose a role to fill the permissions below…</option>
                {presets.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {permissionList.map(({ key, label }) => {
              const isChecked = editedPermissions[key] || false;
              const superiorHasPermission = actorCanGrant(key);

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

      {/* Create / edit role (preset) */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingPreset ? 'Edit Role' : 'Create Role'}
      >
        <div className="space-y-6">
          {roleError && (
            <div className="p-3 bg-[rgba(var(--color-danger-rgb),0.1)] text-[var(--color-danger)] border border-[rgba(var(--color-danger-rgb),0.2)] rounded-lg text-sm font-medium text-center">
              {roleError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Role Name</label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Senior Staff"
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Permissions in this role</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissionList.map(({ key, label }) => {
                const isChecked = rolePerms[key] || false;
                const allowed = actorCanGrant(key);
                return (
                  <div
                    key={key}
                    onClick={() => toggleRolePerm(key)}
                    className={`p-4 rounded-lg border transition-colors flex items-center justify-between cursor-pointer group/item ${
                      isChecked
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-soft)]'
                    } ${!allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
                      {!allowed && (
                        <span className="text-xs text-[var(--color-danger)] flex items-center gap-1">
                          <X size={10} /> You don't have this
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
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-[var(--color-border)]">
            <Button variant="outline" onClick={() => setShowRoleModal(false)} className="order-2 sm:order-1">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRole}
              loading={savingRole}
              icon={editingPreset ? Pencil : Plus}
              className="order-1 sm:order-2"
            >
              {editingPreset ? 'Save Role' : 'Create Role'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
