'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
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
// Admin-area operational pages that branch & location admins reach from their
// OWN sidebar menu. They live under /dashboard/admin/* but are not admin-only —
// each page scopes its data to the user's branch server-side. Without these in
// the allowed list the guard bounced both roles straight back to their Overview
// the moment they clicked Procurement / Cash Drawer / Waitlist / Gift Cards /
// Settings / Feedback / Inventory.
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
  '/dashboard/reservations',
  '/dashboard/bookings',
  '/dashboard/profile',
  '/dashboard/add-member',
  '/dashboard/admin/branch-presence',
];

// Page-level access guard. Each gated page maps to its access key (allowedPages)
// and EVERY path it can live at across roles (admin / branch-admin / location-admin
// variants). A page in this list may be opened ONLY if the user's allowedPages
// contains its key (super_admin bypasses). Anything NOT listed here is governed by
// the role-prefix check instead (Overview, Settings, Cafes, Gift Cards, role
// dashboards, shared pages). Keep page keys in sync with utils/pageAccess.js.
const GATED_PAGES = [
  { key: 'page_users',           paths: ['/dashboard/admin/users'] },
  { key: 'page_staff',           paths: ['/dashboard/admin/staff', '/dashboard/branch-admin/staff', '/dashboard/location-admin/staff'] },
  { key: 'page_attendance',      paths: ['/dashboard/admin/attendance', '/dashboard/branch-admin/attendance', '/dashboard/location-admin/attendance'] },
  { key: 'page_salaries',        paths: ['/dashboard/admin/payroll', '/dashboard/branch-admin/salary', '/dashboard/location-admin/salary'] },
  { key: 'page_orderreports',    paths: ['/dashboard/admin/orders/analytics'] },
  { key: 'page_orders',          paths: ['/dashboard/admin/orders'] },
  { key: 'page_tables',          paths: ['/dashboard/admin/tables', '/dashboard/branch-admin/tables', '/dashboard/location-admin/tables'] },
  { key: 'page_menu',            paths: ['/dashboard/admin/menu', '/dashboard/branch-admin/menu', '/dashboard/location-admin/menu'] },
  { key: 'page_inventory',       paths: ['/dashboard/admin/inventory'] },
  { key: 'page_procurement',     paths: ['/dashboard/admin/procurement'] },
  { key: 'page_cashdrawer',      paths: ['/dashboard/admin/cash-drawer'] },
  { key: 'page_waitlist',        paths: ['/dashboard/admin/waitlist'] },
  { key: 'page_coupons',         paths: ['/dashboard/admin/coupons'] },
  { key: 'page_revenue',         paths: ['/dashboard/admin/revenue', '/dashboard/branch-admin/revenue', '/dashboard/location-admin/revenue'] },
  { key: 'page_expenses',        paths: ['/dashboard/admin/expenses', '/dashboard/branch-admin/expenses', '/dashboard/location-admin/expenses'] },
  { key: 'page_staffreports',    paths: ['/dashboard/admin/staff-reports', '/dashboard/branch-admin/staff-reports', '/dashboard/location-admin/staff-reports'] },
  { key: 'page_feedback',        paths: ['/dashboard/admin/feedback'] },
  { key: 'page_customers',       paths: ['/dashboard/admin/customers'] },
  { key: 'page_branchcompare',   paths: ['/dashboard/admin/location-comparison'] },
  { key: 'page_paymentinsights', paths: ['/dashboard/admin/payment-intelligence'] },
  { key: 'page_alerts',          paths: ['/dashboard/admin/command-center'] },
  { key: 'page_forecast',        paths: ['/dashboard/admin/forecasting'] },
  { key: 'page_exports',         paths: ['/dashboard/admin/exports'] },
  // Branches is shown to admins by ROLE in the sidebar (not page-gated there), so the
  // guard must let admins in by role too — while still allowing delegation to other
  // roles via allowedPages. (super_admin always passes.)
  { key: 'page_branches',        paths: ['/dashboard/admin/locations'], roleAllow: ['admin'] },
  { key: 'page_auditlogs',       paths: ['/dashboard/admin/audit-logs'] },
  { key: 'page_impersonate',     paths: ['/dashboard/admin/impersonate'] },
  { key: 'page_admincenter',     paths: ['/dashboard/super-admin'] },
];

// Find the gated page whose path is the LONGEST prefix of `pathname` (so
// /orders/analytics resolves to its own entry, not the shorter /orders).
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
        const gated = matchGatedPage(pathname);
        if (gated) {
          // Page-level access: only super_admin, or a user whose allowedPages holds
          // this page key, may open it. This enforces "one toggle = one page" even on
          // direct URL access, overriding the broad role-prefix allowance.
          const canOpen = user.role === 'super_admin'
            || (gated.roleAllow && gated.roleAllow.includes(user.role))
            || (user.allowedPages || []).includes(gated.key);
          if (!canOpen) router.replace(allowed[0]);
        } else if (!allowed.some(p => pathname.startsWith(p))) {
          // Non-gated page (Overview, Settings, Cafes, role dashboard, …): role prefix.
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

        <main className="flex-1 overflow-x-auto overflow-y-auto bg-transparent p-3 sm:p-4 md:p-8 pb-28 lg:pb-8 custom-scrollbar relative">
          <PageTransition>
            <div className="max-w-400 mx-auto dashboard-content min-w-0">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>

      <CommandPalette />

      {/* Mobile/tablet bottom tab bar — role-based shortcuts + "More" opens the full menu */}
      <BottomNav onMore={() => setIsMobileMenuOpen(true)} />
    </div>
  );
}
