// Per-page ACTION permissions — client mirror of server/utils/actionPermissions.js.
// Keep both files in sync.
//
// Layer 3 of access (above allowedPages + broad permissions): per-page
// Add / Modify / Delete / Approve toggles, stored in User.actionPermissions as a
// map of `${scope}.${action}` -> true. "Keep both": a user can perform an action
// when they are super_admin, OR hold the legacy role, OR the legacy broad
// permission, OR the granular action flag.

export const ACTION_SCOPES = [
  // Operations
  {
    scope: 'orders', pageKey: 'page_orders', label: 'Orders / Kitchen',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'approve', label: 'Confirm QR Payments', legacy: { roles: ['admin', 'branch_admin', 'location_admin', 'staff'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: ['admin'], perms: [] } },
    ],
  },
  {
    scope: 'reservations', pageKey: 'page_reservations', label: 'Reservations',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin', 'branch_admin', 'location_admin', 'staff'], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'tables', pageKey: 'page_tables', label: 'Tables',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'menu', pageKey: 'page_menu', label: 'Menu',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'inventory', pageKey: 'page_inventory', label: 'Inventory',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin'], perms: [] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin', 'branch_admin'], perms: [] } },
    ],
  },
  {
    scope: 'procurement', pageKey: 'page_procurement', label: 'Procurement',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'cashdrawer', pageKey: 'page_cashdrawer', label: 'Cash Drawer',
    actions: [
      { action: 'add', label: 'Open', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Movements / Close', legacy: { roles: [], perms: ['manageOrders'] } },
    ],
  },
  {
    scope: 'waitlist', pageKey: 'page_waitlist', label: 'Waitlist',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: [], perms: ['manageOrders'] } },
    ],
  },
  {
    scope: 'coupons', pageKey: 'page_coupons', label: 'Offers / Coupons',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: [], perms: ['manageCoupons'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: [], perms: ['manageCoupons'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: [], perms: ['manageCoupons'] } },
    ],
  },
  {
    scope: 'giftcards', pageKey: 'page_giftcards', label: 'Gift Cards',
    actions: [
      { action: 'add', label: 'Issue', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
      { action: 'modify', label: 'Top-up', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },

  // Revenue
  {
    // Admins/branch admins own their branch finances → add/modify/approve by role
    // (not only via the editRevenue toggle). Mirror of server actionPermissions.js.
    scope: 'revenue', pageKey: 'page_revenue', label: 'Revenue',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'modify', label: 'Modify / Refund', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'approve', label: 'Approve', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
    ],
  },
  {
    scope: 'expenses', pageKey: 'page_expenses', label: 'Expenses',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'approve', label: 'Approve', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
    ],
  },

  // Staff & People — Staff CRUD stays on the broad "Manage Staff" capability, so
  // there is no granular action scope for page_staff.
  {
    scope: 'attendance', pageKey: 'page_attendance', label: 'Attendance',
    actions: [
      { action: 'add', label: 'Mark', legacy: { roles: [], perms: ['manageStaff'] } },
    ],
  },
  {
    scope: 'salaries', pageKey: 'page_salaries', label: 'Salaries',
    actions: [
      { action: 'add', label: 'Generate', legacy: { roles: [], perms: ['manageStaff'] } },
      { action: 'modify', label: 'Adjust (deduct / bonus)', legacy: { roles: ['admin'], perms: [] } },
      { action: 'approve', label: 'Approve / Pay', legacy: { roles: [], perms: ['manageStaff'] } },
    ],
  },

  // Admin
  {
    scope: 'cafes', pageKey: 'page_cafes', label: 'Cafes',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: [], perms: [] } },
      { action: 'delete', label: 'Delete', legacy: { roles: [], perms: [] } },
    ],
  },
  {
    scope: 'branches', pageKey: 'page_branches', label: 'Branches',
    actions: [
      { action: 'add', label: 'Add', legacy: { roles: ['admin'], perms: ['manageBranches'] } },
      { action: 'modify', label: 'Modify', legacy: { roles: ['admin'], perms: ['manageBranches'] } },
      { action: 'delete', label: 'Delete', legacy: { roles: [], perms: ['manageBranches'] } },
    ],
  },
];

export const ALL_ACTION_KEYS = ACTION_SCOPES.flatMap((s) => s.actions.map((a) => `${s.scope}.${a.action}`));

// pageKey -> scope definition, so the UI can render action toggles under each page card.
export const ACTIONS_BY_PAGE = ACTION_SCOPES.reduce((acc, s) => { acc[s.pageKey] = s; return acc; }, {});

// key -> { scope, action, legacy }
export const ACTION_META = ACTION_SCOPES.reduce((acc, s) => {
  s.actions.forEach((a) => { acc[`${s.scope}.${a.action}`] = { scope: s.scope, action: a.action, legacy: a.legacy || { roles: [], perms: [] } }; });
  return acc;
}, {});

// Read one flag from a user's actionPermissions (plain object on the client).
export const getActionFlag = (actionPermissions, key) =>
  !!actionPermissions && actionPermissions[key] === true;

// Can this user PERFORM the action? super_admin, OR legacy role, OR legacy broad
// permission, OR the granular flag. Mirror of the server predicate — use this to
// show/hide Add/Edit/Delete/Approve buttons across the app.
export const can = (user, actionKey) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const meta = ACTION_META[actionKey];
  if (!meta) return false;
  const { roles = [], perms = [] } = meta.legacy || {};
  if (roles.includes(user.role)) return true;
  const userPerms = user.permissions || {};
  if (perms.some((p) => userPerms[p] === true)) return true;
  return getActionFlag(user.actionPermissions, actionKey);
};

// Can the ACTOR grant this action to someone else? You can only delegate what you
// can do yourself (super_admin grants anything). Server re-validates.
export const actorCanGrantAction = (actor, actionKey) => can(actor, actionKey);
