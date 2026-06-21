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
  Target, TrendingUp, Crown, Package,
  Calendar, Bell, Send, History, CreditCard, AlertCircle, Zap, Download,
  Activity, ShieldAlert, ChevronDown, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen, isMobile }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const [flyoutTop, setFlyoutTop] = useState(0);

  const groups = useMemo(() => {
    if (!user) return [];
    const role = user.role;
    const permissions = user.permissions || {};
    const isSuper = role === 'super_admin';
    const hasPermission = (key) => isSuper || permissions[key] === true;

    const groupsList = [];

    // Main Group
    const mainItems = [];
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin' || role === 'location_admin') {
      const isGlobal = role === 'super_admin' || role === 'admin';
      mainItems.push({ 
        name: 'Overview', 
        href: isGlobal ? '/dashboard/admin' : '/dashboard/branch-admin', 
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
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin') {
      const adminItems = [];
      const prefix = (role === 'super_admin' || role === 'admin') ? '/dashboard/admin' : '/dashboard/branch-admin';

      if (role === 'super_admin') {
        adminItems.push({ name: 'Users', href: '/dashboard/admin/users', icon: Users });
        adminItems.push({ name: 'Security Logs', href: '/dashboard/admin/audit-logs', icon: Activity });
      }

      if (role === 'super_admin') {
        adminItems.push({ name: 'Impersonate', href: '/dashboard/admin/impersonate', icon: ShieldAlert });
      }

      if (role === 'super_admin' || role === 'admin') {
        adminItems.push({ name: 'Branches', href: '/dashboard/admin/locations', icon: MapPin });
      }

      if (hasPermission('manageStaff')) {
        adminItems.push({ name: 'Staff', href: `${prefix}/staff`, icon: Users });
        adminItems.push({ name: 'Attendance', href: `${prefix}/attendance`, icon: CalendarCheck });
        adminItems.push({ name: 'Salaries', href: role === 'branch_admin' ? '/dashboard/branch-admin/salary' : '/dashboard/admin/payroll', icon: Wallet });
      }

      adminItems.push({ name: 'Permissions', href: `${prefix}/permissions`, icon: ShieldCheck });

      groupsList.push({ title: 'Administration', items: adminItems });
    }

    // Operations Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin') {
      const opsItems = [];

      if (hasPermission('viewOrders')) {
        opsItems.push({ name: 'All Orders', href: '/dashboard/admin/orders', icon: Receipt });
        opsItems.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
      }

      if (hasPermission('manageOrders')) {
        opsItems.push({ name: 'Tables', href: role === 'branch_admin' ? '/dashboard/branch-admin/tables' : '/dashboard/admin/tables', icon: Coffee });
        opsItems.push({ name: 'Menu', href: role === 'branch_admin' ? '/dashboard/branch-admin/menu' : '/dashboard/admin/menu', icon: UtensilsCrossed });
        opsItems.push({ name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package });
      }

      if ((role === 'super_admin' || role === 'admin') && hasPermission('manageCoupons')) {
        opsItems.push({ name: 'Offers', href: '/dashboard/admin/coupons', icon: Tag });
      }

      if (opsItems.length > 0) {
        groupsList.push({ title: 'Operations', items: opsItems });
      }
    } else {
      const opsItems = [];
      if (role !== 'chef') {
        opsItems.push({ name: 'Tables', href: '/dashboard/staff/tables', icon: Coffee });
        opsItems.push({ name: 'Menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
        opsItems.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
      } else {
        opsItems.push({ name: 'Branch Menu', href: '/dashboard/staff/menu', icon: Coffee });
      }
      groupsList.push({ title: 'Operations', items: opsItems });
    }

    // Analytics Group
    if (role === 'super_admin' || role === 'admin' || role === 'branch_admin') {
      const analyticsItems = [];
      const prefix = (role === 'super_admin' || role === 'admin') ? '/dashboard/admin' : '/dashboard/branch-admin';

      if (hasPermission('viewRevenue')) {
        analyticsItems.push({ name: 'Revenue', href: `${prefix}/revenue`, icon: TrendingUp });
        analyticsItems.push({ name: 'Expenses', href: `${prefix}/expenses`, icon: Receipt });
      }

      if (hasPermission('viewAnalytics')) {
        analyticsItems.push({ name: 'Order Reports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp });

        if (role === 'super_admin' || role === 'admin') {
          analyticsItems.push({ name: 'Branch Compare', href: '/dashboard/admin/location-comparison', icon: Target });
        }

        analyticsItems.push({ name: 'Staff Reports', href: `${prefix}/staff-reports`, icon: TrendingUp });

        if (role === 'super_admin' || role === 'admin') {
          analyticsItems.push({ name: 'Payment Intel', href: '/dashboard/admin/payment-intelligence', icon: CreditCard });
          analyticsItems.push({ name: 'Command Center', href: '/dashboard/admin/command-center', icon: AlertCircle });
          analyticsItems.push({ name: 'Smart Forecast', href: '/dashboard/admin/forecasting', icon: TrendingUp });
        }
      }

      if (hasPermission('exportReports')) {
        analyticsItems.push({ name: 'Export Center', href: '/dashboard/admin/exports', icon: Download });
      }

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
    if ((role === 'super_admin' || role === 'admin' || role === 'branch_admin') && hasPermission('viewAnalytics')) {
      groupsList.push({
        title: 'Rewards',
        items: [{ name: 'Customers & CRM', href: '/dashboard/admin/customers', icon: Crown }]
      });
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
  }, [user, unreadCount]);

  const allLinks = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const activeHref = useMemo(() => {
    const matches = allLinks
      .filter(link => {
        // Special case for root-ish dashboards to avoid matching everything
        if (link.href === '/dashboard/admin' || link.href === '/dashboard/branch-admin' || link.href === '/dashboard/staff') {
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
    <div className={`h-full flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)] transition-colors duration-300 relative`}>
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
                className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] whitespace-nowrap"
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
                    className={`px-3 py-2 flex items-center justify-between group/header rounded-lg transition-colors duration-200 ${openGroup === group.title ? 'bg-[var(--color-surface-soft)]' : 'hover:bg-[var(--color-surface-soft)]'}`}
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupInteraction(e, group.title, 'click');
                      }}
                      className={`flex-1 py-1 text-xs font-semibold cursor-pointer transition-colors ${openGroup === group.title ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] group-hover/header:text-[var(--color-text-primary)]'}`}
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
                      className="p-1 cursor-pointer hover:bg-[var(--color-hover)] rounded-md transition-colors"
                    >
                      <ChevronDown size={14} className={openGroup === group.title ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'} />
                    </motion.div>
                  </div>
                ) : (
                  <div
                    title={group.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupInteraction(e, group.title, 'click');
                    }}
                    className={`h-11 w-11 mx-auto flex items-center justify-center rounded-lg cursor-pointer transition-colors duration-200 ${openGroup === group.title || isActive ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'}`}
                  >
                    <FirstIcon size={20} strokeWidth={openGroup === group.title || isActive ? 2.5 : 2} />
                  </div>
                )}

                {/* Inline Dropdown (Determined by openGroup state) */}
                <AnimatePresence>
                  {openGroup === group.title && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden space-y-1 mt-1 pl-4 pr-1"
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
                                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium'
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'}
                            `}
                          >
                            <Icon size={16} strokeWidth={isLinkActive ? 2.5 : 2} className="mr-3 shrink-0" />
                            <span className="text-sm">{link.name}</span>
                            {link.badge > 0 && (
                              <span className={`ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-medium ${isLinkActive ? 'bg-white/25 text-[var(--color-on-primary)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}`}>
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

      {/* Update Center Action */}
      <div className="px-3 mb-4">
        <button
          onClick={() => setShowNotifModal(true)}
          className={`
            w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] hover:bg-[var(--color-surface)] transition-all group
            ${showLabels ? 'justify-start px-3' : 'justify-center'}
          `}
        >
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary group- transition-transform">
            <Send size={16} />
          </div>
          {showLabels && (
            <span className="text-xs font-bold text-[var(--color-text-primary)]">Send Message</span>
          )}
        </button>
      </div>

      {/* User Footer */}
      <div className={`p-4 mt-auto border-t border-[var(--color-border)] bg-[var(--color-bg-soft)]/70`}>
        <div className={`flex items-center gap-3 ${showLabels ? '' : 'justify-center'}`}>
          <Link href="/dashboard/profile" className="h-9 w-9 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shrink-0 relative group cursor-pointer overflow-hidden">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-primary">{user.name.substring(0, 2).toUpperCase()}</span>
            )}
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[var(--color-success)] border-2 border-[var(--color-surface)] rounded-full" />
          </Link>
          {showLabels && (
            <Link href="/dashboard/profile" className="min-w-0 flex-1 group">
              <p className="text-xs font-bold text-[var(--color-text-primary)] truncate leading-none group-hover:text-primary transition-colors">{user.name}</p>
              <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mt-1 truncate">{user.role === 'branch_admin' ? 'branch admin' : user.role.replace('_', ' ')}</p>
            </Link>
          )}
          {showLabels && (
            <button
              onClick={logout}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg transition-all"
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
            className="fixed inset-0 bg-black/40 z-[100]"
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
          fixed inset-y-0 left-0 z-[101] 
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
              className="w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-md)] p-3 z-[300] space-y-1"
            >
              {(() => {
                const groupData = groups.find(g => g.title === hoveredGroup);
                if (!groupData) return null;
                return (
                  <>
                    <div className="px-3 py-1.5 mb-1 border-b border-[var(--color-border)]">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)]">
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
                                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium'
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'}
                            `}
                          >
                            <div className="relative z-10 flex items-center w-full">
                              <Icon size={18} strokeWidth={isLinkActive ? 2.5 : 2} className="shrink-0" />
                              <span className="ml-3 text-sm whitespace-nowrap flex-1">{link.name}</span>
                              {link.badge > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${isLinkActive ? 'bg-white/25 text-[var(--color-on-primary)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}`}>
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
