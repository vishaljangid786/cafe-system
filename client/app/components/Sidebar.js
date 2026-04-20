'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { 
  Coffee, LayoutDashboard, Users, MapPin, 
  Receipt, CalendarCheck, Wallet, ChevronLeft,
  Settings, LogOut, Search, Bell, UtensilsCrossed, Tag, CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen, isMobile }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const getLinks = () => {
    const role = user.role;
    const links = [];

    if (role === 'super_admin' || role === 'admin') {
      links.push({ name: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard });
      links.push({ name: 'Locations', href: '/dashboard/admin/branches', icon: MapPin });
      links.push({ name: 'Staff Matrix', href: '/dashboard/admin/staff', icon: Users });
      links.push({ name: 'Attendance', href: '/dashboard/admin/attendance', icon: CalendarCheck });
      links.push({ name: 'Fiscal Hub', href: '/dashboard/admin/payroll', icon: Wallet });
      links.push({ name: 'Expenses', href: '/dashboard/admin/expenses', icon: Receipt });
      links.push({ name: 'Table Ops', href: '/dashboard/admin/tables', icon: Coffee });
      links.push({ name: 'Menu', href: '/dashboard/admin/menu', icon: UtensilsCrossed });
      links.push({ name: 'Offers', href: '/dashboard/admin/coupons', icon: Tag });
      links.push({ name: 'Bookings', href: '/dashboard/admin/bookings', icon: CalendarDays });
    } else if (role === 'branch_admin') {
      links.push({ name: 'Dashboard', href: '/dashboard/branch-admin', icon: LayoutDashboard });
      links.push({ name: 'My Staff', href: '/dashboard/branch-admin/staff', icon: Users });
      links.push({ name: 'Attendance', href: '/dashboard/branch-admin/attendance', icon: CalendarCheck });
      links.push({ name: 'Salary', href: '/dashboard/branch-admin/salary', icon: Wallet });
      links.push({ name: 'Expenses', href: '/dashboard/branch-admin/expenses', icon: Receipt });
      links.push({ name: 'Tables', href: '/dashboard/branch-admin/tables', icon: Coffee });
      links.push({ name: 'Menu', href: '/dashboard/admin/menu', icon: UtensilsCrossed });
      links.push({ name: 'Bookings', href: '/dashboard/branch-admin/bookings', icon: CalendarDays });
    } else {
      links.push({ name: 'My Dashboard', href: '/dashboard/staff', icon: LayoutDashboard });
      links.push({ name: 'My Tables', href: '/dashboard/staff/tables', icon: Coffee });
      links.push({ name: 'Bookings', href: '/bookings', icon: CalendarDays });
    }

    return links;
  };

  const links = getLinks();

  const sidebarVariants = {
    expanded: { width: 280 },
    collapsed: { width: 88 }
  };

  const content = (
    <div className="h-full flex flex-col glass-card !bg-background/80 !border-y-0 !border-l-0 !rounded-none">
      {/* Brand Header */}
      <div className={`h-20 flex items-center ${isExpanded ? 'px-6' : 'justify-center'} shrink-0`}>
        <motion.div 
          layout
          className="flex items-center gap-3"
        >
          <div className="h-10 w-10 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground shadow-lg shadow-accent/20">
            <Coffee size={22} strokeWidth={2.5} />
          </div>
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xl font-black tracking-tighter text-foreground whitespace-nowrap"
              >
                CAFE<span className="text-accent">OS</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar space-y-8">
        <div>
          {isExpanded && (
            <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 opacity-50">
              Management
            </p>
          )}
          <nav className="space-y-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
              
              return (
                <Link 
                  key={link.name}
                  href={link.href}
                  onClick={() => isMobile && setIsMobileOpen(false)}
                  className={`
                    group flex items-center relative py-3 rounded-2xl transition-all duration-300
                    ${isExpanded ? 'px-4' : 'justify-center px-0'}
                    ${isActive 
                      ? 'bg-accent/10 text-accent' 
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                  `}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                  
                  {isExpanded && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-3 text-sm font-bold tracking-tight whitespace-nowrap"
                    >
                      {link.name}
                    </motion.span>
                  )}

                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute right-2 w-1.5 h-1.5 rounded-full bg-accent"
                    />
                  )}

                  {!isExpanded && !isMobile && (
                    <div className="absolute left-full ml-4 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {link.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Secondary section */}
        <div>
           {isExpanded && (
            <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 opacity-50">
              System
            </p>
          )}
          <nav className="space-y-1.5">
            <button className={`group flex items-center w-full relative py-3 rounded-2xl transition-all duration-300 ${isExpanded ? 'px-4' : 'justify-center'} text-muted-foreground hover:bg-muted/50 hover:text-foreground`}>
              <Settings size={20} />
              {isExpanded && <span className="ml-3 text-sm font-bold tracking-tight">Settings</span>}
            </button>
          </nav>
        </div>
      </div>

      {/* User Footer */}
      <div className={`p-4 mt-auto border-t border-border bg-muted/20`}>
        <div className={`flex items-center gap-3 ${isExpanded ? '' : 'justify-center'}`}>
          <div className="h-10 w-10 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
             <span className="text-xs font-black text-accent">{user.name.substring(0, 2).toUpperCase()}</span>
          </div>
          {isExpanded && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-foreground truncate leading-none">{user.name}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 truncate">{user.role.replace('_', ' ')}</p>
            </div>
          )}
          {isExpanded && (
            <button 
              onClick={logout}
              className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
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
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        initial={false}
        animate={isMobile ? { x: isMobileOpen ? 0 : -280 } : (isExpanded ? 'expanded' : 'collapsed')}
        variants={sidebarVariants}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`
          fixed inset-y-0 left-0 z-[101] bg-background
          lg:static lg:block
        `}
      >
        {content}
      </motion.aside>
    </>
  );
};

export default Sidebar;
