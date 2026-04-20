'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({ children }) {
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
        setIsSidebarExpanded(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-accent/30 selection:text-accent">
      {/* Sidebar - Desktop & Mobile */}
      <Sidebar 
        isExpanded={isSidebarExpanded} 
        setIsExpanded={setIsSidebarExpanded}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isMobile={isMobile} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Navbar 
          onToggleSidebar={() => isMobile ? setIsMobileMenuOpen(!isMobileMenuOpen) : setIsSidebarExpanded(!isSidebarExpanded)} 
          sidebarExpanded={isSidebarExpanded}
          isMobile={isMobile}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background/50 p-4 md:p-8 custom-scrollbar">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>

        {/* Ambient background glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px] pointer-events-none z-[-1]" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/5 rounded-full blur-[120px] pointer-events-none z-[-1]" />
      </div>
    </div>
  );
}