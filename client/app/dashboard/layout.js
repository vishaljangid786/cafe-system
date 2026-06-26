'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import PageTransition from '../components/ui/PageTransition';
import { useAuth } from '../context/AuthContext';
import CommandPalette from '../components/ui/CommandPalette';
import LoadingScreen from '../components/ui/LoadingScreen';
import { useRouter, usePathname } from 'next/navigation';
import api from '../services/api';
import PremiumSelect from '../components/ui/PremiumSelect';

const BRANCH_ADMIN_SHARED_PAGES = [
  '/dashboard/admin/procurement',
  '/dashboard/admin/cash-drawer',
  '/dashboard/admin/waitlist',
  '/dashboard/admin/gift-cards',
  '/dashboard/admin/settings',
  '/dashboard/admin/feedback',
  '/dashboard/admin/inventory',
];

const ROLE_PREFIX = {
  super_admin: ['/dashboard/super-admin', '/dashboard/admin'],
  admin: ['/dashboard/admin'],
  branch_admin: ['/dashboard/branch-admin', ...BRANCH_ADMIN_SHARED_PAGES],
  chef: ['/dashboard/chef'],
  staff: ['/dashboard/staff'],
  location_admin: ['/dashboard/location-admin', ...BRANCH_ADMIN_SHARED_PAGES],
};

const SHARED_PREFIXES = [
  '/dashboard/notifications',
  '/dashboard/profile',
];

const GATED_PAGES = [
  { key: 'page_overview', paths: ['/dashboard/admin', '/dashboard/admin/summary', '/dashboard/branch-admin', '/dashboard/location-admin', '/dashboard/staff'] },
  { key: 'page_orders', paths: ['/dashboard/chef'] },
  { key: 'page_branchpresence', paths: ['/dashboard/admin/branch-presence'] },
  { key: 'page_users', paths: ['/dashboard/admin/users'] },
  { key: 'page_staff', paths: ['/dashboard/admin/staff', '/dashboard/branch-admin/staff', '/dashboard/location-admin/staff'] },
  { key: 'page_attendance', paths: ['/dashboard/admin/attendance', '/dashboard/branch-admin/attendance', '/dashboard/location-admin/attendance'] },
  { key: 'page_myattendance', paths: ['/dashboard/staff/attendance'] },
  { key: 'page_salaries', paths: ['/dashboard/admin/payroll', '/dashboard/branch-admin/salary', '/dashboard/location-admin/salary'] },
  { key: 'page_orderreports', paths: ['/dashboard/admin/orders/analytics'] },
  { key: 'page_orders', paths: ['/dashboard/admin/orders', '/dashboard/staff/orders'] },
  { key: 'page_reservations', paths: ['/dashboard/reservations', '/dashboard/bookings', '/dashboard/admin/bookings', '/dashboard/branch-admin/bookings', '/dashboard/location-admin/bookings'] },
  { key: 'page_tables', paths: ['/dashboard/admin/tables', '/dashboard/branch-admin/tables', '/dashboard/location-admin/tables', '/dashboard/staff/tables'] },
  { key: 'page_menu', paths: ['/dashboard/admin/menu', '/dashboard/branch-admin/menu', '/dashboard/location-admin/menu', '/dashboard/staff/menu'] },
  { key: 'page_inventory', paths: ['/dashboard/admin/inventory'] },
  { key: 'page_procurement', paths: ['/dashboard/admin/procurement'] },
  { key: 'page_cashdrawer', paths: ['/dashboard/admin/cash-drawer', '/dashboard/staff/cash-drawer'] },
  { key: 'page_waitlist', paths: ['/dashboard/admin/waitlist', '/dashboard/staff/waitlist'] },
  { key: 'page_coupons', paths: ['/dashboard/admin/coupons'] },
  { key: 'page_giftcards', paths: ['/dashboard/admin/gift-cards'] },
  { key: 'page_revenue', paths: ['/dashboard/admin/revenue', '/dashboard/branch-admin/revenue', '/dashboard/location-admin/revenue'] },
  { key: 'page_expenses', paths: ['/dashboard/admin/expenses', '/dashboard/branch-admin/expenses', '/dashboard/location-admin/expenses', '/dashboard/staff/expenses', '/dashboard/chef/expenses'] },
  { key: 'page_staffreports', paths: ['/dashboard/admin/staff-reports', '/dashboard/branch-admin/staff-reports', '/dashboard/location-admin/staff-reports'] },
  { key: 'page_feedback', paths: ['/dashboard/admin/feedback'] },
  { key: 'page_customers', paths: ['/dashboard/admin/customers'] },
  { key: 'page_branchcompare', paths: ['/dashboard/admin/location-comparison'] },
  { key: 'page_paymentinsights', paths: ['/dashboard/admin/payment-intelligence'] },
  { key: 'page_alerts', paths: ['/dashboard/admin/command-center'] },
  { key: 'page_forecast', paths: ['/dashboard/admin/forecasting'] },
  { key: 'page_exports', paths: ['/dashboard/admin/exports'] },
  { key: 'page_myperformance', paths: ['/dashboard/staff/performance', '/dashboard/chef/performance'] },
  { key: 'page_workhistory', paths: ['/dashboard/staff/work-history'] },
  { key: 'page_addmember', paths: ['/dashboard/add-member'] },
  { key: 'page_permissions', paths: ['/dashboard/admin/permissions', '/dashboard/branch-admin/permissions'] },
  { key: 'page_settings', paths: ['/dashboard/admin/settings'] },
  { key: 'page_cafes', paths: ['/dashboard/admin/cafes'] },
  { key: 'page_branches', paths: ['/dashboard/admin/locations'] },
  { key: 'page_auditlogs', paths: ['/dashboard/admin/audit-logs'] },
  { key: 'page_impersonate', paths: ['/dashboard/admin/impersonate'] },
  { key: 'page_admincenter', paths: ['/dashboard/super-admin'] },
];

const matchGatedPage = (pathname) => {
  let matched = null;
  let matchedLen = -1;
  for (const gp of GATED_PAGES) {
    for (const path of gp.paths) {
      if ((pathname === path || pathname.startsWith(path + '/')) && path.length > matchedLen) {
        matched = gp;
        matchedLen = path.length;
      }
    }
  }
  return matched;
};

const getRoleBasePath = (role) => {
  if (role === 'super_admin' || role === 'admin') return '/dashboard/admin';
  if (role === 'branch_admin') return '/dashboard/branch-admin';
  if (role === 'location_admin') return '/dashboard/location-admin';
  if (role === 'chef') return '/dashboard/chef';
  return '/dashboard/staff';
};

const pathForPage = (role, pageKey) => {
  const roleBase = getRoleBasePath(role);
  const branchLike = ['branch_admin', 'location_admin'].includes(role);

  const byKey = {
    page_overview: role === 'chef' ? '/dashboard/chef' : roleBase,
    page_branchpresence: '/dashboard/admin/branch-presence',
    page_users: '/dashboard/admin/users',
    page_staff: `${roleBase}/staff`,
    page_attendance: `${roleBase}/attendance`,
    page_myattendance: '/dashboard/staff/attendance',
    page_salaries: role === 'branch_admin' ? '/dashboard/branch-admin/salary' : role === 'location_admin' ? '/dashboard/location-admin/salary' : '/dashboard/admin/payroll',
    page_orders: role === 'chef' ? '/dashboard/chef' : role === 'staff' ? '/dashboard/staff/orders' : '/dashboard/admin/orders',
    page_reservations: '/dashboard/reservations',
    page_tables: branchLike ? `${roleBase}/tables` : role === 'staff' ? '/dashboard/staff/tables' : '/dashboard/admin/tables',
    page_menu: branchLike ? `${roleBase}/menu` : ['staff', 'chef'].includes(role) ? '/dashboard/staff/menu' : '/dashboard/admin/menu',
    page_inventory: '/dashboard/admin/inventory',
    page_procurement: '/dashboard/admin/procurement',
    page_cashdrawer: role === 'staff' ? '/dashboard/staff/cash-drawer' : '/dashboard/admin/cash-drawer',
    page_waitlist: role === 'staff' ? '/dashboard/staff/waitlist' : '/dashboard/admin/waitlist',
    page_coupons: '/dashboard/admin/coupons',
    page_giftcards: '/dashboard/admin/gift-cards',
    page_revenue: `${roleBase}/revenue`,
    page_expenses: ['staff', 'chef'].includes(role) ? `/dashboard/${role}/expenses` : `${roleBase}/expenses`,
    page_orderreports: '/dashboard/admin/orders/analytics',
    page_staffreports: `${roleBase}/staff-reports`,
    page_feedback: '/dashboard/admin/feedback',
    page_customers: '/dashboard/admin/customers',
    page_branchcompare: '/dashboard/admin/location-comparison',
    page_paymentinsights: '/dashboard/admin/payment-intelligence',
    page_alerts: '/dashboard/admin/command-center',
    page_forecast: '/dashboard/admin/forecasting',
    page_exports: '/dashboard/admin/exports',
    page_myperformance: role === 'chef' ? '/dashboard/chef/performance' : '/dashboard/staff/performance',
    page_workhistory: '/dashboard/staff/work-history',
    page_addmember: '/dashboard/add-member',
    page_permissions: role === 'branch_admin' ? '/dashboard/branch-admin/permissions' : '/dashboard/admin/permissions',
    page_settings: '/dashboard/admin/settings',
    page_cafes: '/dashboard/admin/cafes',
    page_branches: '/dashboard/admin/locations',
    page_auditlogs: '/dashboard/admin/audit-logs',
    page_impersonate: '/dashboard/admin/impersonate',
    page_admincenter: '/dashboard/super-admin',
  };

  return byKey[pageKey] || '';
};

const getFallbackPath = (user) => {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/dashboard/admin';

  for (const pageKey of user.allowedPages || []) {
    const path = pathForPage(user.role, pageKey);
    if (path) return path;
  }

  return '/dashboard/profile';
};

export default function DashboardLayout({ children }) {
  const { user, loading, exitImpersonation, impersonate } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [switchUsers, setSwitchUsers] = useState([]);

  const canSwitchUser = !!user?.impersonatedBy &&
    (user?.impersonatorRole === 'super_admin' || user?.impersonatedBy?.role === 'super_admin');

  useEffect(() => {
    if (!canSwitchUser) {
      setSwitchUsers([]);
      return undefined;
    }

    let cancelled = false;
    api.get('/users?limit=1000')
      .then((res) => { if (!cancelled) setSwitchUsers(res.data?.data || []); })
      .catch(() => { if (!cancelled) setSwitchUsers([]); });
    return () => { cancelled = true; };
  }, [canSwitchUser]);

  const handleSwitchUser = async (uid) => {
    if (!uid || String(uid) === String(user?._id)) return;
    try {
      await impersonate(uid, false);
    } catch (e) {
      // AuthContext surfaces the error.
    }
  };

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarExpanded(false);
      } else {
        const storedExpanded = localStorage.getItem('sidebar-expanded');
        setIsSidebarExpanded(storedExpanded === null ? true : storedExpanded === 'true');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }

    if (!loading && user) {
      const allowed = ROLE_PREFIX[user.role];
      const isShared = SHARED_PREFIXES.some((p) => pathname.startsWith(p));
      if (!allowed || isShared) return;

      const fallback = getFallbackPath(user);
      const gated = matchGatedPage(pathname);

      if (gated) {
        const canOpen = user.role === 'super_admin' || (user.allowedPages || []).includes(gated.key);
        if (!canOpen && pathname !== fallback) router.replace(fallback);
        return;
      }

      if (!allowed.some((p) => pathname.startsWith(p)) && pathname !== fallback) {
        router.replace(fallback);
      }
    }
  }, [loading, user, router, pathname]);

  const handleToggleSidebar = (val) => {
    setIsSidebarExpanded(val);
    localStorage.setItem('sidebar-expanded', val);
  };

  if (!mounted || loading || !user) {
    return <LoadingScreen message="Loading workspace" />;
  }

  return (
    <div className="flex h-screen bg-transparent text-(--color-text-primary) overflow-hidden selection:bg-primary/30 selection:text-primary font-sans transition-colors duration-300">
      <Sidebar
        isExpanded={isSidebarExpanded}
        setIsExpanded={handleToggleSidebar}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isMobile={isMobile}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {user?.impersonatedBy && (
          <div className="bg-primary text-(--color-on-primary) px-4 py-2.5 shadow-lg z-100 relative">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-normal flex items-center gap-2 text-center">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                <span className="truncate max-w-50 sm:max-w-none">
                  Impersonating: {user.name} ({user.role})
                </span>
              </span>
              {canSwitchUser && switchUsers.length > 0 && (
                <div className="w-64 sm:w-80">
                  <PremiumSelect
                    value=""
                    onChange={(uid) => { if (uid) handleSwitchUser(uid); }}
                    placeholder="Switch to a user..."
                    options={[
                      { label: 'Switch to a user...', value: '' },
                      ...switchUsers
                        .filter((u) => String(u._id) !== String(user?._id))
                        .map((u) => {
                          const role = String(u.role || '').replace(/_/g, ' ');
                          // Branch + cafe live on the user's assigned/accessible location.
                          const loc = u.assignedLocation
                            || (Array.isArray(u.accessibleLocations) ? u.accessibleLocations[0] : null);
                          const branch = loc?.name
                            || (Array.isArray(u.accessibleLocations) && u.accessibleLocations.length > 1
                              ? `${u.accessibleLocations.length} branches`
                              : '');
                          const cafe = loc?.cafe?.name || '';
                          const label = [u.name, role, branch, cafe].filter(Boolean).join(' · ');
                          return { label, value: u._id };
                        }),
                    ]}
                  />
                </div>
              )}
              <button
                onClick={exitImpersonation}
                className="bg-black text-primary px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-normal hover:bg-(--color-bg-deep) active:scale-95 transition-all whitespace-nowrap shadow-sm"
              >
                Exit Session
              </button>
            </div>
          </div>
        )}
        <Navbar
          onToggleSidebar={() => isMobile ? setIsMobileMenuOpen(!isMobileMenuOpen) : handleToggleSidebar(!isSidebarExpanded)}
          sidebarExpanded={isSidebarExpanded}
          isMobile={isMobile}
        />

        <main className="flex-1 overflow-x-auto overflow-y-auto bg-transparent p-3 sm:p-4 md:p-8 pb-28 lg:pb-8 custom-scrollbar relative">
          <PageTransition>
            <div className="max-w-400 mx-auto dashboard-content min-w-0">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>

      <CommandPalette />
      <BottomNav onMore={() => setIsMobileMenuOpen(true)} />
    </div>
  );
}
