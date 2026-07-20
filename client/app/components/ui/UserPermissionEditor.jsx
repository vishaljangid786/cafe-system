'use client';

import { useState, useEffect } from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { Button } from './Button';
import PremiumSelect from './PremiumSelect';
import toast from 'react-hot-toast';
import { ROLE_DEFAULT_PAGES } from '../../config/pages';
import { ACTIONS_BY_PAGE, ALL_ACTION_KEYS, can as canAct } from '../../config/actions';
import PageAccessEditor from './PageAccessEditor';

// Page access is edited page-by-page (PAGE_GROUPS -> allowedPages). What's left
// here are CAPABILITIES — non-page abilities. Shared by PermissionManager and
// the unified staff (People) page.
export const permissionList = [
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
export const ROLE_DEFAULT_CAPS = {
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

// Per-user permission editor modal (apply preset + reset-to-role-defaults +
// PageAccessEditor + legacy capability grid), extracted from PermissionManager
// so the People page can open it per row. Saves via PUT /users/:id/permissions
// and ALWAYS includes a `permissions` object in the payload (400 without it).
//
// Props:
//   isOpen / onClose  — modal control
//   targetUser        — the user whose access is being edited (needs _id, name,
//                       role, permissions, allowedPages, actionPermissions)
//   onSaved           — called after a successful save (refresh your list here)
//   presets           — optional saved-role presets; when omitted the editor
//                       lazily fetches /permission-presets itself.
export default function UserPermissionEditor({ isOpen, onClose, targetUser, onSaved, presets: presetsProp }) {
  const { user: currentUser } = useAuth();
  const [editedPermissions, setEditedPermissions] = useState({});
  const [editedPages, setEditedPages] = useState([]); // allowedPages being edited
  const [editedActions, setEditedActions] = useState([]); // actionPermissions keys being edited
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fetchedPresets, setFetchedPresets] = useState(null);
  const presets = presetsProp ?? fetchedPresets ?? [];

  // Seed the toggles from the target user every time the editor opens.
  useEffect(() => {
    if (!isOpen || !targetUser) return;
    const perms = targetUser.permissions || {};
    // sendMessages is ON unless explicitly turned off, so show it checked for
    // accounts that pre-date the field rather than misleadingly unchecked.
    setEditedPermissions({ ...perms, sendMessages: perms.sendMessages !== false });
    setEditedPages(Array.isArray(targetUser.allowedPages) ? [...targetUser.allowedPages] : []);
    const ap = targetUser.actionPermissions || {};
    setEditedActions(Object.keys(ap).filter((k) => ap[k] === true));
    setError('');
  }, [isOpen, targetUser]);

  // Load presets on first open when the parent didn't supply them.
  useEffect(() => {
    if (!isOpen || presetsProp || fetchedPresets) return;
    api.get('/permission-presets')
      .then((res) => setFetchedPresets(res.data.data || []))
      .catch(() => setFetchedPresets([]));
  }, [isOpen, presetsProp, fetchedPresets]);

  // A non-super-admin can only grant permissions they themselves hold.
  const actorCanGrant = (key) => currentUser?.role === 'super_admin' || !!currentUser?.permissions?.[key];

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
    if (!targetUser) return;
    const role = targetUser.role;
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
      await api.put(`/users/${targetUser._id}/permissions`, {
        permissions: safePermissions,
        allowedPages: safePages,
        actionPermissions: safeActions,
      });
      toast.success('Permissions updated');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      setError(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Permission Settings: ${targetUser?.name || ''}`}
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
          <Button variant="outline" onClick={onClose} className="order-2 sm:order-1">
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
  );
}
