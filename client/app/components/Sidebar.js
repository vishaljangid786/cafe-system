'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  Coffee, LayoutDashboard, Users, MapPin,
  Receipt, CalendarCheck, Wallet, ChevronLeft,
  Settings, LogOut, UtensilsCrossed, Tag, CalendarDays,
  ChevronRight, Target
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
      links.push({ name: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard });
      links.push({ name: 'Locations', href: '/dashboard/admin/locations', icon: MapPin });
      links.push({ name: 'Personnel', href: '/dashboard/admin/staff', icon: Users });
      links.push({ name: 'Attendance', href: '/dashboard/admin/attendance', icon: CalendarCheck });
      links.push({ name: 'Finance', href: '/dashboard/admin/payroll', icon: Wallet });
      links.push({ name: 'Expenses', href: '/dashboard/admin/expenses', icon: Receipt });
      links.push({ name: 'Operations', href: '/dashboard/admin/tables', icon: Coffee });
      links.push({ name: 'Cuisine', href: '/dashboard/admin/menu', icon: UtensilsCrossed });
      links.push({ name: 'Promotions', href: '/dashboard/admin/coupons', icon: Tag });
      links.push({ name: 'Reservations', href: '/dashboard/admin/bookings', icon: CalendarDays });
      links.push({ name: 'Intelligence', href: '/dashboard/admin/location-comparison', icon: Target });
    } else if (role === 'location_admin') {
      links.push({ name: 'Overview', href: '/dashboard/location-admin', icon: LayoutDashboard });
      links.push({ name: 'My Personnel', href: '/dashboard/location-admin/staff', icon: Users });
      links.push({ name: 'Attendance', href: '/dashboard/location-admin/attendance', icon: CalendarCheck });
      links.push({ name: 'Compensation', href: '/dashboard/location-admin/salary', icon: Wallet });
      links.push({ name: 'Expenditures', href: '/dashboard/location-admin/expenses', icon: Receipt });
      links.push({ name: 'Floor Map', href: '/dashboard/location-admin/tables', icon: Coffee });
      links.push({ name: 'Cuisine', href: '/dashboard/location-admin/menu', icon: UtensilsCrossed });
      links.push({ name: 'Reservations', href: '/dashboard/location-admin/bookings', icon: CalendarDays });
    } else {
      links.push({ name: 'My Station', href: '/dashboard/staff', icon: LayoutDashboard });
      links.push({ name: 'Floor Map', href: '/dashboard/staff/tables', icon: Coffee });
      links.push({ name: 'Cuisine', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
      links.push({ name: 'Reservations', href: '/bookings', icon: CalendarDays });
    }

    links.push({ name: 'My Profile', href: '/dashboard/profile', icon: Settings });

    return links;
  };

  const links = getLinks();

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 80 }
  };

  const content = (
    <div className="h-full flex flex-col glass-morphism bg-white/70 dark:bg-zinc-950/40 backdrop-blur-2xl border-y-0 border-l border-r-2 border-zinc-200 dark:border-r-2 dark:border-zinc-800/50 transition-colors duration-300">
      {/* Brand Header */}
      <div className={`h-20 flex items-center ${isExpanded ? 'px-6' : 'justify-center'} shrink-0`}>
        <motion.div layout className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
            <Coffee size={22} strokeWidth={2.5} />
          </div>
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap"
              >
                Cafe<span className="text-amber-500 font-black">OS</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className={`flex-1 py-4 custom-scrollbar ${isExpanded ? 'px-3 overflow-y-auto' : 'px-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'}`}>
        <div className="space-y-1">
          {links.map((link, idx) => {
            const Icon = link.icon;
            const isOverview = link.name === 'Overview' || link.name === 'My Station';
            const isActive = isOverview ? pathname === link.href : pathname.startsWith(link.href);

            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => isMobile && setIsMobileOpen(false)}
                className={`
                  group flex items-center relative py-2.5 rounded-xl transition-all duration-300
                  ${isExpanded ? 'px-3' : 'justify-center px-0'}
                  ${isActive
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200'}
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0 transition-transform group-hover:scale-110" />

                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-3 text-sm font-semibold tracking-tight whitespace-nowrap"
                  >
                    {link.name}
                  </motion.span>
                )}

                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute left-0 w-1 h-5 rounded-r-full bg-amber-500"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                {!isExpanded && !isMobile && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {link.name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* User Footer */}
      <div className={`p-4 mt-auto border-t border-zinc-200 dark:border-zinc-800/50`}>
        <div className={`flex items-center gap-3 ${isExpanded ? '' : 'justify-center'}`}>
          <Link href="/dashboard/profile" className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 relative group cursor-pointer overflow-hidden">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-amber-500">{user.name.substring(0, 2).toUpperCase()}</span>
            )}
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
          </Link>
          {isExpanded && (
            <Link href="/dashboard/profile" className="min-w-0 flex-1 group">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate leading-none group-hover:text-amber-500 transition-colors">{user.name}</p>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-1 truncate">{user.role.replace('_', ' ')}</p>
            </Link>
          )}
          {isExpanded && (
            <button
              onClick={logout}
              className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Collapse Toggle (Desktop only) */}
      {!isMobile && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-10 h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-colors z-50 shadow-sm"
        >
          {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      )}
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
        animate={isMobile ? { x: isMobileOpen ? 0 : -260 } : (isExpanded ? 'expanded' : 'collapsed')}
        variants={sidebarVariants}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`
          fixed inset-y-0 left-0 z-[101] 
          lg:static lg:block
        `}
      >
        {content}
      </motion.aside>
    </>
  );
};

export default Sidebar;
