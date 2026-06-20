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

const ROLE_PREFIX = {
  super_admin: '/dashboard/admin',
  admin: '/dashboard/admin',
  branch_admin: '/dashboard/branch-admin',
  chef: '/dashboard/chef',
  staff: '/dashboard/staff',
  location_admin: '/dashboard/branch-admin',
};

const SHARED_PREFIXES = [
  '/dashboard/notifications',
  '/dashboard/reservations',
  '/dashboard/bookings',
  '/dashboard/profile',
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
      if (allowed && !pathname.startsWith(allowed) && !isShared) {
        router.replace(allowed);
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
    <div className="flex h-screen bg-transparent text-[var(--color-text-primary)] overflow-hidden selection:bg-[var(--color-primary)]/30 selection:text-[var(--color-primary)] font-sans transition-colors duration-300">
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
          <div className="bg-[var(--color-primary)] text-[var(--color-on-primary)] px-4 py-2.5 shadow-lg z-[100] relative">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-normal flex items-center gap-2 text-center">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-none">
                  Impersonating: {user.name} ({user.role})
                </span>
              </span>
              <button 
                onClick={exitImpersonation}
                className="bg-black text-[var(--color-primary)] px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-normal hover:bg-[var(--color-bg-deep)]  active:scale-95 transition-all whitespace-nowrap shadow-sm"
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
            <div className="max-w-[1600px] mx-auto dashboard-content min-w-0">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
