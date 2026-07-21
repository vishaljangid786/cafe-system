'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import PageTransition from '../components/ui/PageTransition';
import { useAuth } from '../context/AuthContext';
import CommandPalette from '../components/ui/CommandPalette';
import LoadingScreen from '../components/ui/LoadingScreen';
import CafeBlockedScreen from '../components/ui/CafeBlockedScreen';
import { useRouter, usePathname } from 'next/navigation';
import api from '../services/api';
import PremiumSelect from '../components/ui/PremiumSelect';
import { gatedEntries } from '../config/routes';
import { getLandingPath } from '../config/navigation';
import { rememberIntendedPath } from '../utils/returnTo';

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

// Every path variant of every page, from the shared route registry.
const GATED_PAGES = gatedEntries();

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
  const { user, loading, exitImpersonation, impersonate, logout, locations = [] } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Non-null once the server reports this user's cafe is blocked.
  const [cafeSuspension, setCafeSuspension] = useState(null);
  const [switchUsers, setSwitchUsers] = useState([]);

  const canSwitchUser = !!user?.impersonatedBy &&
    (user?.impersonatorRole === 'super_admin' || user?.impersonatedBy?.role === 'super_admin');

  useEffect(() => {
    if (!canSwitchUser) {
      setSwitchUsers([]);
      return undefined;
    }

    let cancelled = false;
    // forSwitch=1 tells the API this is the global hot-switch picker: a super_admin
    // impersonator gets EVERY user (all branches/cafes), not just the impersonated
    // user's scoped list, so they can switch to anyone.
    api.get('/users?limit=1000&forSwitch=1')
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
      // Keep the page they were aiming for so signing in returns them to it
      // rather than to a generic landing page.
      rememberIntendedPath(pathname);
      router.replace('/login');
      return;
    }

    if (!loading && user) {
      const allowed = ROLE_PREFIX[user.role];
      const isShared = SHARED_PREFIXES.some((p) => pathname.startsWith(p));
      if (!allowed || isShared) return;

      const fallback = getLandingPath(user, locations);
      const gated = matchGatedPage(pathname);

      if (gated) {
        // A hub carries several section grants — holding any one of them opens
        // it, and TabHub then renders only the sections that grant covers.
        const granted = user.allowedPages || [];
        const canOpen = user.role === 'super_admin' || (gated.keys || [gated.key]).some((k) => granted.includes(k));
        if (!canOpen && pathname !== fallback) router.replace(fallback);
        return;
      }

      if (!allowed.some((p) => pathname.startsWith(p)) && pathname !== fallback) {
        router.replace(fallback);
      }
    }
  }, [loading, user, router, pathname, locations]);

  // The server answers every route with 403 + code CAFE_SUSPENDED once a cafe is
  // blocked. The api layer turns that into this event so the lock is raised once
  // here, instead of each page independently failing to load and firing a toast.
  useEffect(() => {
    const onSuspended = (e) => setCafeSuspension(e.detail || {});
    window.addEventListener('cafe-suspended', onSuspended);
    return () => window.removeEventListener('cafe-suspended', onSuspended);
  }, []);

  const handleToggleSidebar = (val) => {
    setIsSidebarExpanded(val);
    localStorage.setItem('sidebar-expanded', val);
  };

  if (cafeSuspension) {
    return (
      <CafeBlockedScreen
        cafeName={cafeSuspension.cafeName}
        reason={cafeSuspension.reason}
        onLogout={logout}
      />
    );
  }

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
          <div className="bg-primary text-(--color-on-primary) px-4 py-2.5 shadow-sm z-100 relative">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
              <span className="text-[11px] sm:text-xs font-semibold flex items-center gap-2 text-center">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                <span className="truncate max-w-50 sm:max-w-none">
                  Impersonating: {user.name} ({user.role})
                </span>
              </span>
              {canSwitchUser && switchUsers.length > 0 && (
                <div className="w-64 sm:w-80">
                  <PremiumSelect
                    value=""
                    wrapOptions
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
                className="bg-black text-primary px-4 py-1.5 rounded-full text-[11px] font-semibold hover:bg-(--color-bg-deep) active:scale-95 transition-all whitespace-nowrap"
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
