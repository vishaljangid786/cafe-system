// ---------------------------------------------------------------------------
// Page-level access registry — the single source of truth for "which page".
//
// The product model is "one toggle = one page": when a member is created you pick
// exactly which pages they may open, and they see ONLY those (plus role-only pages
// like Overview/Settings that aren't access-gated). A user's granted pages live in
// User.allowedPages (an array of the `key`s below). super_admin sees everything.
//
// NOTE: client/app/config/pages.js mirrors PAGES + ROLE_DEFAULT_PAGES — keep both
// in sync. PERM_TO_PAGES exists only here (server) for the one-time migration that
// backfills allowedPages from the OLD coarse `permissions` so existing users keep
// their access.
// ---------------------------------------------------------------------------

// Each page: key (stored in allowedPages), label (shown in the UI), group (UI
// section), and the roles that get it by default when a member of that role is
// created. legacyPerm is the OLD coarse permission this page used to be gated by —
// used only to migrate existing users.
const PAGES = [
  // Staff & people
  { key: 'page_users',          label: 'Users',            group: 'Staff',      legacyPerm: 'manageStaff',   defaultRoles: ['super_admin'] },
  { key: 'page_staff',          label: 'Staff',            group: 'Staff',      legacyPerm: 'manageStaff',   defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_attendance',     label: 'Attendance',       group: 'Staff',      legacyPerm: 'manageStaff',   defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_salaries',       label: 'Salaries',         group: 'Staff',      legacyPerm: 'manageStaff',   defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  // Orders & operations
  { key: 'page_orders',         label: 'All Orders',       group: 'Operations', legacyPerm: 'viewOrders',    defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_reservations',   label: 'Reservations',     group: 'Operations', legacyPerm: 'viewOrders',    defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_tables',         label: 'Tables',           group: 'Operations', legacyPerm: 'manageOrders',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_menu',           label: 'Menu',             group: 'Operations', legacyPerm: 'manageOrders',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_inventory',      label: 'Inventory',        group: 'Operations', legacyPerm: 'manageOrders',  defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_procurement',    label: 'Procurement',      group: 'Operations', legacyPerm: 'manageOrders',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_cashdrawer',     label: 'Cash Drawer',      group: 'Operations', legacyPerm: 'manageOrders',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_waitlist',       label: 'Waitlist',         group: 'Operations', legacyPerm: 'manageOrders',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_coupons',        label: 'Offers',           group: 'Operations', legacyPerm: 'manageCoupons',  defaultRoles: ['super_admin', 'admin'] },
  // Revenue
  { key: 'page_revenue',        label: 'Revenue',          group: 'Revenue',    legacyPerm: 'viewRevenue',   defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_expenses',       label: 'Expenses',         group: 'Revenue',    legacyPerm: 'viewRevenue',   defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  // Analytics
  { key: 'page_orderreports',   label: 'Order Reports',    group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_staffreports',   label: 'Staff Reports',    group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_feedback',       label: 'Feedback',         group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_customers',      label: 'Customers & CRM',  group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_branchcompare',  label: 'Branch Compare',   group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_paymentinsights',label: 'Payment Insights', group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_alerts',         label: 'Alerts Overview',  group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_forecast',       label: 'Sales Forecast',   group: 'Analytics',  legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_exports',        label: 'Export Center',    group: 'Analytics',  legacyPerm: 'exportReports', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  // Platform / admin
  { key: 'page_branches',       label: 'Branches',         group: 'Admin',      legacyPerm: 'manageBranches',defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_auditlogs',      label: 'Security Logs',    group: 'Admin',      legacyPerm: 'viewAuditLogs', defaultRoles: ['super_admin'] },
  { key: 'page_impersonate',    label: 'Login As Staff',   group: 'Admin',      legacyPerm: 'impersonateUsers', defaultRoles: ['super_admin'] },
  { key: 'page_admincenter',    label: 'Admin Center',     group: 'Admin',      legacyPerm: 'viewAdminCenter', defaultRoles: ['super_admin'] },
];

const ALL_PAGE_KEYS = PAGES.map((p) => p.key);
const PAGE_KEY_SET = new Set(ALL_PAGE_KEYS);

const ROLES = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'];

// Default pages a freshly-created member of each role receives (mirrors the old
// per-role permission defaults). staff/chef use their own fixed menu and get no
// admin pages. super_admin implicitly sees everything (not stored).
const ROLE_DEFAULT_PAGES = ROLES.reduce((acc, role) => {
  acc[role] = role === 'staff' || role === 'chef'
    ? []
    : PAGES.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
  return acc;
}, {});

// OLD coarse permission key -> the page keys it used to unlock. Used ONLY by the
// one-time migration to seed allowedPages for users created before this system.
const PERM_TO_PAGES = ALL_PAGE_KEYS.reduce((acc, key) => acc, {});
PAGES.forEach((p) => {
  (PERM_TO_PAGES[p.legacyPerm] = PERM_TO_PAGES[p.legacyPerm] || []).push(p.key);
});

// Sanitize a requested allowedPages array down to known keys (drops anything bogus).
const sanitizePages = (pages) =>
  Array.isArray(pages) ? [...new Set(pages.filter((k) => PAGE_KEY_SET.has(k)))] : [];

// Derive allowedPages from a legacy `permissions` object (for the migration / any
// caller that still only has the old shape).
const pagesFromPermissions = (permissions = {}) => {
  const set = new Set();
  for (const [perm, keys] of Object.entries(PERM_TO_PAGES)) {
    if (permissions[perm] === true) keys.forEach((k) => set.add(k));
  }
  return [...set];
};

module.exports = {
  PAGES,
  ALL_PAGE_KEYS,
  PAGE_KEY_SET,
  ROLE_DEFAULT_PAGES,
  PERM_TO_PAGES,
  sanitizePages,
  pagesFromPermissions,
};
