'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationModal from './NotificationModal';
import {
  Coffee, LayoutDashboard, Users, MapPin,
  Receipt, CalendarCheck, Wallet,
  Settings, LogOut, UtensilsCrossed, Tag, CalendarDays,
  Target, TrendingUp, Crown, Package, Truck,
  Calendar, Bell, Send, History, CreditCard, AlertCircle, Zap, Download,
  Activity, ShieldAlert, ChevronDown, ShieldCheck, UserPlus, Star, Gift, Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  'page_addmember',
  'page_permissions',
  'page_settings',
  'page_cafes',
  'page_users',
  'page_branches',
  'page_auditlogs',
  'page_impersonate',
  'page_admincenter',
]);

// Representative icon for each top-level group row (shown in the rounded square,
// reference-style). Falls back to the group's first item icon for any title not
// listed here, so new groups never render iconless.
const GROUP_ICONS = {
  Main: LayoutDashboard,
  Administration: ShieldCheck,
  Operations: UtensilsCrossed,
  Analytics: TrendingUp,
  Performance: TrendingUp,
  Rewards: Crown,
  'Granted Access': Star,
  System: Settings,
};

const getBranchId = (branch) => {
  if (!branch) return '';
  return (branch._id || branch).toString();
};

const getUserBranchIds = (account) => {
  const ids = [];
  const addBranch = (branch) => {
    const id = getBranchId(branch);
    if (id && !ids.includes(id)) ids.push(id);
  };

  addBranch(account?.assignedLocation);
  (account?.accessibleLocations || []).forEach(addBranch);

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

const Sidebar = ({ isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen, isMobile }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, locations = [] } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(0);

  // Receive-only accounts (sendMessages explicitly false) don't get the composer.
  // Undefined is treated as allowed so accounts predating this field still work.
  const canSendMessages = !!user && (user.role === 'super_admin' || user.permissions?.sendMessages !== false);

  const groups = useMemo(() => {
    if (!user) return [];
    const role = user.role;
    const isSuper = role === 'super_admin';
    // Page-level access: "one toggle = one page". super_admin sees everything;
    // everyone else sees only the pages in their allowedPages list. Replaces the
    // old coarse permission gates so granting e.g. only Salaries shows ONLY Salaries.
    const allowedPages = user.allowedPages || [];
    const canView = (pageKey) => isSuper || allowedPages.includes(pageKey);
    const roleBasePath = getRoleBasePath(role);
    const comparableBranchCount = role === 'super_admin'
      ? (locations.length > 0 ? locations.length : 2)
      : getUserBranchIds(user).length;
    const hasMultipleComparableBranches = comparableBranchCount > 1;

    const groupsList = [];

    // Main Group
    const mainItems = [];
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      if (canView('page_overview')) {
        mainItems.push({
          name: 'Overview',
          pageKey: 'page_overview',
          href: roleBasePath,
          icon: LayoutDashboard
        });
      }
      if (canView('page_branchpresence')) {
        mainItems.push({
          name: 'Branch Presence',
          pageKey: 'page_branchpresence',
          href: '/dashboard/admin/branch-presence',
          icon: ShieldCheck
        });
      }
      if (canView('page_admincenter')) {
        mainItems.push({ name: 'Admin Center', pageKey: 'page_admincenter', href: '/dashboard/super-admin', icon: Zap });
      }
    } else if (role === 'chef') {
      if (canView('page_orders')) mainItems.push({ name: 'Kitchen', pageKey: 'page_orders', href: '/dashboard/chef', icon: UtensilsCrossed });
    } else {
      if (canView('page_overview')) mainItems.push({ name: 'My Dashboard', pageKey: 'page_overview', href: '/dashboard/staff', icon: LayoutDashboard });
      if (canView('page_orders')) mainItems.push({ name: 'New Orders', pageKey: 'page_orders', href: '/dashboard/staff/orders', icon: Receipt });
    }
    if (mainItems.length > 0) groupsList.push({ title: 'Main', items: mainItems });

    // Administration Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const adminItems = [];

      // Add Member -> in-dashboard single-page member form
      if (role !== 'location_admin' && canView('page_addmember')) {
        adminItems.push({ name: 'Add Member', pageKey: 'page_addmember', href: '/dashboard/add-member', icon: UserPlus });
      }

      if (canView('page_users')) {
        adminItems.push({ name: 'Users', pageKey: 'page_users', href: '/dashboard/admin/users', icon: Users });
      }
      if (canView('page_auditlogs')) {
        adminItems.push({ name: 'Security Logs', pageKey: 'page_auditlogs', href: '/dashboard/admin/audit-logs', icon: Activity });
      }

      if (canView('page_impersonate')) {
        adminItems.push({ name: 'Login As Staff', pageKey: 'page_impersonate', href: '/dashboard/admin/impersonate', icon: ShieldAlert });
      }

      if (canView('page_cafes')) {
        // Cafes (brands) sit ABOVE branches. Super-admins manage every cafe;
        // admins manage the branding of the cafe(s) they own.
        adminItems.push({ name: 'Cafes', pageKey: 'page_cafes', href: '/dashboard/admin/cafes', icon: Store });
      }
      if (canView('page_branches')) {
        adminItems.push({ name: 'Branches', pageKey: 'page_branches', href: '/dashboard/admin/locations', icon: MapPin });
      }

      if (canView('page_staff')) adminItems.push({ name: 'Staff', pageKey: 'page_staff', href: `${roleBasePath}/staff`, icon: Users });
      if (canView('page_attendance')) adminItems.push({ name: 'Attendance', pageKey: 'page_attendance', href: `${roleBasePath}/attendance`, icon: CalendarCheck });
      if (canView('page_salaries')) adminItems.push({ name: 'Salaries', pageKey: 'page_salaries', href: getSalaryPath(role), icon: Wallet });

      if (role !== 'location_admin' && canView('page_permissions')) {
        adminItems.push({ name: 'Permissions', pageKey: 'page_permissions', href: `${roleBasePath}/permissions`, icon: ShieldCheck });
      }

      // Settings — tax/billing/payroll/loyalty config (page itself scopes branch access).
      if (canView('page_settings')) {
        adminItems.push({ name: 'Settings', pageKey: 'page_settings', href: '/dashboard/admin/settings', icon: Settings });
      }

      if (adminItems.length > 0) {
        groupsList.push({ title: 'Administration', items: adminItems });
      }
    }

    // Operations Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const opsItems = [];

      if (canView('page_orders')) opsItems.push({ name: 'All Orders', pageKey: 'page_orders', href: '/dashboard/admin/orders', icon: Receipt });
      if (canView('page_reservations')) opsItems.push({ name: 'Reservations', pageKey: 'page_reservations', href: '/dashboard/reservations', icon: CalendarDays });
      if (canView('page_tables')) opsItems.push({ name: 'Tables', pageKey: 'page_tables', href: ['branch_admin', 'location_admin'].includes(role) ? `${roleBasePath}/tables` : '/dashboard/admin/tables', icon: Coffee });
      if (canView('page_menu')) opsItems.push({ name: 'Menu', pageKey: 'page_menu', href: ['branch_admin', 'location_admin'].includes(role) ? `${roleBasePath}/menu` : '/dashboard/admin/menu', icon: UtensilsCrossed });
      if (canView('page_inventory') && role !== 'location_admin') opsItems.push({ name: 'Inventory', pageKey: 'page_inventory', href: '/dashboard/admin/inventory', icon: Package });
      if (canView('page_procurement')) opsItems.push({ name: 'Procurement', pageKey: 'page_procurement', href: '/dashboard/admin/procurement', icon: Truck });
      if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: '/dashboard/admin/cash-drawer', icon: Wallet });
      if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', pageKey: 'page_waitlist', href: '/dashboard/admin/waitlist', icon: Users });
      if (canView('page_coupons')) opsItems.push({ name: 'Offers', pageKey: 'page_coupons', href: '/dashboard/admin/coupons', icon: Tag });
      if (canView('page_giftcards')) opsItems.push({ name: 'Gift Cards', pageKey: 'page_giftcards', href: '/dashboard/admin/gift-cards', icon: Gift });

      if (opsItems.length > 0) {
        groupsList.push({ title: 'Operations', items: opsItems });
      }
    } else {
      const opsItems = [];
      if (role !== 'chef') {
        if (canView('page_tables')) opsItems.push({ name: 'Tables', pageKey: 'page_tables', href: '/dashboard/staff/tables', icon: Coffee });
        if (canView('page_menu')) opsItems.push({ name: 'Menu', pageKey: 'page_menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
        if (canView('page_reservations')) opsItems.push({ name: 'Reservations', pageKey: 'page_reservations', href: '/dashboard/reservations', icon: CalendarDays });
        if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', pageKey: 'page_cashdrawer', href: '/dashboard/staff/cash-drawer', icon: Wallet });
        if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', pageKey: 'page_waitlist', href: '/dashboard/staff/waitlist', icon: Users });
      } else {
        if (canView('page_menu')) opsItems.push({ name: 'Branch Menu', pageKey: 'page_menu', href: '/dashboard/staff/menu', icon: Coffee });
      }
      if (opsItems.length > 0) groupsList.push({ title: 'Operations', items: opsItems });
    }

    // Analytics Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const analyticsItems = [];

      if (canView('page_revenue')) analyticsItems.push({ name: 'Revenue', pageKey: 'page_revenue', href: `${roleBasePath}/revenue`, icon: TrendingUp });
      if (canView('page_expenses')) analyticsItems.push({ name: 'Expenses', pageKey: 'page_expenses', href: `${roleBasePath}/expenses`, icon: Receipt });
      if (canView('page_orderreports')) analyticsItems.push({ name: 'Order Reports', pageKey: 'page_orderreports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp });
      if (canView('page_branchcompare') && hasMultipleComparableBranches) analyticsItems.push({ name: 'Branch Compare', pageKey: 'page_branchcompare', href: '/dashboard/admin/location-comparison', icon: Target });
      if (canView('page_staffreports')) analyticsItems.push({ name: 'Staff Reports', pageKey: 'page_staffreports', href: `${roleBasePath}/staff-reports`, icon: TrendingUp });
      if (canView('page_feedback')) analyticsItems.push({ name: 'Feedback', pageKey: 'page_feedback', href: '/dashboard/admin/feedback', icon: Star });
      if (canView('page_paymentinsights')) analyticsItems.push({ name: 'Payment Insights', pageKey: 'page_paymentinsights', href: '/dashboard/admin/payment-intelligence', icon: CreditCard });
      if (canView('page_alerts')) analyticsItems.push({ name: 'Alerts Overview', pageKey: 'page_alerts', href: '/dashboard/admin/command-center', icon: AlertCircle });
      if (canView('page_forecast')) analyticsItems.push({ name: 'Sales Forecast', pageKey: 'page_forecast', href: '/dashboard/admin/forecasting', icon: TrendingUp });
      if (canView('page_exports')) analyticsItems.push({ name: 'Export Center', pageKey: 'page_exports', href: '/dashboard/admin/exports', icon: Download });

      if (analyticsItems.length > 0) {
        groupsList.push({ title: 'Analytics', items: analyticsItems });
      }
    } else {
      const performanceItems = [];
      if (canView('page_myperformance')) {
        performanceItems.push({ name: 'My Performance', pageKey: 'page_myperformance', href: role === 'chef' ? '/dashboard/chef/performance' : '/dashboard/staff/performance', icon: TrendingUp });
      }
      if (role !== 'chef' && canView('page_workhistory')) {
        performanceItems.push({ name: 'Work History', pageKey: 'page_workhistory', href: '/dashboard/staff/work-history', icon: History });
      }
      if (role !== 'chef' && canView('page_myattendance')) {
        performanceItems.push({ name: 'My Attendance', pageKey: 'page_myattendance', href: '/dashboard/staff/attendance', icon: Calendar });
      }
      if (canView('page_expenses')) {
        performanceItems.push({ name: 'Expenses', pageKey: 'page_expenses', href: role === 'chef' ? '/dashboard/chef/expenses' : '/dashboard/staff/expenses', icon: Receipt });
      }
      if (performanceItems.length > 0) groupsList.push({ title: 'Performance', items: performanceItems });
    }

    // Loyalty Group
    if (canView('page_customers')) {
      groupsList.push({
        title: 'Rewards',
        items: [{ name: 'Customers & CRM', pageKey: 'page_customers', href: '/dashboard/admin/customers', icon: Crown }]
      });
    }

    const visibleHrefs = new Set(groupsList.flatMap(group => group.items.map(item => item.href)));
    const visiblePageKeys = new Set(groupsList.flatMap(group => group.items.map(item => item.pageKey).filter(Boolean)));
    const grantableForRole = ['staff', 'chef'].includes(role)
      ? GRANTABLE_PAGES
      : GRANTABLE_PAGES.filter(p => ROLE_LOCKED_PAGE_KEYS.has(p.pageKey));
    const grantedItems = GRANTABLE_PAGES
      .filter(p => grantableForRole.includes(p))
      .filter(p => !isSuper && canView(p.pageKey) && !visiblePageKeys.has(p.pageKey) && !visibleHrefs.has(p.href))
      .map(({ name, pageKey, href, icon }) => ({ name, pageKey, href, icon }));
    if (grantedItems.length > 0) {
      groupsList.push({ title: 'Granted Access', items: grantedItems });
    }

    // System Group
    groupsList.push({
      title: 'System',
      items: [
        { name: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: unreadCount },
        { name: 'My Profile', href: '/dashboard/profile', icon: Settings },
      ]
    });

    return groupsList;
  }, [user, unreadCount, locations]);

  const allLinks = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const activeHref = useMemo(() => {
    const matches = allLinks
      .filter(link => {
        // Special case for root-ish dashboards to avoid matching everything
        if (link.href === '/dashboard/admin' || link.href === '/dashboard/branch-admin' || link.href === '/dashboard/location-admin' || link.href === '/dashboard/staff') {
          return pathname === link.href;
        }
        return pathname === link.href || pathname.startsWith(link.href + '/');
      })
      .sort((a, b) => b.href.length - a.href.length);
    
    // If no specific match, check for exact matches on those root-ish ones again
    if (matches.length === 0) {
      const exactMatch = allLinks.find(link => pathname === link.href);
      if (exactMatch) return exactMatch.href;
    }

    return matches[0]?.href;
  }, [pathname, allLinks]);

  // Sync open group with current pathname
  useEffect(() => {
    const activeGroup = groups.find(group => 
      group.items.some(link => link.href === activeHref)
    );
    if (activeGroup) {
      const timer = setTimeout(() => {
        setOpenGroup(activeGroup.title);
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [activeHref, groups]);

  const leaveTimeout = useRef(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);

  const currentActiveGroupTitle = useMemo(() => {
    const active = groups.find(group => 
      group.items.some(link => link.href === activeHref)
    );
    return active?.title || null;
  }, [activeHref, groups]);

  const handleGroupInteraction = (e, groupTitle, type = 'hover') => {
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);

    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setFlyoutTop(rect.top);
    }

    if (type === 'click' || type === 'toggle') {
      const group = groups.find(g => g.title === groupTitle);
      if (openGroup === groupTitle) {
        setOpenGroup(null);
      } else {
        setOpenGroup(groupTitle);
      }

      // Navigate to the first submenu item on 'click' type only
      if (type === 'click' && group && group.items.length > 0) {
        router.push(group.items[0].href);
      }
    } else {
      setHoveredGroup(groupTitle);
    }
  };

  const handleMouseLeave = () => {
    leaveTimeout.current = setTimeout(() => {
      setHoveredGroup(null);
    }, 150);
  };

  const showLabels = isExpanded || isMobile;

  // Close the mobile drawer whenever the route changes (tap a link → drawer closes).
  useEffect(() => {
    if (isMobile && isMobileOpen) setIsMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const locked = isMobile && isMobileOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isMobileOpen]);

  const sidebarVariants = {
    expanded: { width: 260, x: 0 },
    collapsed: { width: 80, x: 0 },
    mobileOpen: { width: 280, x: 0 },
    mobileClosed: { width: 280, x: -280 }
  };

  if (!user) return null;

  const content = (
    <div className={`h-full flex flex-col bg-(--color-sidebar-bg) border-r border-(--color-border) transition-colors duration-300 relative`}>
      <NotificationModal isOpen={showNotifModal} onClose={() => setShowNotifModal(false)} />
      {/* Brand Header */}
      <div className={`h-20 flex items-center ${showLabels ? 'px-6' : 'justify-center'} shrink-0 mb-2`}>
        <motion.div layout className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
            <Coffee size={18} strokeWidth={2.5} />
          </div>
          <AnimatePresence mode="wait">
            {showLabels && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="text-lg font-bold tracking-tight text-(--color-text-primary) whitespace-nowrap"
              >
                Cafe<span className="text-primary">OS</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation */}
      <div
        className={`flex-1 py-4 custom-scrollbar ${showLabels ? 'px-3 overflow-y-auto' : 'px-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'}`}
        onMouseLeave={handleMouseLeave}
      >
        <div className="space-y-4">
          {groups.map((group) => {
            const GroupIcon = GROUP_ICONS[group.title] || group.items[0]?.icon || Coffee;
            const isActive = group.items.some(link => link.href === activeHref);
            const isOpen = openGroup === group.title;
            const isHot = isOpen || isActive;

            return (
              <div
                key={group.title}
                className="relative"
                onMouseEnter={(e) => handleGroupInteraction(e, group.title, 'hover')}
              >
                {showLabels ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupInteraction(e, group.title, 'click');
                    }}
                    className={`pl-2 pr-1.5 py-2 flex items-center gap-3 group/header rounded-xl cursor-pointer transition-colors duration-200 ${isOpen ? 'bg-(--color-surface-soft)' : 'hover:bg-(--color-surface-soft)'}`}
                  >
                    <span className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-lg transition-colors ${isHot ? 'bg-(--color-primary-soft) text-primary' : 'text-(--color-text-muted) group-hover/header:text-(--color-text-primary)'}`}>
                      <GroupIcon size={18} strokeWidth={isHot ? 2.5 : 2} />
                    </span>
                    <span
                      className={`flex-1 min-w-0 truncate text-sm font-semibold transition-colors ${isHot ? 'text-(--color-text-primary)' : 'text-(--color-text-secondary) group-hover/header:text-(--color-text-primary)'}`}
                    >
                      {group.title}
                    </span>
                    <motion.div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupInteraction(e, group.title, 'toggle');
                      }}
                      animate={{ rotate: isOpen ? 0 : -90 }}
                      transition={{ duration: 0.2 }}
                      className="p-1 cursor-pointer hover:bg-(--color-hover) rounded-md transition-colors"
                    >
                      <ChevronDown size={16} className={isHot ? 'text-(--color-text-secondary)' : 'text-(--color-text-soft)'} />
                    </motion.div>
                  </div>
                ) : (
                  <div
                    title={group.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupInteraction(e, group.title, 'click');
                    }}
                    className={`h-11 w-11 mx-auto flex items-center justify-center rounded-xl cursor-pointer transition-colors duration-200 ${isHot ? 'bg-primary text-(--color-on-primary)' : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}`}
                  >
                    <GroupIcon size={20} strokeWidth={isHot ? 2.5 : 2} />
                  </div>
                )}

                {/* Inline Dropdown — only when labels are visible (expanded / mobile).
                    In collapsed mode the items are reached via the hover flyout, so
                    we must NOT render this inside the narrow 80px rail. */}
                <AnimatePresence>
                  {showLabels && openGroup === group.title && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 mb-1 ml-6 pl-3 border-l border-(--color-border) space-y-0.5">
                        {group.items.map((link) => {
                          const Icon = link.icon;
                          const isLinkActive = link.href === activeHref;
                          return (
                            <Link
                              key={link.name}
                              href={link.href}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isMobile) setIsMobileOpen(false);
                                setOpenGroup(group.title);
                              }}
                              className={`
                                relative flex items-center gap-2.5 py-2 px-3 rounded-lg transition-colors duration-150
                                ${isLinkActive
                                  ? 'bg-(--color-primary-soft) text-primary font-semibold'
                                  : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}
                              `}
                            >
                              {isLinkActive && (
                                <span className="absolute -left-3.25 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
                              )}
                              <Icon size={16} strokeWidth={isLinkActive ? 2.5 : 2} className="shrink-0" />
                              <span className="text-sm truncate">{link.name}</span>
                              {link.badge > 0 && (
                                <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${isLinkActive ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-primary-soft) text-primary'}`}>
                                  {link.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Send Message Action */}
      {canSendMessages && (
      <div className="px-3 mb-4">
        <button
          onClick={() => setShowNotifModal(true)}
          className={`
            w-full flex items-center gap-3 p-2.5 rounded-xl border border-(--color-border) bg-(--color-surface-soft) hover:bg-(--color-surface) transition-all group
            ${showLabels ? 'justify-start px-3' : 'justify-center'}
          `}
        >
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary transition-transform">
            <Send size={16} />
          </div>
          {showLabels && (
            <span className="text-xs font-bold text-(--color-text-primary)">Send Message</span>
          )}
        </button>
      </div>
      )}

      {/* User Footer */}
      <div className="p-3 mt-auto border-t border-(--color-border)">
        <div className={`flex items-center gap-3 rounded-xl transition-colors ${showLabels ? 'p-2 border border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-soft)' : 'justify-center'}`}>
          <Link href="/dashboard/profile" className="h-9 w-9 rounded-lg bg-(--color-surface-soft) border border-(--color-border) flex items-center justify-center shrink-0 relative group cursor-pointer overflow-hidden">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-primary">{user.name.substring(0, 2).toUpperCase()}</span>
            )}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success border-2 border-(--color-surface) rounded-full" />
          </Link>
          {showLabels && (
            <Link href="/dashboard/profile" className="min-w-0 flex-1 group">
              <p className="text-xs font-bold text-(--color-text-primary) truncate leading-none group-hover:text-primary transition-colors">{user.name}</p>
              <p className="text-[10px] font-medium text-(--color-text-muted) uppercase tracking-wider mt-1 truncate">{user.role === 'branch_admin' || user.role === 'location_admin' ? 'branch admin' : user.role.replace('_', ' ')}</p>
            </Link>
          )}
          {showLabels && (
            <button
              onClick={logout}
              className="p-1.5 shrink-0 text-(--color-text-muted) hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobile && isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/40 z-100"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={isMobile ? (isMobileOpen ? 'mobileOpen' : 'mobileClosed') : (isExpanded ? 'expanded' : 'collapsed')}
        variants={sidebarVariants}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`
          fixed inset-y-0 left-0 z-101 
          lg:static lg:block
        `}
      >
        {content}
      </motion.aside>

      {/* Flyout Portals — on hover. When collapsed, show for EVERY group (incl.
          the active one) so each icon reveals its name/submenu; when expanded,
          keep the original behaviour of previewing only non-active groups. */}
      {!isMobile && (
        <AnimatePresence>
          {hoveredGroup && (showLabels ? hoveredGroup !== currentActiveGroupTitle : true) && (
            <motion.div
              key={hoveredGroup}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: Math.max(20, Math.min(flyoutTop, typeof window !== 'undefined' ? window.innerHeight - ((groups.find(g => g.title === hoveredGroup)?.items.length || 0) * 52 + 80) : flyoutTop)),
                left: showLabels ? 250 : 75,
              }}
              onMouseEnter={() => {
                if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
                setHoveredGroup(hoveredGroup);
              }}
              onMouseLeave={handleMouseLeave}
              className="w-64 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-[var(--shadow-md)] p-3 z-300 space-y-1"
            >
              {(() => {
                const groupData = groups.find(g => g.title === hoveredGroup);
                if (!groupData) return null;
                return (
                  <>
                    <div className="px-3 py-1.5 mb-1 border-b border-(--color-border)">
                      <span className="text-xs font-semibold text-(--color-text-muted)">
                        {groupData.title}
                      </span>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-1 space-y-1">
                      {groupData.items.map((link) => {
                        const Icon = link.icon;
                        const isLinkExactMatch = ['Overview', 'My Dashboard', 'All Orders', 'New Orders', 'Kitchen'].includes(link.name);
                        const isLinkActive = isLinkExactMatch ? pathname === link.href : pathname.startsWith(link.href);

                        return (
                          <Link
                            key={link.name}
                            href={link.href}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isMobile) setIsMobileOpen(false);
                              setHoveredGroup(null);
                              setOpenGroup(groupData.title);
                            }}
                            className={`
                              group/item flex items-center relative py-2.5 px-3 rounded-lg transition-colors duration-150
                              ${isLinkActive
                                ? 'bg-(--color-primary-soft) text-primary font-semibold'
                                : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}
                            `}
                          >
                            {isLinkActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-primary" />
                            )}
                            <div className="relative z-10 flex items-center w-full">
                              <Icon size={18} strokeWidth={isLinkActive ? 2.5 : 2} className="shrink-0" />
                              <span className="ml-3 text-sm whitespace-nowrap flex-1">{link.name}</span>
                              {link.badge > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${isLinkActive ? 'bg-primary text-(--color-on-primary)' : 'bg-(--color-primary-soft) text-primary'}`}>
                                  {link.badge}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
};

export default Sidebar;
