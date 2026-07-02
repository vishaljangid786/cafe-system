// ---------------------------------------------------------------------------
// Per-page ACTION permissions — the granular layer above page-open access.
//
// The access model now has THREE layers, all enforced server-side:
//   1. allowedPages       — "can OPEN this page"                 (pageAccess.js)
//   2. permissions        — broad capabilities (manageOrders, editRevenue, …)
//   3. actionPermissions  — THIS file: per-page Add / Modify / Delete / Approve.
//
// "KEEP BOTH" model (chosen by the product owner): a write passes when the user is
//   • super_admin, OR
//   • holds the legacy broad PERMISSION that used to gate it (e.g. manageOrders), OR
//   • has the legacy ROLE that used to gate it (e.g. admin for order delete), OR
//   • holds the granular ACTION key here (e.g. 'orders.delete').
// So adding this layer NEVER removes existing access — it only ADDS a finer way to
// grant the exact same ability. Ticking 'orders.delete' for a staff member lets
// THAT staff member delete orders even though their role normally couldn't.
//
// Action keys are `${scope}.${action}` (e.g. 'orders.add', 'revenue.approve') and
// are stored in User.actionPermissions, a Map<String, Boolean>.
//
// NOTE: client/app/config/actions.js mirrors ACTION_SCOPES. Keep both in sync.
// ---------------------------------------------------------------------------

// Each scope maps to ONE page (pageKey) and lists its grantable actions. For every
// action, `legacy` records what ALREADY grants it today (roles + broad perms) so
// "keep both" maps exactly to the current route guards.
const ACTION_SCOPES = [
  // ---- Operations -------------------------------------------------------------
  {
    scope: 'orders', pageKey: 'page_orders', label: 'Orders / Kitchen',
    actions: [
      { action: 'add', label: 'Add (create orders)', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify (status, items, payment)', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'approve', label: 'Confirm QR self-order payments', legacy: { roles: ['admin', 'branch_admin', 'location_admin', 'staff'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete orders', legacy: { roles: ['admin'], perms: [] } },
    ],
  },
  {
    scope: 'reservations', pageKey: 'page_reservations', label: 'Reservations',
    actions: [
      { action: 'add', label: 'Add reservations', legacy: { roles: ['admin', 'branch_admin', 'location_admin', 'staff'], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify reservations', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete reservations', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'tables', pageKey: 'page_tables', label: 'Tables',
    actions: [
      { action: 'add', label: 'Add tables', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify tables', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete tables', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'menu', pageKey: 'page_menu', label: 'Menu',
    actions: [
      { action: 'add', label: 'Add menu items', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Modify menu items', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: ['manageOrders'] } },
      { action: 'delete', label: 'Delete menu items', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'inventory', pageKey: 'page_inventory', label: 'Inventory',
    actions: [
      { action: 'add', label: 'Add ingredients', legacy: { roles: ['admin'], perms: [] } },
      { action: 'modify', label: 'Update stock / log waste', legacy: { roles: ['admin', 'branch_admin'], perms: [] } },
    ],
  },
  {
    scope: 'procurement', pageKey: 'page_procurement', label: 'Procurement',
    actions: [
      { action: 'add', label: 'Create purchase orders / suppliers', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
      { action: 'modify', label: 'Receive / cancel / edit', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },
  {
    scope: 'cashdrawer', pageKey: 'page_cashdrawer', label: 'Cash Drawer',
    actions: [
      { action: 'add', label: 'Open drawer', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Movements / close', legacy: { roles: [], perms: ['manageOrders'] } },
    ],
  },
  {
    scope: 'waitlist', pageKey: 'page_waitlist', label: 'Waitlist',
    actions: [
      { action: 'add', label: 'Add to waitlist', legacy: { roles: [], perms: ['manageOrders'] } },
      { action: 'modify', label: 'Update waitlist entries', legacy: { roles: [], perms: ['manageOrders'] } },
    ],
  },
  {
    scope: 'coupons', pageKey: 'page_coupons', label: 'Offers / Coupons',
    actions: [
      { action: 'add', label: 'Create offers', legacy: { roles: [], perms: ['manageCoupons'] } },
      { action: 'modify', label: 'Edit offers', legacy: { roles: [], perms: ['manageCoupons'] } },
      { action: 'delete', label: 'Delete offers', legacy: { roles: [], perms: ['manageCoupons'] } },
    ],
  },
  {
    scope: 'giftcards', pageKey: 'page_giftcards', label: 'Gift Cards',
    actions: [
      { action: 'add', label: 'Issue gift cards', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
      { action: 'modify', label: 'Top-up gift cards', legacy: { roles: ['admin', 'branch_admin', 'location_admin'], perms: [] } },
    ],
  },

  // ---- Revenue ----------------------------------------------------------------
  {
    // An admin / branch admin OWNS their branch finances (see transactionController:
    // their own entries auto-approve), so they may add/modify/approve revenue by
    // ROLE — not only when the editRevenue permission happens to be toggled on. The
    // controller still enforces branch scope + segregation of duties on approve.
    scope: 'revenue', pageKey: 'page_revenue', label: 'Revenue',
    actions: [
      { action: 'add', label: 'Add revenue entries', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'modify', label: 'Modify / refund revenue', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'approve', label: 'Approve new revenue', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
    ],
  },
  {
    // Same ownership rule as revenue: admins/branch admins manage their branch
    // expenses (including approve/reject) by role; the controller re-checks scope.
    scope: 'expenses', pageKey: 'page_expenses', label: 'Expenses',
    actions: [
      { action: 'add', label: 'Add expenses', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'modify', label: 'Modify expenses', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'delete', label: 'Delete expenses', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
      { action: 'approve', label: 'Approve expenses', legacy: { roles: ['admin', 'branch_admin'], perms: ['editRevenue'] } },
    ],
  },

  // ---- Staff & People ---------------------------------------------------------
  // NOTE: Staff CRUD stays governed by the broad `manageStaff` capability (it runs
  // through a sensitive role hierarchy in userController), so it has no granular
  // action scope here — grant "Manage Staff" in the Permissions section instead.
  {
    scope: 'attendance', pageKey: 'page_attendance', label: 'Attendance',
    actions: [
      { action: 'add', label: 'Mark attendance', legacy: { roles: [], perms: ['manageStaff'] } },
    ],
  },
  {
    scope: 'salaries', pageKey: 'page_salaries', label: 'Salaries',
    actions: [
      { action: 'add', label: 'Generate payroll', legacy: { roles: [], perms: ['manageStaff'] } },
      { action: 'modify', label: 'Adjust salary (deduct / bonus)', legacy: { roles: ['admin'], perms: [] } },
      { action: 'approve', label: 'Approve / pay payroll', legacy: { roles: [], perms: ['manageStaff'] } },
    ],
  },

  // ---- Admin ------------------------------------------------------------------
  {
    // Cafe create/delete is super_admin-only by design; these flags let a super
    // admin DELEGATE that to a specific user without opening it to all admins, so
    // the legacy fallback is intentionally empty (super_admin still always passes).
    scope: 'cafes', pageKey: 'page_cafes', label: 'Cafes',
    actions: [
      // Edit is intentionally omitted — updateCafe is gated inside the controller
      // (super_admin OR cafe admin), not by middleware.
      { action: 'add', label: 'Create cafes', legacy: { roles: [], perms: [] } },
      { action: 'delete', label: 'Delete cafes', legacy: { roles: [], perms: [] } },
    ],
  },
  {
    scope: 'branches', pageKey: 'page_branches', label: 'Branches',
    actions: [
      { action: 'add', label: 'Create branches', legacy: { roles: ['admin'], perms: ['manageBranches'] } },
      { action: 'modify', label: 'Edit branches', legacy: { roles: ['admin'], perms: ['manageBranches'] } },
      { action: 'delete', label: 'Delete branches', legacy: { roles: [], perms: ['manageBranches'] } },
    ],
  },
];

// Flat list of all valid action keys, e.g. 'orders.add'.
const ALL_ACTION_KEYS = ACTION_SCOPES.flatMap((s) => s.actions.map((a) => `${s.scope}.${a.action}`));
const ACTION_KEY_SET = new Set(ALL_ACTION_KEYS);

// key -> { scope, action, legacy } for fast lookup in middleware / helpers.
const ACTION_META = {};
ACTION_SCOPES.forEach((s) => {
  s.actions.forEach((a) => {
    ACTION_META[`${s.scope}.${a.action}`] = { scope: s.scope, action: a.action, legacy: a.legacy || { roles: [], perms: [] } };
  });
});

// Robust read of a single action flag — handles both a Mongoose Map (.get) and a
// plain object (lean queries / JSON bodies).
const getActionFlag = (actionPermissions, key) => {
  if (!actionPermissions) return false;
  if (typeof actionPermissions.get === 'function') return actionPermissions.get(key) === true;
  return actionPermissions[key] === true;
};

// The core authorization predicate, shared by middleware and the grant gate.
// TRUE when the user may perform `actionKey`: super_admin, OR legacy role, OR
// legacy broad permission, OR the granular action flag.
const userCanAct = (user, actionKey) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const meta = ACTION_META[actionKey];
  if (!meta) return false;
  const { roles = [], perms = [] } = meta.legacy || {};
  if (roles.includes(user.role)) return true;
  const userPerms = user.permissions && user.permissions.toObject ? user.permissions.toObject() : (user.permissions || {});
  if (perms.some((p) => userPerms[p] === true)) return true;
  return getActionFlag(user.actionPermissions, actionKey);
};

// Normalize an incoming actionPermissions payload (object OR array of granted keys)
// into a clean { key: true/false } object containing ONLY known keys.
const sanitizeActionPermissions = (input) => {
  const out = {};
  if (!input) return out;
  if (Array.isArray(input)) {
    input.forEach((k) => { if (ACTION_KEY_SET.has(k)) out[k] = true; });
    return out;
  }
  if (typeof input === 'object') {
    Object.keys(input).forEach((k) => { if (ACTION_KEY_SET.has(k)) out[k] = input[k] === true; });
  }
  return out;
};

module.exports = {
  ACTION_SCOPES,
  ALL_ACTION_KEYS,
  ACTION_KEY_SET,
  ACTION_META,
  getActionFlag,
  userCanAct,
  sanitizeActionPermissions,
};
