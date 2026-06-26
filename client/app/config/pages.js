// Page-level access registry (client mirror of server/utils/pageAccess.js).
// Keep this in sync with the server list.

export const PAGES = [
  { key: 'page_overview', label: 'Overview', group: 'Main', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_branchpresence', label: 'Branch Presence', group: 'Main', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },

  { key: 'page_users', label: 'Users', group: 'Staff & People', defaultRoles: ['super_admin'] },
  { key: 'page_staff', label: 'Staff', group: 'Staff & People', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_attendance', label: 'Attendance', group: 'Staff & People', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_salaries', label: 'Salaries', group: 'Staff & People', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_myattendance', label: 'My Attendance', group: 'Staff & People', defaultRoles: ['staff'] },

  { key: 'page_orders', label: 'All Orders / Kitchen', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'] },
  { key: 'page_reservations', label: 'Reservations', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_tables', label: 'Tables', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_menu', label: 'Menu', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'] },
  { key: 'page_inventory', label: 'Inventory', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_procurement', label: 'Procurement', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_cashdrawer', label: 'Cash Drawer', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_waitlist', label: 'Waitlist', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff'] },
  { key: 'page_coupons', label: 'Offers', group: 'Operations', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_giftcards', label: 'Gift Cards', group: 'Operations', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },

  { key: 'page_revenue', label: 'Revenue', group: 'Revenue', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_expenses', label: 'Expenses', group: 'Revenue', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },

  { key: 'page_orderreports', label: 'Order Reports', group: 'Analytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_staffreports', label: 'Staff Reports', group: 'Analytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_feedback', label: 'Feedback', group: 'Analytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_customers', label: 'Customers & CRM', group: 'Analytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_branchcompare', label: 'Branch Compare', group: 'Analytics', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_paymentinsights', label: 'Payment Insights', group: 'Analytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_alerts', label: 'Alerts Overview', group: 'Analytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_forecast', label: 'Sales Forecast', group: 'Analytics', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_exports', label: 'Export Center', group: 'Analytics', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_myperformance', label: 'My Performance', group: 'Analytics', defaultRoles: ['staff', 'chef'] },
  { key: 'page_workhistory', label: 'Work History', group: 'Analytics', defaultRoles: ['staff'] },

  { key: 'page_addmember', label: 'Add Member', group: 'Admin', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_permissions', label: 'Permissions', group: 'Admin', defaultRoles: ['super_admin', 'admin', 'branch_admin'] },
  { key: 'page_settings', label: 'Settings', group: 'Admin', defaultRoles: ['super_admin', 'admin', 'branch_admin', 'location_admin'] },
  { key: 'page_cafes', label: 'Cafes', group: 'Admin', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_branches', label: 'Branches', group: 'Admin', defaultRoles: ['super_admin', 'admin'] },
  { key: 'page_auditlogs', label: 'Security Logs', group: 'Admin', defaultRoles: ['super_admin'] },
  { key: 'page_impersonate', label: 'Login As Staff', group: 'Admin', defaultRoles: ['super_admin'] },
  { key: 'page_admincenter', label: 'Admin Center', group: 'Admin', defaultRoles: ['super_admin'] },
];

export const ALL_PAGE_KEYS = PAGES.map((p) => p.key);
const PAGE_KEY_SET = new Set(ALL_PAGE_KEYS);

const ROLES = ['super_admin', 'admin', 'branch_admin', 'location_admin', 'staff', 'chef'];

export const ROLE_DEFAULT_PAGES = ROLES.reduce((acc, role) => {
  acc[role] = PAGES.filter((p) => p.defaultRoles.includes(role)).map((p) => p.key);
  return acc;
}, {});

export const PAGE_GROUPS = PAGES.reduce((acc, p) => {
  (acc[p.group] = acc[p.group] || []).push(p);
  return acc;
}, {});

export const canViewPage = (user, pageKey) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return Array.isArray(user.allowedPages) && user.allowedPages.includes(pageKey);
};

export const sanitizePages = (pages) =>
  Array.isArray(pages) ? [...new Set(pages.filter((k) => PAGE_KEY_SET.has(k)))] : [];
