'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from '../components/ui/PageTransition';
import { useAuth } from '../context/AuthContext';
import CommandPalette from '../components/ui/CommandPalette';
import LoadingScreen from '../components/ui/LoadingScreen';
import { useRouter, usePathname } from 'next/navigation';

// Each role maps to the dashboard prefixes it is allowed to visit. The FIRST
// entry is that role's default landing target (used when redirecting away from
// a forbidden path). Only super_admin may enter /dashboard/super-admin; it also
// keeps /dashboard/admin access because the Command Center links into those
// admin sub-pages.
const ROLE_PREFIX = {
  super_admin: ['/dashboard/super-admin', '/dashboard/admin'],
  admin: ['/dashboard/admin'],
  branch_admin: ['/dashboard/branch-admin'],
  chef: ['/dashboard/chef'],
  staff: ['/dashboard/staff'],
  location_admin: ['/dashboard/branch-admin'],
};

const SHARED_PREFIXES = [
  '/dashboard/notifications',
  '/dashboard/reservations',
  '/dashboard/bookings',
  '/dashboard/profile',
  '/dashboard/add-member',
];

// Pages that are normally role-locked but can be delegated to ANY user via a
// permission. If the user holds the mapped permission, they may open the path
// even if it falls outside their role's prefix.
// Every permission-gated page a non-default-role user may open if they hold one
// of `perms`. Keep in sync with GRANTABLE_PAGES in components/Sidebar.js.
const PAGE_PERMISSIONS = [
  { path: '/dashboard/admin/users', perms: ['manageStaff'] },
  { path: '/dashboard/admin/staff-reports', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/staff', perms: ['manageStaff'] },
  { path: '/dashboard/admin/attendance', perms: ['manageStaff'] },
  { path: '/dashboard/admin/payroll', perms: ['manageStaff'] },
  { path: '/dashboard/admin/orders/analytics', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/orders', perms: ['viewOrders', 'forceComplete'] },
  { path: '/dashboard/admin/tables', perms: ['manageOrders'] },
  { path: '/dashboard/admin/menu', perms: ['manageOrders'] },
  { path: '/dashboard/admin/inventory', perms: ['manageOrders'] },
  { path: '/dashboard/admin/coupons', perms: ['manageCoupons'] },
  { path: '/dashboard/admin/revenue', perms: ['viewRevenue', 'editRevenue'] },
  { path: '/dashboard/admin/expenses', perms: ['viewRevenue', 'editRevenue'] },
  { path: '/dashboard/admin/customers', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/location-comparison', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/payment-intelligence', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/command-center', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/forecasting', perms: ['viewAnalytics'] },
  { path: '/dashboard/admin/exports', perms: ['exportReports'] },
  { path: '/dashboard/admin/locations', perms: ['manageBranches'] },
  { path: '/dashboard/admin/audit-logs', perms: ['viewAuditLogs'] },
  { path: '/dashboard/admin/impersonate', perms: ['impersonateUsers'] },
  { path: '/dashboard/super-admin', perms: ['viewAdminCenter'] },
];

export default function DashboardLayout({ children }) {
  const { user, loading, exitImpersonation } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      const isShared = SHARED_PREFIXES.some(p => pathname.startsWith(p));
      if (allowed && !isShared) {
        const canAccess = allowed.some(p => pathname.startsWith(p));
        // Longest-prefix match so e.g. /orders/analytics resolves to its own
        // entry rather than the shorter /orders one.
        const grantedPage = PAGE_PERMISSIONS
          .filter(pp => pathname.startsWith(pp.path))
          .sort((a, b) => b.path.length - a.path.length)[0];
        const hasPagePerm = !!grantedPage && grantedPage.perms.some(k => user.permissions?.[k] === true);
        if (!canAccess && !hasPagePerm) {
          router.replace(allowed[0]);
        }
      }
    }
  }, [loading, user, router, pathname]);

  const handleToggleSidebar = (val) => {
    setIsSidebarExpanded(val);
    localStorage.setItem('sidebar-expanded', val);
  };

  // Prevent hydration mismatch by returning a consistent initial structure
  if (!mounted || loading || !user) {
    return <LoadingScreen message="Loading workspace" />;
  }

  return (
    <div className="flex h-screen bg-transparent text-(--color-text-primary) overflow-hidden selection:bg-primary/30 selection:text-primary font-sans transition-colors duration-300">
      {/* Sidebar - Desktop & Mobile */}
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
              <button 
                onClick={exitImpersonation}
                className="bg-black text-primary px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-normal hover:bg-(--color-bg-deep)  active:scale-95 transition-all whitespace-nowrap shadow-sm"
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

        <main className="flex-1 overflow-x-auto overflow-y-auto bg-transparent p-3 sm:p-4 md:p-8 custom-scrollbar relative">
          <PageTransition>
            <div className="max-w-400 mx-auto dashboard-content min-w-0">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
