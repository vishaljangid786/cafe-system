// Page-level access registry (CLIENT mirror of server/utils/pageAccess.js — keep
// the two in sync). "One toggle = one page": a member's granted pages live in
// user.allowedPages; super_admin sees everything. Used by the sidebar, the route
// guard, the Add-Member form, and the Permissions manager.

export const PAGES = [
  { key: 'page_users',           label: 'Users',            group: 'Staff & People',  defaultRoles: ['super_admin'] },
  { key: 'page_staff',           label: 'Staff',            group: 'Staff & People',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_attendance',      label: 'Attendance',       group: 'Staff & People',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_salaries',        label: 'Salaries',         group: 'Staff & People',  defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_orders',          label: 'All Orders',       group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_reservations',    label: 'Reservations',     group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_tables',          label: 'Tables',           group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_menu',            label: 'Menu',             group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_inventory',       label: 'Inventory',        group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_procurement',     label: 'Procurement',      group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_cashdrawer',      label: 'Cash Drawer',      group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_waitlist',        label: 'Waitlist',         group: 'Operations',      defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_coupons',         label: 'Offers',           group: 'Operations',      defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_revenue',         label: 'Revenue',          group: 'Revenue',         defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_expenses',        label: 'Expenses',         group: 'Revenue',         defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_orderreports',    label: 'Order Reports',    group: 'Analytics',       defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_staffreports',    label: 'Staff Reports',    group: 'Analytics',       defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_feedback',        label: 'Feedback',         group: 'Analytics',       defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_customers',       label: 'Customers & CRM',  group: 'Analytics',       defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_branchcompare',   label: 'Branch Compare',   group: 'Analytics',       defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_paymentinsights', label: 'Payment Insights', group: 'Analytics',       defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_alerts',          label: 'Alerts Overview',  group: 'Analytics',       defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_forecast',        label: 'Sales Forecast',   group: 'Analytics',       defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_exports',         label: 'Export Center',    group: 'Analytics',       defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_branches',        label: 'Branches',         group: 'Admin',           defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_auditlogs',       label: 'Security Logs',    group: 'Admin',           defaultRoles: ['super_admin'] },
  { key: 'page_impersonate',     label: 'Login As Staff',   group: 'Admin',           defaultRoles: ['super_admin'] },
  { key: 'page_admincenter',     label: 'Admin Center',     group: 'Admin',           defaultRoles: ['super_admin'] },
];

export const ALL_PAGE_KEYS = PAGES.map((p) => p.key);
const PAGE_KEY_SET = new Set(ALL_PAGE_KEYS);

const ROLES = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'];

// Pages a freshly-created member of each role receives by default.
export const ROLE_DEFAULT_PAGES = ROLES.reduce((acc, role) => {
  acc[role] = role === 'staff' || role === 'chef'
    ? []
    : PAGES.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
  return acc;
}, {});

// PAGES grouped by `group`, preserving definition order — for the toggle UI.
export const PAGE_GROUPS = PAGES.reduce((acc, p) => {
  (acc[p.group] = acc[p.group] || []).push(p);
  return acc;
}, {});

// Can THIS user open a given page? super_admin always; otherwise it must be in
// their allowedPages. (Role-only pages not in the registry are gated elsewhere.)
export const canViewPage = (user, pageKey) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return Array.isArray(user.allowedPages) && user.allowedPages.includes(pageKey);
};

export const sanitizePages = (pages) =>
  Array.isArray(pages) ? [...new Set(pages.filter((k) => PAGE_KEY_SET.has(k)))] : [];
