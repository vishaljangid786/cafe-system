// Single client route registry: pageKey -> where that page lives.
//
// This is the ONE source of truth for pageKey->href data that previously lived
// in four hand-synced shapes (Sidebar GRANTABLE_PAGES, useNavGroups
// GRANTABLE_PAGES, layout.js GATED_PAGES, layout.js pathForPage). Consumers:
//   - routeForPage(role, pageKey): the href nav/redirects should use for a role
//   - gatedEntries(): every path variant of every page, for the layout guard
//
// `canonical` is the shared page; `byRole` points roles that still have their
// own route (legacy duplicates kept alive as re-export stubs) at that route.
// `paths` MUST keep listing every historical variant until its stub is deleted,
// so the access guard keeps gating old bookmarks/deep links.
//
// HUB routes host several sections as tabs (see components/ui/TabHub). They are
// declared with `anyOf` instead of gating on one key: a viewer may open the hub
// when they hold ANY of its sections, and TabHub then shows only the tabs they
// actually hold. Gating on a single key would lock someone out of a page they
// have partial access to.

export const ROUTE_TABLE = {
  page_overview: {
    canonical: '/dashboard/admin',
    byRole: {
      branch_admin: '/dashboard/branch-admin',
      location_admin: '/dashboard/location-admin',
      staff: '/dashboard/staff',
      chef: '/dashboard/chef',
    },
    paths: ['/dashboard/admin', '/dashboard/admin/summary', '/dashboard/branch-admin', '/dashboard/location-admin', '/dashboard/staff'],
  },
  page_branchpresence: {
    canonical: '/dashboard/admin/branch-presence',
    paths: ['/dashboard/admin/branch-presence'],
  },
  // '/dashboard/admin/users' IS the People hub, so `hub_people` owns that path
  // and gates it on ANY of its sections. Leaving it here too made both entries
  // match, and the single-key one won — locking out anyone whose only grant was
  // Staff / Attendance / Salaries / Permissions / Login As.
  page_users: {
    canonical: '/dashboard/admin/users',
    paths: [],
  },
  page_staff: {
    canonical: '/dashboard/admin/staff',
    byRole: {
      branch_admin: '/dashboard/branch-admin/staff',
      location_admin: '/dashboard/location-admin/staff',
    },
    // The Team tab opens on either grant (Users and Staff were merged), so the
    // route guard has to accept either too.
    anyOf: ['page_staff', 'page_users'],
    paths: ['/dashboard/admin/staff', '/dashboard/branch-admin/staff', '/dashboard/location-admin/staff'],
  },
  page_attendance: {
    canonical: '/dashboard/admin/attendance',
    byRole: {
      branch_admin: '/dashboard/branch-admin/attendance',
      location_admin: '/dashboard/location-admin/attendance',
    },
    paths: ['/dashboard/admin/attendance', '/dashboard/branch-admin/attendance', '/dashboard/location-admin/attendance'],
  },
  page_myattendance: {
    canonical: '/dashboard/staff/attendance',
    paths: ['/dashboard/staff/attendance'],
  },
  page_salaries: {
    canonical: '/dashboard/admin/payroll',
    byRole: {
      branch_admin: '/dashboard/branch-admin/salary',
      location_admin: '/dashboard/location-admin/salary',
    },
    paths: ['/dashboard/admin/payroll', '/dashboard/branch-admin/salary', '/dashboard/location-admin/salary'],
  },
  page_orders: {
    canonical: '/dashboard/admin/orders',
    byRole: {
      staff: '/dashboard/staff/orders',
      chef: '/dashboard/chef',
    },
    paths: ['/dashboard/admin/orders', '/dashboard/staff/orders', '/dashboard/chef'],
  },
  page_orderreports: {
    canonical: '/dashboard/admin/orders/analytics',
    paths: ['/dashboard/admin/orders/analytics'],
  },
  page_reservations: {
    canonical: '/dashboard/reservations',
    paths: ['/dashboard/reservations', '/dashboard/bookings', '/dashboard/admin/bookings', '/dashboard/branch-admin/bookings', '/dashboard/location-admin/bookings'],
  },
  page_tables: {
    canonical: '/dashboard/admin/tables',
    byRole: {
      branch_admin: '/dashboard/branch-admin/tables',
      location_admin: '/dashboard/location-admin/tables',
      staff: '/dashboard/staff/tables',
    },
    paths: ['/dashboard/admin/tables', '/dashboard/branch-admin/tables', '/dashboard/location-admin/tables', '/dashboard/staff/tables'],
  },
  page_menu: {
    canonical: '/dashboard/admin/menu',
    byRole: {
      branch_admin: '/dashboard/branch-admin/menu',
      location_admin: '/dashboard/location-admin/menu',
      staff: '/dashboard/staff/menu',
      chef: '/dashboard/staff/menu',
    },
    paths: ['/dashboard/admin/menu', '/dashboard/branch-admin/menu', '/dashboard/location-admin/menu', '/dashboard/staff/menu'],
  },
  page_inventory: {
    canonical: '/dashboard/admin/inventory',
    paths: ['/dashboard/admin/inventory'],
  },
  page_procurement: {
    canonical: '/dashboard/admin/procurement',
    paths: ['/dashboard/admin/procurement'],
  },
  page_cashdrawer: {
    canonical: '/dashboard/admin/cash-drawer',
    byRole: { staff: '/dashboard/staff/cash-drawer' },
    paths: ['/dashboard/admin/cash-drawer', '/dashboard/staff/cash-drawer'],
  },
  page_waitlist: {
    canonical: '/dashboard/admin/waitlist',
    byRole: { staff: '/dashboard/staff/waitlist' },
    paths: ['/dashboard/admin/waitlist', '/dashboard/staff/waitlist'],
  },
  page_coupons: {
    canonical: '/dashboard/admin/coupons',
    paths: ['/dashboard/admin/coupons'],
  },
  page_giftcards: {
    canonical: '/dashboard/admin/gift-cards',
    paths: ['/dashboard/admin/gift-cards'],
  },
  page_revenue: {
    canonical: '/dashboard/admin/revenue',
    byRole: {
      branch_admin: '/dashboard/branch-admin/revenue',
      location_admin: '/dashboard/location-admin/revenue',
    },
    paths: ['/dashboard/admin/revenue', '/dashboard/branch-admin/revenue', '/dashboard/location-admin/revenue'],
  },
  page_expenses: {
    canonical: '/dashboard/admin/expenses',
    byRole: {
      branch_admin: '/dashboard/branch-admin/expenses',
      location_admin: '/dashboard/location-admin/expenses',
      staff: '/dashboard/staff/expenses',
      chef: '/dashboard/chef/expenses',
    },
    paths: ['/dashboard/admin/expenses', '/dashboard/branch-admin/expenses', '/dashboard/location-admin/expenses', '/dashboard/staff/expenses', '/dashboard/chef/expenses'],
  },
  page_staffreports: {
    canonical: '/dashboard/admin/staff-reports',
    byRole: {
      branch_admin: '/dashboard/branch-admin/staff-reports',
      location_admin: '/dashboard/location-admin/staff-reports',
    },
    paths: ['/dashboard/admin/staff-reports', '/dashboard/branch-admin/staff-reports', '/dashboard/location-admin/staff-reports'],
  },
  page_staffcomparison: {
    canonical: '/dashboard/admin/staff-comparison',
    byRole: {
      branch_admin: '/dashboard/branch-admin/staff-comparison',
      location_admin: '/dashboard/location-admin/staff-comparison',
    },
    paths: ['/dashboard/admin/staff-comparison', '/dashboard/branch-admin/staff-comparison', '/dashboard/location-admin/staff-comparison'],
  },
  page_feedback: {
    canonical: '/dashboard/admin/feedback',
    paths: ['/dashboard/admin/feedback'],
  },
  page_customers: {
    canonical: '/dashboard/admin/customers',
    paths: ['/dashboard/admin/customers'],
  },
  page_branchcompare: {
    canonical: '/dashboard/admin/location-comparison',
    paths: ['/dashboard/admin/location-comparison'],
  },
  page_paymentinsights: {
    canonical: '/dashboard/admin/payment-intelligence',
    paths: ['/dashboard/admin/payment-intelligence'],
  },
  page_alerts: {
    canonical: '/dashboard/admin/command-center',
    paths: ['/dashboard/admin/command-center'],
  },
  page_forecast: {
    canonical: '/dashboard/admin/forecasting',
    paths: ['/dashboard/admin/forecasting'],
  },
  page_exports: {
    canonical: '/dashboard/admin/exports',
    paths: ['/dashboard/admin/exports'],
  },
  page_myperformance: {
    canonical: '/dashboard/staff/performance',
    byRole: { chef: '/dashboard/chef/performance' },
    paths: ['/dashboard/staff/performance', '/dashboard/chef/performance'],
  },
  page_workhistory: {
    canonical: '/dashboard/staff/work-history',
    paths: ['/dashboard/staff/work-history'],
  },
  page_addmember: {
    canonical: '/dashboard/add-member',
    paths: ['/dashboard/add-member'],
  },
  // Permissions is now a TAB of the People hub — its standalone pages were
  // deleted, so every link that asks for this key opens the hub instead.
  page_permissions: {
    canonical: '/dashboard/admin/users',
    paths: [],
  },
  page_settings: {
    canonical: '/dashboard/admin/settings',
    paths: ['/dashboard/admin/settings'],
  },
  page_cafes: {
    canonical: '/dashboard/admin/cafes',
    paths: ['/dashboard/admin/cafes'],
  },
  page_branches: {
    canonical: '/dashboard/admin/locations',
    paths: ['/dashboard/admin/locations'],
  },
  page_auditlogs: {
    canonical: '/dashboard/admin/audit-logs',
    paths: ['/dashboard/admin/audit-logs'],
  },
  // Login As is now a TAB of the People hub; the standalone page was deleted.
  page_impersonate: {
    canonical: '/dashboard/admin/users',
    paths: [],
  },
  page_admincenter: {
    canonical: '/dashboard/super-admin',
    paths: ['/dashboard/super-admin'],
  },

  // ── Hubs ────────────────────────────────────────────────────────────────
  // One route, several tabbed sections. `anyOf` lists the section grants; the
  // guard opens the hub when the viewer holds at least one of them.
  hub_people: {
    canonical: '/dashboard/admin/users',
    anyOf: ['page_staff', 'page_users', 'page_attendance', 'page_salaries', 'page_permissions', 'page_impersonate'],
    paths: ['/dashboard/admin/users'],
  },
  hub_finance: {
    canonical: '/dashboard/admin/finance',
    anyOf: ['page_revenue', 'page_expenses', 'page_paymentinsights'],
    paths: ['/dashboard/admin/finance'],
  },
  hub_stock: {
    canonical: '/dashboard/admin/stock',
    anyOf: ['page_inventory', 'page_procurement'],
    paths: ['/dashboard/admin/stock'],
  },
  hub_reports: {
    canonical: '/dashboard/admin/reports',
    anyOf: ['page_orderreports', 'page_staffreports'],
    paths: ['/dashboard/admin/reports'],
  },
  hub_compare: {
    canonical: '/dashboard/admin/compare',
    anyOf: ['page_staffcomparison', 'page_branchcompare'],
    paths: ['/dashboard/admin/compare'],
  },
};

// The href a given role should use to open a page.
export const routeForPage = (role, pageKey) => {
  const entry = ROUTE_TABLE[pageKey];
  if (!entry) return '';
  return (entry.byRole && entry.byRole[role]) || entry.canonical;
};

// [{ key, keys, paths }] for the layout access guard.
// `keys` is what the guard checks: a plain page contributes its own key, a hub
// contributes every section grant that opens it.
export const gatedEntries = () =>
  Object.entries(ROUTE_TABLE).map(([key, entry]) => ({
    key,
    keys: entry.anyOf || [key],
    paths: entry.paths,
  }));
