'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from '../components/ui/PageTransition';
import { useAuth } from '../context/AuthContext';
import CommandPalette from '../components/ui/CommandPalette';

export default function DashboardLayout({ children }) {
  const { user, exitImpersonation } = useAuth();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
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

  const handleToggleSidebar = (val) => {
    setIsSidebarExpanded(val);
    localStorage.setItem('sidebar-expanded', val);
  };

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
          <div className="bg-amber-500 text-black px-4 py-2.5 shadow-lg z-[100] relative">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 text-center">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-none">
                  Impersonating: {user.name} ({user.role})
                </span>
              </span>
              <button 
                onClick={exitImpersonation}
                className="bg-black text-amber-500 px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all whitespace-nowrap shadow-xl"
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

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent p-4 md:p-8 custom-scrollbar relative">
          <PageTransition>
            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>
          </PageTransition>

          {/* Bottom spacing for mobile */}
          <div className="h-20 lg:hidden" />
        </main>

        {/* Premium ambient glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-primary)]/10 rounded-full blur-[160px] pointer-events-none z-[-1] animate-pulse-slow" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-secondary)]/10 rounded-full blur-[160px] pointer-events-none z-[-1] animate-pulse-slow" />
      </div>

      {/* Decorative noise overlay for texture */}
      {/* <div className="fixed inset-0 pointer-events-none z-[200] opacity-[0.015] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" /> */}
      
      <CommandPalette />
    </div>
  );
}