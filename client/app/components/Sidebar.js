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

// Role-locked pages that don't appear in the main page-by-page nav (which is built
// from allowedPages via canView). For a NON-default role that has been granted one
// of these (allowedPages contains its pageKey), we surface it under "Granted Access".
// `defaultRoles` = roles that already see the page through their normal menu.
const ROLE_LOCKED_PAGES = [
  { name: 'Users',         href: '/dashboard/admin/users',      icon: Users,       pageKey: 'page_users',       defaultRoles: ['super_admin'] },
  { name: 'Branches',      href: '/dashboard/admin/locations',  icon: MapPin,      pageKey: 'page_branches',    defaultRoles: ['super_admin', 'admin'] },
  { name: 'Security Logs', href: '/dashboard/admin/audit-logs', icon: Activity,    pageKey: 'page_auditlogs',   defaultRoles: ['super_admin'] },
  { name: 'Login As Staff',href: '/dashboard/admin/impersonate',icon: ShieldAlert, pageKey: 'page_impersonate', defaultRoles: ['super_admin'] },
  { name: 'Admin Center',  href: '/dashboard/super-admin',      icon: Zap,         pageKey: 'page_admincenter', defaultRoles: ['super_admin'] },
];

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
      mainItems.push({ 
        name: 'Overview', 
        href: roleBasePath,
        icon: LayoutDashboard 
      });
      mainItems.push({ 
        name: 'Branch Presence', 
        href: '/dashboard/admin/branch-presence', 
        icon: ShieldCheck 
      });
      if (role === 'super_admin') {
        mainItems.push({ name: 'Admin Center', href: '/dashboard/super-admin', icon: Zap });
      }
    } else if (role === 'chef') {
      mainItems.push({ name: 'Kitchen', href: '/dashboard/chef', icon: UtensilsCrossed });
    } else {
      mainItems.push({ name: 'My Dashboard', href: '/dashboard/staff', icon: LayoutDashboard });
      mainItems.push({ name: 'New Orders', href: '/dashboard/staff/orders', icon: Receipt });
    }
    groupsList.push({ title: 'Main', items: mainItems });

    // Administration Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const adminItems = [];

      // Add Member -> in-dashboard single-page member form
      if (role !== 'location_admin') {
        adminItems.push({ name: 'Add Member', href: '/dashboard/add-member', icon: UserPlus });
      }

      if (role === 'super_admin') {
        adminItems.push({ name: 'Users', href: '/dashboard/admin/users', icon: Users });
        adminItems.push({ name: 'Security Logs', href: '/dashboard/admin/audit-logs', icon: Activity });
      }

      if (role === 'super_admin') {
        adminItems.push({ name: 'Login As Staff', href: '/dashboard/admin/impersonate', icon: ShieldAlert });
      }

      if (role === 'super_admin' || role === 'admin') {
        // Cafes (brands) sit ABOVE branches. Super-admins manage every cafe;
        // admins manage the branding of the cafe(s) they own.
        adminItems.push({ name: 'Cafes', href: '/dashboard/admin/cafes', icon: Store });
        adminItems.push({ name: 'Branches', href: '/dashboard/admin/locations', icon: MapPin });
      }

      if (canView('page_staff')) adminItems.push({ name: 'Staff', href: `${roleBasePath}/staff`, icon: Users });
      if (canView('page_attendance')) adminItems.push({ name: 'Attendance', href: `${roleBasePath}/attendance`, icon: CalendarCheck });
      if (canView('page_salaries')) adminItems.push({ name: 'Salaries', href: getSalaryPath(role), icon: Wallet });

      if (role !== 'location_admin') {
        adminItems.push({ name: 'Permissions', href: `${roleBasePath}/permissions`, icon: ShieldCheck });
      }

      // Settings — tax/billing/payroll/loyalty config (page itself scopes branch access).
      adminItems.push({ name: 'Settings', href: '/dashboard/admin/settings', icon: Settings });

      if (adminItems.length > 0) {
        groupsList.push({ title: 'Administration', items: adminItems });
      }
    }

    // Operations Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const opsItems = [];

      if (canView('page_orders')) opsItems.push({ name: 'All Orders', href: '/dashboard/admin/orders', icon: Receipt });
      // Reservations is a shared page (staff use it too), so it rides with All Orders
      // rather than being a separately-restrictable page.
      if (canView('page_orders')) opsItems.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
      if (canView('page_tables')) opsItems.push({ name: 'Tables', href: ['branch_admin', 'location_admin'].includes(role) ? `${roleBasePath}/tables` : '/dashboard/admin/tables', icon: Coffee });
      if (canView('page_menu')) opsItems.push({ name: 'Menu', href: ['branch_admin', 'location_admin'].includes(role) ? `${roleBasePath}/menu` : '/dashboard/admin/menu', icon: UtensilsCrossed });
      if (canView('page_inventory') && role !== 'location_admin') opsItems.push({ name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package });
      if (canView('page_procurement')) opsItems.push({ name: 'Procurement', href: '/dashboard/admin/procurement', icon: Truck });
      if (canView('page_cashdrawer')) opsItems.push({ name: 'Cash Drawer', href: '/dashboard/admin/cash-drawer', icon: Wallet });
      if (canView('page_waitlist')) opsItems.push({ name: 'Waitlist', href: '/dashboard/admin/waitlist', icon: Users });
      if (canView('page_coupons')) opsItems.push({ name: 'Offers', href: '/dashboard/admin/coupons', icon: Tag });

      opsItems.push({ name: 'Gift Cards', href: '/dashboard/admin/gift-cards', icon: Gift });

      if (opsItems.length > 0) {
        groupsList.push({ title: 'Operations', items: opsItems });
      }
    } else {
      const opsItems = [];
      if (role !== 'chef') {
        opsItems.push({ name: 'Tables', href: '/dashboard/staff/tables', icon: Coffee });
        opsItems.push({ name: 'Menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
        opsItems.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
        opsItems.push({ name: 'Cash Drawer', href: '/dashboard/staff/cash-drawer', icon: Wallet });
        opsItems.push({ name: 'Waitlist', href: '/dashboard/staff/waitlist', icon: Users });
      } else {
        opsItems.push({ name: 'Branch Menu', href: '/dashboard/staff/menu', icon: Coffee });
      }
      groupsList.push({ title: 'Operations', items: opsItems });
    }

    // Analytics Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const analyticsItems = [];

      if (canView('page_revenue')) analyticsItems.push({ name: 'Revenue', href: `${roleBasePath}/revenue`, icon: TrendingUp });
      if (canView('page_expenses')) analyticsItems.push({ name: 'Expenses', href: `${roleBasePath}/expenses`, icon: Receipt });
      if (canView('page_orderreports')) analyticsItems.push({ name: 'Order Reports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp });
      if (canView('page_branchcompare') && hasMultipleComparableBranches) analyticsItems.push({ name: 'Branch Compare', href: '/dashboard/admin/location-comparison', icon: Target });
      if (canView('page_staffreports')) analyticsItems.push({ name: 'Staff Reports', href: `${roleBasePath}/staff-reports`, icon: TrendingUp });
      if (canView('page_feedback')) analyticsItems.push({ name: 'Feedback', href: '/dashboard/admin/feedback', icon: Star });
      if (canView('page_paymentinsights')) analyticsItems.push({ name: 'Payment Insights', href: '/dashboard/admin/payment-intelligence', icon: CreditCard });
      if (canView('page_alerts')) analyticsItems.push({ name: 'Alerts Overview', href: '/dashboard/admin/command-center', icon: AlertCircle });
      if (canView('page_forecast')) analyticsItems.push({ name: 'Sales Forecast', href: '/dashboard/admin/forecasting', icon: TrendingUp });
      if (canView('page_exports')) analyticsItems.push({ name: 'Export Center', href: '/dashboard/admin/exports', icon: Download });

      if (analyticsItems.length > 0) {
        groupsList.push({ title: 'Analytics', items: analyticsItems });
      }
    } else {
      const performanceItems = [
        { name: 'My Performance', href: '/dashboard/staff/performance', icon: TrendingUp },
        { name: 'Work History', href: '/dashboard/staff/work-history', icon: History },
        { name: 'My Attendance', href: '/dashboard/staff/attendance', icon: Calendar },
      ];
      if (role === 'chef') {
        performanceItems.push({ name: 'Expenses', href: '/dashboard/chef/expenses', icon: Receipt });
      } else {
        performanceItems.push({ name: 'Expenses', href: '/dashboard/staff/expenses', icon: Receipt });
      }
      groupsList.push({ title: 'Performance', items: performanceItems });
    }

    // Loyalty Group
    if (canView('page_customers')) {
      groupsList.push({
        title: 'Rewards',
        items: [{ name: 'Customers & CRM', href: '/dashboard/admin/customers', icon: Crown }]
      });
    }

    // Granted Access: role-locked pages delegated to this user via allowedPages
    // that their role wouldn't normally surface in the menu.
    const grantedItems = ROLE_LOCKED_PAGES
      .filter(p => !isSuper && !p.defaultRoles.includes(role) && canView(p.pageKey))
      .map(({ name, href, icon }) => ({ name, href, icon }));
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
            const FirstIcon = group.items[0]?.icon || Coffee;
            const isActive = group.items.some(link => link.href === activeHref);

            return (
              <div
                key={group.title}
                className="relative"
                onMouseEnter={(e) => handleGroupInteraction(e, group.title, 'hover')}
              >
                {showLabels ? (
                  <div
                    className={`px-3 py-2 flex items-center justify-between group/header rounded-lg transition-colors duration-200 ${openGroup === group.title ? 'bg-(--color-surface-soft)' : 'hover:bg-(--color-surface-soft)'}`}
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupInteraction(e, group.title, 'click');
                      }}
                      className={`flex-1 py-1 text-xs font-semibold cursor-pointer transition-colors ${openGroup === group.title ? 'text-(--color-text-primary)' : 'text-(--color-text-muted) group-hover/header:text-(--color-text-primary)'}`}
                    >
                      {group.title}
                    </span>
                    <motion.div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupInteraction(e, group.title, 'toggle');
                      }}
                      animate={{ rotate: openGroup === group.title ? 0 : -90 }}
                      transition={{ duration: 0.2 }}
                      className="p-1 cursor-pointer hover:bg-(--color-hover) rounded-md transition-colors"
                    >
                      <ChevronDown size={14} className={openGroup === group.title ? 'text-(--color-text-primary)' : 'text-(--color-text-muted)'} />
                    </motion.div>
                  </div>
                ) : (
                  <div
                    title={group.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupInteraction(e, group.title, 'click');
                    }}
                    className={`h-11 w-11 mx-auto flex items-center justify-center rounded-lg cursor-pointer transition-colors duration-200 ${openGroup === group.title || isActive ? 'bg-primary text-(--color-on-primary)' : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}`}
                  >
                    <FirstIcon size={20} strokeWidth={openGroup === group.title || isActive ? 2.5 : 2} />
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
                      className="mt-1 ml-4 mr-1 overflow-hidden rounded-xl border border-[rgba(var(--color-primary-rgb),0.18)] bg-(--color-primary-soft) p-1.5 space-y-1"
                    >
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
                              flex items-center py-2.5 px-3 rounded-lg transition-colors duration-150
                              ${isLinkActive
                                ? 'bg-primary text-(--color-on-primary) font-medium'
                                : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}
                            `}
                          >
                            <Icon size={16} strokeWidth={isLinkActive ? 2.5 : 2} className="mr-3 shrink-0" />
                            <span className="text-sm">{link.name}</span>
                            {link.badge > 0 && (
                              <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-medium ${isLinkActive ? 'bg-white/25 text-(--color-on-primary)' : 'bg-(--color-primary-soft) text-primary'}`}>
                                {link.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
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
      <div className={`p-4 mt-auto border-t border-(--color-border) bg-(--color-bg-soft)/70`}>
        <div className={`flex items-center gap-3 ${showLabels ? '' : 'justify-center'}`}>
          <Link href="/dashboard/profile" className="h-9 w-9 rounded-lg bg-(--color-surface) border border-(--color-border) flex items-center justify-center shrink-0 relative group cursor-pointer overflow-hidden">
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
              className="p-1.5 text-(--color-text-muted) hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
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
                                ? 'bg-primary text-(--color-on-primary) font-medium'
                                : 'text-(--color-text-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text-primary)'}
                            `}
                          >
                            <div className="relative z-10 flex items-center w-full">
                              <Icon size={18} strokeWidth={isLinkActive ? 2.5 : 2} className="shrink-0" />
                              <span className="ml-3 text-sm whitespace-nowrap flex-1">{link.name}</span>
                              {link.badge > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${isLinkActive ? 'bg-white/25 text-(--color-on-primary)' : 'bg-(--color-primary-soft) text-primary'}`}>
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
