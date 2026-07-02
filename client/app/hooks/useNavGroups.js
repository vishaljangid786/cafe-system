'use client';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Coffee, LayoutDashboard, Users, MapPin, Receipt, CalendarCheck, Wallet,
  Settings, UtensilsCrossed, Tag, CalendarDays, Target, TrendingUp, Crown,
  Package, Truck, Calendar, Bell, History, CreditCard, AlertCircle, Zap,
  Download, Activity, ShieldAlert, ShieldCheck, UserPlus, Star, Gift, Store,
} from 'lucide-react';

// Pages that can be GRANTED to a user beyond their role defaults. Mirrors the
// sidebar; used to surface "Granted Access" items.
const GRANTABLE_PAGES = [
  { name: 'Overview', pageKey: 'page_overview', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Branch Presence', pageKey: 'page_branchpresence', href: '/dashboard/admin/branch-presence', icon: ShieldCheck },
  { name: 'Users', pageKey: 'page_users', href: '/dashboard/admin/users', icon: Users },
  { name: 'Staff', pageKey: 'page_staff', href: '/dashboard/admin/staff', icon: Users },
  { name: 'Attendance', pageKey: 'page_attendance', href: '/dashboard/admin/attendance', icon: CalendarCheck },
  { name: 'Salaries', pageKey: 'page_salaries', href: '/dashboard/admin/payroll', icon: Wallet },
  { name: 'All Orders', pageKey: 'page_orders', href: '/dashboard/admin/orders', icon: Receipt },
  { name: 'Reservations', pageKey: 'page_reservations', href: '/dashboard/reservations', icon: CalendarDays },
  { name: 'Tables', pageKey: 'page_tables', href: '/dashboard/admin/tables', icon: Coffee },
  { name: 'Menu', pageKey: 'page_menu', href: '/dashboard/admin/menu', icon: UtensilsCrossed },
  { name: 'Inventory', pageKey: 'page_inventory', href: '/dashboard/admin/inventory', icon: Package },
  { name: 'Procurement', pageKey: 'page_procurement', href: '/dashboard/admin/procurement', icon: Truck },
  { name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: '/dashboard/admin/cash-drawer', icon: Wallet },
  { name: 'Waitlist', pageKey: 'page_waitlist', href: '/dashboard/admin/waitlist', icon: Users },
  { name: 'Offers', pageKey: 'page_coupons', href: '/dashboard/admin/coupons', icon: Tag },
  { name: 'Gift Cards', pageKey: 'page_giftcards', href: '/dashboard/admin/gift-cards', icon: Gift },
  { name: 'Revenue', pageKey: 'page_revenue', href: '/dashboard/admin/revenue', icon: TrendingUp },
  { name: 'Expenses', pageKey: 'page_expenses', href: '/dashboard/admin/expenses', icon: Receipt },
  { name: 'Order Reports', pageKey: 'page_orderreports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp },
  { name: 'Staff Reports', pageKey: 'page_staffreports', href: '/dashboard/admin/staff-reports', icon: TrendingUp },
  { name: 'Feedback', pageKey: 'page_feedback', href: '/dashboard/admin/feedback', icon: Star },
  { name: 'Customers & CRM', pageKey: 'page_customers', href: '/dashboard/admin/customers', icon: Crown },
  { name: 'Branch Compare', pageKey: 'page_branchcompare', href: '/dashboard/admin/location-comparison', icon: Target },
  { name: 'Payment Insights', pageKey: 'page_paymentinsights', href: '/dashboard/admin/payment-intelligence', icon: CreditCard },
  { name: 'Alerts Overview', pageKey: 'page_alerts', href: '/dashboard/admin/command-center', icon: AlertCircle },
  { name: 'Sales Forecast', pageKey: 'page_forecast', href: '/dashboard/admin/forecasting', icon: TrendingUp },
  { name: 'Export Center', pageKey: 'page_exports', href: '/dashboard/admin/exports', icon: Download },
  { name: 'My Performance', pageKey: 'page_myperformance', href: '/dashboard/staff/performance', icon: TrendingUp },
  { name: 'Work History', pageKey: 'page_workhistory', href: '/dashboard/staff/work-history', icon: History },
  { name: 'My Attendance', pageKey: 'page_myattendance', href: '/dashboard/staff/attendance', icon: Calendar },
  { name: 'Add Member', pageKey: 'page_addmember', href: '/dashboard/add-member', icon: UserPlus },
  { name: 'Permissions', pageKey: 'page_permissions', href: '/dashboard/admin/permissions', icon: ShieldCheck },
  { name: 'Settings', pageKey: 'page_settings', href: '/dashboard/admin/settings', icon: Settings },
  { name: 'Cafes', pageKey: 'page_cafes', href: '/dashboard/admin/cafes', icon: Store },
  { name: 'Branches', pageKey: 'page_branches', href: '/dashboard/admin/locations', icon: MapPin },
  { name: 'Security Logs', pageKey: 'page_auditlogs', href: '/dashboard/admin/audit-logs', icon: Activity },
  { name: 'Login As Staff', pageKey: 'page_impersonate', href: '/dashboard/admin/impersonate', icon: ShieldAlert },
  { name: 'Admin Center', pageKey: 'page_admincenter', href: '/dashboard/super-admin', icon: Zap },
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

const getRoleBasePath = (role) => {
  if (role === 'super_admin' || role === 'admin') return '/dashboard/admin';
  if (role === 'location_admin') return '/dashboard/location-admin';
  return '/dashboard/branch-admin';
};

const getSalaryPath = (role) => {
  if (role === 'branch_admin') return '/dashboard/branch-admin/salary';
  if (role === 'location_admin') return '/dashboard/location-admin/salary';
  return '/dashboard/admin/payroll';
};

// Single source of truth for the navigation the CURRENT user may reach — the
// exact same access rules the sidebar renders. Returns grouped nav items; the
// command palette flattens this so it can never show a page the user can't open.
export default function useNavGroups() {
  const { user, locations = [] } = useAuth();
  const { unreadCount } = useNotifications();

  return useMemo(() => {
    if (!user) return [];
    const role = user.role;
    const isSuper = role === 'super_admin';
    const allowedPages = user.allowedPages || [];
    const canView = (pageKey) => isSuper || allowedPages.includes(pageKey);
    const roleBasePath = getRoleBasePath(role);
    const comparableBranchCount = role === 'super_admin'
      ? (locations.length > 0 ? locations.length : 2)
      : getUserBranchIds(user).length;
    const hasMultipleComparableBranches = comparableBranchCount > 1;

    const groupsList = [];

    // Main
    const mainItems = [];
    if (['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(role)) {
      if (canView('page_overview')) mainItems.push({ name: 'Overview', pageKey: 'page_overview', href: roleBasePath, icon: LayoutDashboard });
      if (canView('page_branchpresence')) mainItems.push({ name: 'Branch Presence', pageKey: 'page_branchpresence', href: '/dashboard/admin/branch-presence', icon: ShieldCheck });
      if (canView('page_admincenter')) mainItems.push({ name: 'Admin Center', pageKey: 'page_admincenter', href: '/dashboard/super-admin', icon: Zap });
    } else if (role === 'chef') {
      if (canView('page_orders')) mainItems.push({ name: 'Kitchen', pageKey: 'page_orders', href: '/dashboard/chef', icon: UtensilsCrossed });
    } else {
      if (canView('page_overview')) mainItems.push({ name: 'My Dashboard', pageKey: 'page_overview', href: '/dashboard/staff', icon: LayoutDashboard });
      if (canView('page_orders')) mainItems.push({ name: 'New Orders', pageKey: 'page_orders', href: '/dashboard/staff/orders', icon: Receipt });
    }
    if (mainItems.length > 0) groupsList.push({ title: 'Main', items: mainItems });

    const isManager = ['super_admin', 'admin', 'branch_admin', 'location_admin'].includes(role);
    const tablesHref = ['branch_admin', 'location_admin'].includes(role) ? `${roleBasePath}/tables` : '/dashboard/admin/tables';
    const menuHref = ['branch_admin', 'location_admin'].includes(role) ? `${roleBasePath}/menu` : '/dashboard/admin/menu';
    const pushGroup = (title, items) => { if (items.length > 0) groupsList.push({ title, items }); };

    if (isManager) {
      const peopleItems = [];
      if (role !== 'location_admin' && canView('page_addmember')) peopleItems.push({ name: 'Add Member', pageKey: 'page_addmember', href: '/dashboard/add-member', icon: UserPlus });
      if (canView('page_users')) peopleItems.push({ name: 'Users', pageKey: 'page_users', href: '/dashboard/admin/users', icon: Users });
      if (canView('page_staff')) peopleItems.push({ name: 'Staff', pageKey: 'page_staff', href: `${roleBasePath}/staff`, icon: Users });
      if (canView('page_attendance')) peopleItems.push({ name: 'Attendance', pageKey: 'page_attendance', href: `${roleBasePath}/attendance`, icon: CalendarCheck });
      if (canView('page_salaries')) peopleItems.push({ name: 'Salaries', pageKey: 'page_salaries', href: getSalaryPath(role), icon: Wallet });
      pushGroup('People', peopleItems);

      const opsItems = [];
      if (canView('page_orders')) opsItems.push({ name: 'All Orders', pageKey: 'page_orders', href: '/dashboard/admin/orders', icon: Receipt });
      if (canView('page_tables')) opsItems.push({ name: 'Tables', pageKey: 'page_tables', href: tablesHref, icon: Coffee });
      if (canView('page_menu')) opsItems.push({ name: 'Menu', pageKey: 'page_menu', href: menuHref, icon: UtensilsCrossed });
      if (canView('page_reservations')) opsItems.push({ name: 'Reservations', pageKey: 'page_reservations', href: '/dashboard/reservations', icon: CalendarDays });
      if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', pageKey: 'page_waitlist', href: '/dashboard/admin/waitlist', icon: Users });
      if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: '/dashboard/admin/cash-drawer', icon: Wallet });
      pushGroup('Operations', opsItems);

      const invItems = [];
      if (canView('page_inventory') && role !== 'location_admin') invItems.push({ name: 'Inventory', pageKey: 'page_inventory', href: '/dashboard/admin/inventory', icon: Package });
      if (canView('page_procurement')) invItems.push({ name: 'Procurement', pageKey: 'page_procurement', href: '/dashboard/admin/procurement', icon: Truck });
      pushGroup('Inventory', invItems);

      const mktItems = [];
      if (canView('page_coupons')) mktItems.push({ name: 'Offers', pageKey: 'page_coupons', href: '/dashboard/admin/coupons', icon: Tag });
      if (canView('page_giftcards')) mktItems.push({ name: 'Gift Cards', pageKey: 'page_giftcards', href: '/dashboard/admin/gift-cards', icon: Gift });
      if (canView('page_customers')) mktItems.push({ name: 'Customers & CRM', pageKey: 'page_customers', href: '/dashboard/admin/customers', icon: Crown });
      if (canView('page_feedback')) mktItems.push({ name: 'Feedback', pageKey: 'page_feedback', href: '/dashboard/admin/feedback', icon: Star });
      pushGroup('Marketing', mktItems);

      const finItems = [];
      if (canView('page_revenue')) finItems.push({ name: 'Revenue', pageKey: 'page_revenue', href: `${roleBasePath}/revenue`, icon: TrendingUp });
      if (canView('page_expenses')) finItems.push({ name: 'Expenses', pageKey: 'page_expenses', href: `${roleBasePath}/expenses`, icon: Receipt });
      if (canView('page_paymentinsights')) finItems.push({ name: 'Payment Insights', pageKey: 'page_paymentinsights', href: '/dashboard/admin/payment-intelligence', icon: CreditCard });
      pushGroup('Finance', finItems);

      const repItems = [];
      if (canView('page_orderreports')) repItems.push({ name: 'Order Reports', pageKey: 'page_orderreports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp });
      if (canView('page_staffreports')) repItems.push({ name: 'Staff Reports', pageKey: 'page_staffreports', href: `${roleBasePath}/staff-reports`, icon: TrendingUp });
      if (canView('page_staffcomparison')) repItems.push({ name: 'Staff Comparison', pageKey: 'page_staffcomparison', href: `${roleBasePath}/staff-comparison`, icon: Users });
      if (canView('page_branchcompare') && hasMultipleComparableBranches) repItems.push({ name: 'Branch Compare', pageKey: 'page_branchcompare', href: '/dashboard/admin/location-comparison', icon: Target });
      if (canView('page_forecast')) repItems.push({ name: 'Sales Forecast', pageKey: 'page_forecast', href: '/dashboard/admin/forecasting', icon: TrendingUp });
      if (canView('page_alerts')) repItems.push({ name: 'Alerts Overview', pageKey: 'page_alerts', href: '/dashboard/admin/command-center', icon: AlertCircle });
      if (canView('page_exports')) repItems.push({ name: 'Export Center', pageKey: 'page_exports', href: '/dashboard/admin/exports', icon: Download });
      pushGroup('Reports', repItems);

      const setupItems = [];
      if (canView('page_cafes')) setupItems.push({ name: 'Cafes', pageKey: 'page_cafes', href: '/dashboard/admin/cafes', icon: Store });
      if (canView('page_branches')) setupItems.push({ name: 'Branches', pageKey: 'page_branches', href: '/dashboard/admin/locations', icon: MapPin });
      if (role !== 'location_admin' && canView('page_permissions')) setupItems.push({ name: 'Permissions', pageKey: 'page_permissions', href: `${roleBasePath}/permissions`, icon: ShieldCheck });
      if (canView('page_settings')) setupItems.push({ name: 'Settings', pageKey: 'page_settings', href: '/dashboard/admin/settings', icon: Settings });
      if (canView('page_auditlogs')) setupItems.push({ name: 'Security Logs', pageKey: 'page_auditlogs', href: '/dashboard/admin/audit-logs', icon: Activity });
      if (canView('page_impersonate')) setupItems.push({ name: 'Login As Staff', pageKey: 'page_impersonate', href: '/dashboard/admin/impersonate', icon: ShieldAlert });
      pushGroup('Setup', setupItems);
    } else {
      const opsItems = [];
      if (role !== 'chef') {
        if (canView('page_tables')) opsItems.push({ name: 'Tables', pageKey: 'page_tables', href: '/dashboard/staff/tables', icon: Coffee });
        if (canView('page_menu')) opsItems.push({ name: 'Menu', pageKey: 'page_menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
        if (canView('page_reservations')) opsItems.push({ name: 'Reservations', pageKey: 'page_reservations', href: '/dashboard/reservations', icon: CalendarDays });
        if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: '/dashboard/staff/cash-drawer', icon: Wallet });
        if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', pageKey: 'page_waitlist', href: '/dashboard/staff/waitlist', icon: Users });
      } else if (canView('page_menu')) {
        opsItems.push({ name: 'Branch Menu', pageKey: 'page_menu', href: '/dashboard/staff/menu', icon: Coffee });
      }
      pushGroup('Operations', opsItems);

      const performanceItems = [];
      if (canView('page_myperformance')) performanceItems.push({ name: 'My Performance', pageKey: 'page_myperformance', href: role === 'chef' ? '/dashboard/chef/performance' : '/dashboard/staff/performance', icon: TrendingUp });
      if (role !== 'chef' && canView('page_workhistory')) performanceItems.push({ name: 'Work History', pageKey: 'page_workhistory', href: '/dashboard/staff/work-history', icon: History });
      if (role !== 'chef' && canView('page_myattendance')) performanceItems.push({ name: 'My Attendance', pageKey: 'page_myattendance', href: '/dashboard/staff/attendance', icon: Calendar });
      if (canView('page_expenses')) performanceItems.push({ name: 'Expenses', pageKey: 'page_expenses', href: role === 'chef' ? '/dashboard/chef/expenses' : '/dashboard/staff/expenses', icon: Receipt });
      pushGroup('Performance', performanceItems);
    }

    const visibleHrefs = new Set(groupsList.flatMap((g) => g.items.map((i) => i.href)));
    const visiblePageKeys = new Set(groupsList.flatMap((g) => g.items.map((i) => i.pageKey).filter(Boolean)));
    const grantableForRole = ['staff', 'chef'].includes(role)
      ? GRANTABLE_PAGES
      : GRANTABLE_PAGES.filter((p) => ROLE_LOCKED_PAGE_KEYS.has(p.pageKey));
    const grantedItems = GRANTABLE_PAGES
      .filter((p) => grantableForRole.includes(p))
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
  }, [user, unreadCount, locations]);
}
