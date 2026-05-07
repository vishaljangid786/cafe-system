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
    if (role === 'super_admin' || role === 'admin') {
      mainItems.push({ name: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard });
      if (role === 'super_admin') {
        mainItems.push({ name: 'Admin Center', href: '/dashboard/super-admin', icon: Zap });
      }
    } else if (role === 'branch_admin') {
      mainItems.push({ name: 'Overview', href: '/dashboard/branch-admin', icon: LayoutDashboard });
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
      
      adminItems.push({ name: 'Authority', href: `${prefix}/permissions`, icon: ShieldCheck });
      
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
        title: 'Loyalty', 
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

  // Sync open group with current pathname
  useEffect(() => {
    const activeGroup = groups.find(group => 
      group.items.some(link => {
        const isExactMatch = ['Overview', 'My Dashboard', 'All Orders', 'New Orders', 'Kitchen'].includes(link.name);
        return isExactMatch ? pathname === link.href : pathname.startsWith(link.href);
      })
    );
    if (activeGroup) {
      const timer = setTimeout(() => {
        setOpenGroup(activeGroup.title);
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [pathname, groups]);

  const leaveTimeout = useRef(null);
  const [hoveredGroup, setHoveredGroup] = useState(null);

  const currentActiveGroupTitle = useMemo(() => {
    const active = groups.find(group => 
      group.items.some(link => {
        const isExactMatch = ['Overview', 'My Dashboard', 'All Orders', 'New Orders', 'Kitchen'].includes(link.name);
        return isExactMatch ? pathname === link.href : pathname.startsWith(link.href);
      })
    );
    return active?.title || null;
  }, [pathname, groups]);

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

  const sidebarVariants = {
    expanded: { width: 260, x: 0 },
    collapsed: { width: 80, x: 0 },
    mobileOpen: { width: 280, x: 0 },
    mobileClosed: { width: 280, x: -280 }
  };

  if (!user) return null;

  const content = (
    <div className={`h-full flex flex-col bg-[var(--color-sidebar-bg)] backdrop-blur-xl border-r border-[var(--color-border)] transition-all duration-300 relative`}>
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
            const isActive = group.items.some(link => {
              const isExactMatch = ['Overview', 'My Dashboard', 'All Orders', 'New Orders', 'Kitchen'].includes(link.name);
              return isExactMatch ? pathname === link.href : pathname.startsWith(link.href);
            });

            return (
              <div 
                key={group.title} 
                className="relative"
                onMouseEnter={(e) => handleGroupInteraction(e, group.title, 'hover')}
              >
                {showLabels ? (
                  <div 
                    className={`px-4 py-3 flex items-center justify-between group/header rounded-2xl transition-all duration-300 ${openGroup === group.title ? 'bg-primary/10 shadow-sm' : 'hover:bg-[var(--color-surface-soft)]'}`}
                  >
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupInteraction(e, group.title, 'click');
                      }}
                      className={`flex-1 py-1 text-[11px] font-black uppercase tracking-[0.25em] cursor-pointer transition-colors ${openGroup === group.title ? 'text-primary' : 'text-[var(--color-text-muted)] group-hover/header:text-[var(--color-text-primary)]'}`}
                    >
                      {group.title}
                    </span>
                    <motion.div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupInteraction(e, group.title, 'toggle');
                      }}
                      animate={{ rotate: openGroup === group.title ? 0 : -90, scale: openGroup === group.title ? 1.1 : 1 }}
                      transition={{ duration: 0.3 }}
                      className="p-1 cursor-pointer hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <ChevronDown size={14} className={openGroup === group.title ? 'text-primary' : 'text-[var(--color-text-muted)]'} />
                    </motion.div>
                  </div>
                ) : (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupInteraction(e, group.title, 'click');
                    }}
                    className={`h-12 w-12 mx-auto flex items-center justify-center rounded-2xl cursor-pointer transition-all duration-300 ${openGroup === group.title || isActive ? 'bg-primary text-black shadow-xl shadow-primary/20 scale-110' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'}`}
                  >
                    <FirstIcon size={22} strokeWidth={openGroup === group.title || isActive ? 2.5 : 2} />
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
                        const isLinkExactMatch = ['Overview', 'My Dashboard', 'All Orders', 'New Orders', 'Kitchen'].includes(link.name);
                        const isLinkActive = isLinkExactMatch ? pathname === link.href : pathname.startsWith(link.href);
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
                              flex items-center py-3 px-4 rounded-xl transition-all duration-200
                              ${isLinkActive 
                                ? 'bg-primary text-black font-bold shadow-sm' 
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'}
                            `}
                          >
                            <Icon size={16} strokeWidth={isLinkActive ? 2.5 : 2} className="mr-3 shrink-0" />
                            <span className="text-sm tracking-tight">{link.name}</span>
                            {link.badge > 0 && (
                              <span className={`ml-auto px-1.5 py-0.5 rounded-lg text-[10px] ${isLinkActive ? 'bg-black/20 text-black' : 'bg-primary/20 text-primary'}`}>
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
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
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

      {/* Flyout Portals (ONLY for Non-Active Groups on Hover) */}
      {!isMobile && (
        <AnimatePresence>
          {hoveredGroup && hoveredGroup !== currentActiveGroupTitle && (
            <motion.div
              key={hoveredGroup}
              initial={{ opacity: 0, x: -20, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -20, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
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
              className="w-72 bg-[var(--color-sidebar-bg)] backdrop-blur-3xl border border-[var(--color-border)] rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] p-4 z-[300] space-y-1.5"
            >
              {(() => {
                const groupData = groups.find(g => g.title === hoveredGroup);
                if (!groupData) return null;
                return (
                  <>
                    <div className="px-4 py-2 mb-2 border-b border-[var(--color-border)] flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
                        {groupData.title}
                      </span>
                      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
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
                              group/item flex items-center relative py-3.5 px-4 rounded-2xl transition-all duration-300
                              ${isLinkActive
                                ? 'bg-primary text-black font-black shadow-lg shadow-primary/10'
                                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)]'}
                            `}
                          >
                            <div className="relative z-10 flex items-center w-full">
                              <Icon size={18} strokeWidth={isLinkActive ? 2.5 : 2} className="shrink-0 transition-transform group-hover/item:scale-110" />
                              <span className="ml-3 text-sm tracking-tight whitespace-nowrap flex-1">{link.name}</span>
                              {link.badge > 0 && (
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isLinkActive ? 'bg-black/20 text-black' : 'bg-primary/20 text-primary'}`}>
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
