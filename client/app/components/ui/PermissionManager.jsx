'use client';

import { useState, useEffect } from 'react';
import { Shield, Check, X, Search, ShieldCheck, Plus, Trash2, Pencil, Layers } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import useConfirm from './useConfirm';
import { Button } from './Button';
import { Spinner } from './Spinner';
import PremiumSelect from './PremiumSelect';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ROLE_DEFAULT_PAGES } from '../../config/pages';
import { ACTIONS_BY_PAGE, ALL_ACTION_KEYS, can as canAct } from '../../config/actions';
import PageAccessEditor from './PageAccessEditor';

// Page access is edited page-by-page (PAGE_GROUPS -> allowedPages). What's left
// here are CAPABILITIES — non-page abilities.
const permissionList = [
  { key: 'viewRevenue', label: 'View Revenue' },
  { key: 'editRevenue', label: 'Edit Revenue (not just view)' },
  { key: 'viewOrders', label: 'View Orders' },
  { key: 'manageOrders', label: 'Manage Orders' },
  { key: 'forceComplete', label: 'Force-Complete Orders' },
  { key: 'exportReports', label: 'Export Reports' },
  { key: 'manageStaff', label: 'Manage Staff' },
  { key: 'manageNotifications', label: 'Manage Notifications' },
  { key: 'viewAnalytics', label: 'View Analytics' },
  { key: 'manageCoupons', label: 'Manage Offers / Coupons' },
  { key: 'manageBranches', label: 'Manage Branches' },
  { key: 'viewAuditLogs', label: 'View Security Logs' },
  { key: 'impersonateUsers', label: 'Login As Staff' },
  { key: 'viewAdminCenter', label: 'View Admin Center' },
  { key: 'manageGlobalMenu', label: 'Manage Global Menu' },
  { key: 'sendGlobalNotifications', label: 'Send Global Notifications' },
  { key: 'sendMessages', label: 'Send Messages' },
  { key: 'messageSuperAdmin', label: 'Message Super Admin' },
];

// Default CAPABILITIES per role (mirrors add-member). Page defaults come from
// ROLE_DEFAULT_PAGES. Used by the "Reset to role defaults" button.
const ROLE_DEFAULT_CAPS = {
  admin: {
    viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
    forceComplete: true, exportReports: true, manageStaff: true,
    manageNotifications: true, viewAnalytics: true, manageCoupons: true,
    sendMessages: true, messageSuperAdmin: true,
  },
  branch_admin: {
    viewRevenue: true, editRevenue: true, viewOrders: true, manageOrders: true,
    forceComplete: true, exportReports: true, manageStaff: true,
    viewAnalytics: true, sendMessages: true,
  },
  location_admin: {
    viewRevenue: true, viewOrders: true, manageOrders: true, exportReports: true,
    viewAnalytics: true, sendMessages: true,
  },
  staff: { viewOrders: true, manageOrders: true, sendMessages: true },
  chef: { viewOrders: true, manageOrders: true, sendMessages: true },
};

const ROLE_FILTERS = [
  { label: 'All Roles', value: 'all' },
  { label: 'Admin', value: 'admin' },
  { label: 'Branch Admin', value: 'branch_admin' },
  { label: 'Location Admin', value: 'location_admin' },
  { label: 'Chef', value: 'chef' },
  { label: 'Staff', value: 'staff' },
];

const emptyPerms = () => permissionList.reduce((acc, { key }) => ({ ...acc, [key]: false }), {});

export default function PermissionManager({ className = "" }) {
  const { confirm, confirmDialog } = useConfirm();
  const { user: currentUser, selectedLocation } = useAuth();
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editedPermissions, setEditedPermissions] = useState({});
  const [editedPages, setEditedPages] = useState([]); // allowedPages being edited
  const [editedActions, setEditedActions] = useState([]); // actionPermissions keys being edited
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
        // Admin can manage branch/location admins, chefs, and staff
        const allowedRoles = ['branch_admin', 'location_admin', 'chef', 'staff'];
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
    const perms = user.permissions || {};
    // sendMessages is ON unless explicitly turned off, so show it checked for
    // accounts that pre-date the field rather than misleadingly unchecked.
    setEditedPermissions({ ...perms, sendMessages: perms.sendMessages !== false });
    setEditedPages(Array.isArray(user.allowedPages) ? [...user.allowedPages] : []);
    const ap = user.actionPermissions || {};
    setEditedActions(Object.keys(ap).filter((k) => ap[k] === true));
    setIsModalOpen(true);
    setError('');
  };

  const handlePermissionToggle = (key) => {
    setEditedPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // You can only grant page access you yourself hold (super_admin grants anything).
  const actorCanGrantPage = (pageKey) =>
    currentUser?.role === 'super_admin' || (currentUser?.allowedPages || []).includes(pageKey);

  const handlePageToggle = (pageKey) => {
    if (!actorCanGrantPage(pageKey)) return;
    const has = editedPages.includes(pageKey);
    if (has) {
      const scope = ACTIONS_BY_PAGE[pageKey];
      setEditedPages(prev => prev.filter(k => k !== pageKey));
      if (scope) setEditedActions(acts => acts.filter(k => !k.startsWith(`${scope.scope}.`)));
    } else {
      setEditedPages(prev => [...prev, pageKey]);
    }
  };

  // You can only grant an action you can perform yourself (super_admin grants any).
  const actorCanGrantAction = (actionKey) => canAct(currentUser, actionKey);
  const handleActionToggle = (actionKey) => {
    if (!actorCanGrantAction(actionKey)) return;
    setEditedActions(prev =>
      prev.includes(actionKey) ? prev.filter(k => k !== actionKey) : [...prev, actionKey]
    );
  };

  // Reset this user's access to their ROLE's defaults (the same set Add-Member would
  // pre-select for that role) — pages + capabilities, gated to what you can grant.
  const resetToRoleDefaults = () => {
    if (!selectedUser) return;
    const role = selectedUser.role;
    setEditedPages((ROLE_DEFAULT_PAGES[role] || []).filter(actorCanGrantPage));
    // Role defaults carry no granular action grants — they're per-user extras.
    setEditedActions([]);
    const caps = ROLE_DEFAULT_CAPS[role] || {};
    setEditedPermissions(prev => {
      const next = { ...prev };
      permissionList.forEach(({ key }) => {
        if (actorCanGrant(key)) next[key] = !!caps[key];
      });
      return next;
    });
    toast.success('Reset to role defaults');
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
      // Never send a permission the actor isn't allowed to grant — otherwise a
      // pre-existing (or preset-applied) flag the actor lacks could be persisted.
      const safePermissions = {};
      Object.keys(editedPermissions).forEach((key) => {
        if (actorCanGrant(key)) safePermissions[key] = editedPermissions[key];
      });
      // Only send pages the actor can grant (server re-validates too).
      const safePages = editedPages.filter(actorCanGrantPage);
      // Send an explicit true/false for EVERY action key the actor can grant (so
      // un-ticking actually revokes — the server merges by key). Keys the actor
      // can't grant are omitted, leaving the user's existing grant untouched.
      const SCOPE_TO_PAGE = Object.values(ACTIONS_BY_PAGE).reduce((o, s) => { o[s.scope] = s.pageKey; return o; }, {});
      const safeActions = {};
      ALL_ACTION_KEYS.forEach((key) => {
        if (!actorCanGrantAction(key)) return;
        const pageKey = SCOPE_TO_PAGE[key.split('.')[0]];
        const pageGranted = pageKey ? safePages.includes(pageKey) : true;
        safeActions[key] = editedActions.includes(key) && pageGranted;
      });
      if (safePages.length === 0 && !Object.values(safePermissions).some(Boolean) && !Object.values(safeActions).some(Boolean)) {
        setError('Select at least one page access or permission. Zero-access members are not allowed.');
        setSaving(false);
        return;
      }
      await api.put(`/users/${selectedUser._id}/permissions`, {
        permissions: safePermissions,
        allowedPages: safePages,
        actionPermissions: safeActions,
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
    if (!(await confirm({ title: 'Delete role?', message: `Delete role "${preset.name}"? This will not change any user who already has these permissions.`, confirmText: 'Delete' }))) return;
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
          <h1 className="text-2xl font-bold tracking-tight text-(--color-text-primary) flex items-center gap-3">
            <ShieldCheck className="text-primary h-7 w-7" />
            Staff Permissions
          </h1>
          <p className="max-w-2xl text-sm text-(--color-text-muted) leading-relaxed">
            Choose what each team member is allowed to do, or build reusable roles you can apply in one click.
            {currentUser?.role === 'branch_admin' && <span className="text-primary font-medium ml-1">Branch staff only.</span>}
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreateRole} className="w-full md:w-auto">
          Create Role
        </Button>
      </div>

      {/* Saved Roles (presets) */}
      <div className="card rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-(--color-text-primary)">Saved Roles</h2>
          <span className="text-xs text-(--color-text-muted)">({presets.length})</span>
        </div>
        {presets.length === 0 ? (
          <p className="text-sm text-(--color-text-muted)">
            No roles yet. Click <span className="font-semibold text-(--color-text-primary)">Create Role</span> to make a reusable set of permissions you can apply to any team member.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((preset) => {
              const count = Object.values(preset.permissions || {}).filter(Boolean).length;
              const editable = canModifyPreset(preset);
              return (
                <div key={preset._id} className="rounded-xl border border-(--color-border) bg-(--color-surface-soft) p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-(--color-text-primary) truncate">{preset.name}</p>
                    <p className="text-xs text-(--color-text-muted) mt-0.5">{count} permission{count === 1 ? '' : 's'}</p>
                    {preset.createdByName && (
                      <p className="text-[10px] text-(--color-text-muted) mt-1">by {preset.createdByName}</p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEditRole(preset)} title="Edit role" className="p-2 rounded-lg border border-(--color-border) text-(--color-text-muted) hover:text-primary hover:border-primary/40 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDeleteRole(preset)} title="Delete role" className="p-2 rounded-lg border border-(--color-border) text-(--color-text-muted) hover:text-danger hover:border-danger/40 transition-colors">
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-muted) group-focus-within:text-primary transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by name, email or role..."
            className="input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="sm:w-56 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-normal text-(--color-text-muted) ml-1">
            Filter by type
          </label>
          <PremiumSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={ROLE_FILTERS}
          />
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="card rounded-xl p-16 text-center space-y-4">
          <Shield className="mx-auto h-14 w-14 text-(--color-text-muted)/40" />
          <p className="text-(--color-text-muted)">No team members to manage here yet.</p>
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <div className="responsive-table-container">
            <table className="w-full min-w-200 text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-(--color-surface-soft) text-xs font-semibold text-(--color-text-muted)">
                  <th className="px-6 py-3">Staff Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3 text-center">Active Access</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-border)">
                {filteredUsers.map((sub, idx) => {
                  const activeCount = Object.values(sub.permissions || {}).filter(Boolean).length + (sub.allowedPages || []).length;
                  return (
                    <motion.tr
                      key={sub._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="group hover:bg-(--color-surface-soft) transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-lg bg-(--color-surface-soft) border border-(--color-border) flex items-center justify-center font-semibold text-base text-primary">
                            {sub.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-(--color-text-primary)">{sub.name}</div>
                            <div className="text-xs text-(--color-text-muted)">{sub.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="chip bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-secondary) capitalize">
                          {sub.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${activeCount > 0 ? "bg-success" : "bg-(--color-text-muted)"}`} />
                          <span className="text-sm font-medium text-(--color-text-primary)">
                            {activeCount} <span className="text-(--color-text-muted) text-xs">access item{activeCount === 1 ? '' : 's'} set</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditClick(sub)}
                          className="px-4 py-2 bg-(--color-surface-soft) border border-(--color-border) text-(--color-text-primary) hover:bg-primary hover:text-(--color-on-primary) hover:border-primary font-medium text-sm rounded-lg transition-colors cursor-pointer"
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
            <div className="p-3 bg-[rgba(var(--color-danger-rgb),0.1)] text-danger border border-[rgba(var(--color-danger-rgb),0.2)] rounded-lg text-sm font-medium text-center">
              {error}
            </div>
          )}

          {presets.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-(--color-text-muted)">Apply a saved role</label>
              <PremiumSelect
                value=""
                onChange={(v) => { if (v) applyPresetToEdit(v); }}
                options={presets.map((p) => ({ label: p.name, value: p._id }))}
                placeholder="Choose a role to fill the permissions below…"
              />
            </div>
          )}

          {/* Page Access + per-page actions (Add / Modify / Delete / Approve). */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted)">Page Access &amp; Actions</span>
            <button type="button" onClick={resetToRoleDefaults} className="text-[11px] font-bold text-primary hover:underline">
              Reset to role defaults
            </button>
          </div>
          <PageAccessEditor
            selectedPages={editedPages}
            onTogglePage={handlePageToggle}
            canGrantPage={actorCanGrantPage}
            selectedActions={editedActions}
            onToggleAction={handleActionToggle}
            canGrantAction={actorCanGrantAction}
          />

          <span className="text-xs font-bold uppercase tracking-normal text-(--color-text-muted) block pt-2">Permissions</span>
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
                      ? 'border-primary bg-(--color-primary-soft)'
                      : 'border-(--color-border) hover:border-(--color-border-strong) hover:bg-(--color-surface-soft)'
                  } ${!superiorHasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-(--color-text-primary)">{label}</span>
                    {!superiorHasPermission && (
                      <span className="text-xs text-danger flex items-center gap-1">
                        <X size={10} /> Not allowed
                      </span>
                    )}
                  </div>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                    isChecked
                      ? 'bg-primary border-primary text-(--color-on-primary)'
                      : 'border-(--color-border-strong) group-hover/item:border-primary'
                  }`}>
                    {isChecked && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-(--color-border)">
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
            <div className="p-3 bg-[rgba(var(--color-danger-rgb),0.1)] text-danger border border-[rgba(var(--color-danger-rgb),0.2)] rounded-lg text-sm font-medium text-center">
              {roleError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-(--color-text-muted)">Role Name</label>
            <input
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="e.g. Senior Staff"
              className="input"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-(--color-text-muted)">Permissions in this role</label>
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
                        ? 'border-primary bg-(--color-primary-soft)'
                        : 'border-(--color-border) hover:border-(--color-border-strong) hover:bg-(--color-surface-soft)'
                    } ${!allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-(--color-text-primary)">{label}</span>
                      {!allowed && (
                        <span className="text-xs text-danger flex items-center gap-1">
                          <X size={10} /> You don&apos;t have this
                        </span>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${
                      isChecked
                        ? 'bg-primary border-primary text-(--color-on-primary)'
                        : 'border-(--color-border-strong) group-hover/item:border-primary'
                    }`}>
                      {isChecked && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-(--color-border)">
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
      {confirmDialog}
    </div>
  );
}

