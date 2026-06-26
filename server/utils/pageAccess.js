// ---------------------------------------------------------------------------
// Page-level access registry - the single source of truth for "which page".
//
// The product model is "one toggle = one page": when a member is created you pick
// exactly which pages they may open, and they see only those pages. A user's
// granted pages live in User.allowedPages (an array of the `key`s below).
// super_admin sees everything.
//
// NOTE: client/app/config/pages.js mirrors PAGES + ROLE_DEFAULT_PAGES. Keep both
// in sync. PERM_TO_PAGES exists only here for the migration that backfills
// allowedPages from the old coarse `permissions`.
// ---------------------------------------------------------------------------

// Each page: key (stored in allowedPages), label (shown in the UI), group (UI
// section), and roles that get it by default when a member of that role is
// created. legacyPerm is the old coarse permission this page used to be gated by
// and is used by migration/backfill. `grants` are the coarse permissions enabled
// when the page is granted so the underlying API can function.
const PAGES = [
  // Main
  { key: 'page_overview', label: 'Overview', group: 'Main', legacyPerm: null, defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_branchpresence', label: 'Branch Presence', group: 'Main', legacyPerm: 'manageStaff', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },

  // Staff & people
  { key: 'page_users', label: 'Users', group: 'Staff & People', legacyPerm: 'manageStaff', defaultRoles: ['super_admin'] },
  { key: 'page_staff', label: 'Staff', group: 'Staff & People', legacyPerm: 'manageStaff', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_attendance', label: 'Attendance', group: 'Staff & People', legacyPerm: 'manageStaff', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_salaries', label: 'Salaries', group: 'Staff & People', legacyPerm: 'manageStaff', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_myattendance', label: 'My Attendance', group: 'Staff & People', legacyPerm: null, defaultRoles: ['staff'] },

  // Operations
  { key: 'page_orders', label: 'All Orders / Kitchen', group: 'Operations', legacyPerm: 'viewOrders', grants: ['viewOrders', 'manageOrders'], defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'] },
  { key: 'page_reservations', label: 'Reservations', group: 'Operations', legacyPerm: 'manageOrders', grants: ['viewOrders', 'manageOrders'], defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_tables', label: 'Tables', group: 'Operations', legacyPerm: 'manageOrders', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_menu', label: 'Menu', group: 'Operations', legacyPerm: 'manageOrders', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'] },
  { key: 'page_inventory', label: 'Inventory', group: 'Operations', legacyPerm: 'manageOrders', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_procurement', label: 'Procurement', group: 'Operations', legacyPerm: 'manageOrders', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_cashdrawer', label: 'Cash Drawer', group: 'Operations', legacyPerm: 'manageOrders', grants: ['manageOrders', 'viewRevenue'], defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_waitlist', label: 'Waitlist', group: 'Operations', legacyPerm: 'manageOrders', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_coupons', label: 'Offers', group: 'Operations', legacyPerm: 'manageCoupons', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_giftcards', label: 'Gift Cards', group: 'Operations', legacyPerm: 'manageOrders', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },

  // Revenue
  { key: 'page_revenue', label: 'Revenue', group: 'Revenue', legacyPerm: 'viewRevenue', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_expenses', label: 'Expenses', group: 'Revenue', legacyPerm: 'viewRevenue', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },

  // Analytics
  { key: 'page_orderreports', label: 'Order Reports', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_staffreports', label: 'Staff Reports', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_feedback', label: 'Feedback', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_customers', label: 'Customers & CRM', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_branchcompare', label: 'Branch Compare', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_paymentinsights', label: 'Payment Insights', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_alerts', label: 'Alerts Overview', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_forecast', label: 'Sales Forecast', group: 'Analytics', legacyPerm: 'viewAnalytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_exports', label: 'Export Center', group: 'Analytics', legacyPerm: 'exportReports', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_myperformance', label: 'My Performance', group: 'Analytics', legacyPerm: null, defaultRoles: ['staff', 'chef'] },
  { key: 'page_workhistory', label: 'Work History', group: 'Analytics', legacyPerm: null, defaultRoles: ['staff'] },

  // Platform / admin
  { key: 'page_addmember', label: 'Add Member', group: 'Admin', legacyPerm: 'manageStaff', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_permissions', label: 'Permissions', group: 'Admin', legacyPerm: 'manageStaff', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_settings', label: 'Settings', group: 'Admin', legacyPerm: null, defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_cafes', label: 'Cafes', group: 'Admin', legacyPerm: 'manageBranches', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_branches', label: 'Branches', group: 'Admin', legacyPerm: 'manageBranches', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_auditlogs', label: 'Security Logs', group: 'Admin', legacyPerm: 'viewAuditLogs', defaultRoles: ['super_admin'] },
  { key: 'page_impersonate', label: 'Login As Staff', group: 'Admin', legacyPerm: 'impersonateUsers', defaultRoles: ['super_admin'] },
  { key: 'page_admincenter', label: 'Admin Center', group: 'Admin', legacyPerm: 'viewAdminCenter', defaultRoles: ['super_admin'] },
];

const ALL_PAGE_KEYS = PAGES.map((p) => p.key);
const PAGE_KEY_SET = new Set(ALL_PAGE_KEYS);

const ROLES = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'];

const ROLE_DEFAULT_PAGES = ROLES.reduce((acc, role) => {
  acc[role] = PAGES.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
  return acc;
}, {});

const PERM_TO_PAGES = {};
PAGES.forEach((p) => {
  if (!p.legacyPerm) return;
  (PERM_TO_PAGES[p.legacyPerm] = PERM_TO_PAGES[p.legacyPerm] || []).push(p.key);
});

const grantsFor = (p) => p.grants || (p.legacyPerm ? [p.legacyPerm] : []);
const PAGE_BY_KEY = Object.fromEntries(PAGES.map((p) => [p.key, p]));
const DERIVABLE_PERMS = [...new Set(PAGES.flatMap(grantsFor))];

const permsForPages = (pageKeys = []) => {
  const set = new Set();
  pageKeys.forEach((k) => {
    const p = PAGE_BY_KEY[k];
    if (p) grantsFor(p).forEach((perm) => set.add(perm));
  });
  return set;
};

const sanitizePages = (pages) =>
  Array.isArray(pages) ? [...new Set(pages.filter((k) => PAGE_KEY_SET.has(k)))] : [];

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
  DERIVABLE_PERMS,
  sanitizePages,
  pagesFromPermissions,
  permsForPages,
};
