// Pure navigation logic — NO React, NO context imports, so it can be used from
// AuthContext (login redirects), the dashboard layout guard, and the
// useNavGroups hook without circular imports.
//
// buildNavGroups(user, { locations, unreadCount }) returns the grouped nav the
// user may reach; getLandingPath(user, locations) returns where they land by
// default: Overview when they can open it, otherwise the first item of the
// first sidebar group, profile as a last resort.

import { routeForPage } from './routes';
import { canViewPage } from './pages';
import {
  Coffee, LayoutDashboard, Users, MapPin, Receipt, CalendarCheck, Wallet,
  Settings, UtensilsCrossed, Tag, CalendarDays, Target, TrendingUp, Crown,
  Package, Truck, Calendar, Bell, History, CreditCard, AlertCircle, Zap,
  Download, Activity, ShieldAlert, ShieldCheck, UserPlus, Star, Gift, Store,
} from 'lucide-react';

// Pages that can be GRANTED to a user beyond their role defaults. Display name +
// icon only — hrefs come from the shared route registry (config/routes.js).
const GRANTABLE_PAGES = [
  { name: 'Overview', pageKey: 'page_overview', icon: LayoutDashboard },
  { name: 'Branch Presence', pageKey: 'page_branchpresence', icon: ShieldCheck },
  { name: 'Users', pageKey: 'page_users', icon: Users },
  { name: 'Staff', pageKey: 'page_staff', icon: Users },
  { name: 'Attendance', pageKey: 'page_attendance', icon: CalendarCheck },
  { name: 'Salaries', pageKey: 'page_salaries', icon: Wallet },
  { name: 'All Orders', pageKey: 'page_orders', icon: Receipt },
  { name: 'Reservations', pageKey: 'page_reservations', icon: CalendarDays },
  { name: 'Tables', pageKey: 'page_tables', icon: Coffee },
  { name: 'Menu', pageKey: 'page_menu', icon: UtensilsCrossed },
  { name: 'Inventory', pageKey: 'page_inventory', icon: Package },
  { name: 'Procurement', pageKey: 'page_procurement', icon: Truck },
  { name: 'Cash Drawer', pageKey: 'page_cashdrawer', icon: Wallet },
  { name: 'Waitlist', pageKey: 'page_waitlist', icon: Users },
  { name: 'Offers', pageKey: 'page_coupons', icon: Tag },
  { name: 'Gift Cards', pageKey: 'page_giftcards', icon: Gift },
  { name: 'Revenue', pageKey: 'page_revenue', icon: TrendingUp },
  { name: 'Expenses', pageKey: 'page_expenses', icon: Receipt },
  { name: 'Order Reports', pageKey: 'page_orderreports', icon: TrendingUp },
  { name: 'Staff Reports', pageKey: 'page_staffreports', icon: TrendingUp },
  { name: 'Feedback', pageKey: 'page_feedback', icon: Star },
  { name: 'Customers & CRM', pageKey: 'page_customers', icon: Crown },
  { name: 'Branch Compare', pageKey: 'page_branchcompare', icon: Target },
  { name: 'Payment Insights', pageKey: 'page_paymentinsights', icon: CreditCard },
  { name: 'Alerts Overview', pageKey: 'page_alerts', icon: AlertCircle },
  { name: 'Sales Forecast', pageKey: 'page_forecast', icon: TrendingUp },
  { name: 'Export Center', pageKey: 'page_exports', icon: Download },
  { name: 'My Performance', pageKey: 'page_myperformance', icon: TrendingUp },
  { name: 'Work History', pageKey: 'page_workhistory', icon: History },
  { name: 'My Attendance', pageKey: 'page_myattendance', icon: Calendar },
  { name: 'Add Member', pageKey: 'page_addmember', icon: UserPlus },
  { name: 'Permissions', pageKey: 'page_permissions', icon: ShieldCheck },
  { name: 'Settings', pageKey: 'page_settings', icon: Settings },
  { name: 'Cafes', pageKey: 'page_cafes', icon: Store },
  { name: 'Branches', pageKey: 'page_branches', icon: MapPin },
  { name: 'Security Logs', pageKey: 'page_auditlogs', icon: Activity },
  { name: 'Login As Staff', pageKey: 'page_impersonate', icon: ShieldAlert },
  { name: 'Admin Center', pageKey: 'page_admincenter', icon: Zap },
];

const ROLE_LOCKED_PAGE_KEYS = new Set([
  'page_addmember', 'page_permissions', 'page_settings', 'page_cafes',
  'page_users', 'page_branches', 'page_auditlogs', 'page_impersonate', 'page_admincenter',
]);

const getBranchId = (branch) => (branch ? (branch._id || branch).toString() : '');

const getUserBranchIds = (account) => {
  const ids = [];
  const add = (b) => { const id = getBranchId(b); if (id && !ids.includes(id)) ids.push(id); };
  add(account?.assignedLocation);
  (account?.accessibleLocations || []).forEach(add);
  return ids;
};

export function buildNavGroups(user, { locations = [], unreadCount = 0 } = {}) {
  if (!user) return [];
  const role = user.role;
  const isSuper = role === 'super_admin';
  const allowedPages = user.allowedPages || [];
  const canView = (pageKey) => isSuper || allowedPages.includes(pageKey);
  const r = (pageKey) => routeForPage(role, pageKey);
  const comparableBranchCount = role === 'super_admin'
    ? (locations.length > 0 ? locations.length : 2)
    : getUserBranchIds(user).length;
  const hasMultipleComparableBranches = comparableBranchCount > 1;

  const groupsList = [];

  // Main
  const mainItems = [];
  if (['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(role)) {
    if (canView('page_overview')) mainItems.push({ name: 'Overview', pageKey: 'page_overview', href: r('page_overview'), icon: LayoutDashboard });
    if (canView('page_branchpresence')) mainItems.push({ name: 'Branch Presence', pageKey: 'page_branchpresence', href: r('page_branchpresence'), icon: ShieldCheck });
    if (canView('page_admincenter')) mainItems.push({ name: 'Admin Center', pageKey: 'page_admincenter', href: r('page_admincenter'), icon: Zap });
  } else if (role === 'chef') {
    if (canView('page_orders')) mainItems.push({ name: 'Kitchen', pageKey: 'page_orders', href: r('page_orders'), icon: UtensilsCrossed });
  } else {
    if (canView('page_overview')) mainItems.push({ name: 'My Dashboard', pageKey: 'page_overview', href: r('page_overview'), icon: LayoutDashboard });
    if (canView('page_orders')) mainItems.push({ name: 'New Orders', pageKey: 'page_orders', href: r('page_orders'), icon: Receipt });
  }
  if (mainItems.length > 0) groupsList.push({ title: 'Main', items: mainItems });

  const isManager = ['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(role);
  const pushGroup = (title, items) => { if (items.length > 0) groupsList.push({ title, items }); };

  if (isManager) {
    const peopleItems = [];
    if (role !== 'location_admin' && canView('page_addmember')) peopleItems.push({ name: 'Add Member', pageKey: 'page_addmember', href: r('page_addmember'), icon: UserPlus });
    if (canView('page_users')) peopleItems.push({ name: 'Users', pageKey: 'page_users', href: r('page_users'), icon: Users });
    if (canView('page_staff')) peopleItems.push({ name: 'Staff', pageKey: 'page_staff', href: r('page_staff'), icon: Users });
    if (canView('page_attendance')) peopleItems.push({ name: 'Attendance', pageKey: 'page_attendance', href: r('page_attendance'), icon: CalendarCheck });
    if (canView('page_salaries')) peopleItems.push({ name: 'Salaries', pageKey: 'page_salaries', href: r('page_salaries'), icon: Wallet });
    pushGroup('People', peopleItems);

    const opsItems = [];
    if (canView('page_orders')) opsItems.push({ name: 'All Orders', pageKey: 'page_orders', href: r('page_orders'), icon: Receipt });
    if (canView('page_tables')) opsItems.push({ name: 'Tables', pageKey: 'page_tables', href: r('page_tables'), icon: Coffee });
    if (canView('page_menu')) opsItems.push({ name: 'Menu', pageKey: 'page_menu', href: r('page_menu'), icon: UtensilsCrossed });
    if (canView('page_reservations')) opsItems.push({ name: 'Reservations', pageKey: 'page_reservations', href: r('page_reservations'), icon: CalendarDays });
    if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', pageKey: 'page_waitlist', href: r('page_waitlist'), icon: Users });
    if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: r('page_cashdrawer'), icon: Wallet });
    pushGroup('Operations', opsItems);

    const invItems = [];
    if (canView('page_inventory') && role !== 'location_admin') invItems.push({ name: 'Inventory', pageKey: 'page_inventory', href: r('page_inventory'), icon: Package });
    if (canView('page_procurement')) invItems.push({ name: 'Procurement', pageKey: 'page_procurement', href: r('page_procurement'), icon: Truck });
    pushGroup('Inventory', invItems);

    const mktItems = [];
    if (canView('page_coupons')) mktItems.push({ name: 'Offers', pageKey: 'page_coupons', href: r('page_coupons'), icon: Tag });
    if (canView('page_giftcards')) mktItems.push({ name: 'Gift Cards', pageKey: 'page_giftcards', href: r('page_giftcards'), icon: Gift });
    if (canView('page_customers')) mktItems.push({ name: 'Customers & CRM', pageKey: 'page_customers', href: r('page_customers'), icon: Crown });
    if (canView('page_feedback')) mktItems.push({ name: 'Feedback', pageKey: 'page_feedback', href: r('page_feedback'), icon: Star });
    pushGroup('Marketing', mktItems);

    const finItems = [];
    if (canView('page_revenue')) finItems.push({ name: 'Revenue', pageKey: 'page_revenue', href: r('page_revenue'), icon: TrendingUp });
    if (canView('page_expenses')) finItems.push({ name: 'Expenses', pageKey: 'page_expenses', href: r('page_expenses'), icon: Receipt });
    if (canView('page_paymentinsights')) finItems.push({ name: 'Payment Insights', pageKey: 'page_paymentinsights', href: r('page_paymentinsights'), icon: CreditCard });
    pushGroup('Finance', finItems);

    const repItems = [];
    if (canView('page_orderreports')) repItems.push({ name: 'Order Reports', pageKey: 'page_orderreports', href: r('page_orderreports'), icon: TrendingUp });
    if (canView('page_staffreports')) repItems.push({ name: 'Staff Reports', pageKey: 'page_staffreports', href: r('page_staffreports'), icon: TrendingUp });
    if (canView('page_staffcomparison')) repItems.push({ name: 'Staff Comparison', pageKey: 'page_staffcomparison', href: r('page_staffcomparison'), icon: Users });
    if (canView('page_branchcompare') && hasMultipleComparableBranches) repItems.push({ name: 'Branch Compare', pageKey: 'page_branchcompare', href: r('page_branchcompare'), icon: Target });
    if (canView('page_forecast')) repItems.push({ name: 'Sales Forecast', pageKey: 'page_forecast', href: r('page_forecast'), icon: TrendingUp });
    if (canView('page_alerts')) repItems.push({ name: 'Alerts Overview', pageKey: 'page_alerts', href: r('page_alerts'), icon: AlertCircle });
    if (canView('page_exports')) repItems.push({ name: 'Export Center', pageKey: 'page_exports', href: r('page_exports'), icon: Download });
    pushGroup('Reports', repItems);

    const setupItems = [];
    if (canView('page_cafes')) setupItems.push({ name: 'Cafes', pageKey: 'page_cafes', href: r('page_cafes'), icon: Store });
    if (canView('page_branches')) setupItems.push({ name: 'Branches', pageKey: 'page_branches', href: r('page_branches'), icon: MapPin });
    if (role !== 'location_admin' && canView('page_permissions')) setupItems.push({ name: 'Permissions', pageKey: 'page_permissions', href: r('page_permissions'), icon: ShieldCheck });
    if (canView('page_settings')) setupItems.push({ name: 'Settings', pageKey: 'page_settings', href: r('page_settings'), icon: Settings });
    if (canView('page_auditlogs')) setupItems.push({ name: 'Security Logs', pageKey: 'page_auditlogs', href: r('page_auditlogs'), icon: Activity });
    if (canView('page_impersonate')) setupItems.push({ name: 'Login As Staff', pageKey: 'page_impersonate', href: r('page_impersonate'), icon: ShieldAlert });
    pushGroup('Setup', setupItems);
  } else {
    const opsItems = [];
    if (role !== 'chef') {
      if (canView('page_tables')) opsItems.push({ name: 'Tables', pageKey: 'page_tables', href: r('page_tables'), icon: Coffee });
      if (canView('page_menu')) opsItems.push({ name: 'Menu', pageKey: 'page_menu', href: r('page_menu'), icon: UtensilsCrossed });
      if (canView('page_reservations')) opsItems.push({ name: 'Reservations', pageKey: 'page_reservations', href: r('page_reservations'), icon: CalendarDays });
      if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: r('page_cashdrawer'), icon: Wallet });
      if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', pageKey: 'page_waitlist', href: r('page_waitlist'), icon: Users });
    } else if (canView('page_menu')) {
      opsItems.push({ name: 'Branch Menu', pageKey: 'page_menu', href: r('page_menu'), icon: Coffee });
    }
    pushGroup('Operations', opsItems);

    const performanceItems = [];
    if (canView('page_myperformance')) performanceItems.push({ name: 'My Performance', pageKey: 'page_myperformance', href: r('page_myperformance'), icon: TrendingUp });
    if (role !== 'chef' && canView('page_workhistory')) performanceItems.push({ name: 'Work History', pageKey: 'page_workhistory', href: r('page_workhistory'), icon: History });
    if (role !== 'chef' && canView('page_myattendance')) performanceItems.push({ name: 'My Attendance', pageKey: 'page_myattendance', href: r('page_myattendance'), icon: Calendar });
    if (canView('page_expenses')) performanceItems.push({ name: 'Expenses', pageKey: 'page_expenses', href: r('page_expenses'), icon: Receipt });
    pushGroup('Performance', performanceItems);
  }

  const visibleHrefs = new Set(groupsList.flatMap((g) => g.items.map((i) => i.href)));
  const visiblePageKeys = new Set(groupsList.flatMap((g) => g.items.map((i) => i.pageKey).filter(Boolean)));
  const grantableForRole = ['staff', 'chef'].includes(role)
    ? GRANTABLE_PAGES
    : GRANTABLE_PAGES.filter((p) => ROLE_LOCKED_PAGE_KEYS.has(p.pageKey));
  const grantedItems = GRANTABLE_PAGES
    .filter((p) => grantableForRole.includes(p))
    .map((p) => ({ ...p, href: r(p.pageKey) }))
    .filter((p) => !isSuper && canView(p.pageKey) && !visiblePageKeys.has(p.pageKey) && !visibleHrefs.has(p.href))
    .map(({ name, pageKey, href, icon }) => ({ name, pageKey, href, icon }));
  if (grantedItems.length > 0) groupsList.push({ title: 'Granted Access', items: grantedItems });

  groupsList.push({
    title: 'System',
    items: [
      { name: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: unreadCount },
      { name: 'My Profile', href: '/dashboard/profile', icon: Settings },
    ],
  });

  return groupsList;
}

// Default landing page: Overview when the user can open it; otherwise the first
// item of the first sidebar group (System excluded — Notifications/Profile are
// not a home); profile as the last resort. Used on login, on sidebar-logo
// click, and by the layout guard's access fallback.
export function getLandingPath(user, locations = []) {
  if (!user) return '/login';
  if (canViewPage(user, 'page_overview')) return routeForPage(user.role, 'page_overview');
  const groups = buildNavGroups(user, { locations });
  const firstGroup = groups.find((g) => g.title !== 'System' && g.items.length > 0);
  return firstGroup?.items[0]?.href || '/dashboard/profile';
}
