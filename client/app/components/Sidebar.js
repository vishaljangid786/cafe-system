'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationModal from './NotificationModal';
import {
  Coffee, LayoutDashboard, Users, MapPin,
  Receipt, CalendarCheck, Wallet, ChevronLeft,
  Settings, LogOut, UtensilsCrossed, Tag, CalendarDays,
  ChevronRight, Target, TrendingUp, Crown, Package,
  Calendar, Bell, Send, History, CreditCard, AlertCircle, Zap, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen, isMobile }) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifModal, setShowNotifModal] = useState(false);

  if (!user) return null;

  const getLinks = () => {
    const role = user.role;
    const links = [];
    if (role === 'super_admin') {
      links.push({ name: 'Users', href: '/dashboard/admin/users', icon: Users });
      links.push({ name: 'Security Logs', href: '/dashboard/admin/audit-logs', icon: Activity });
    }
    if (role === 'super_admin' || role === 'admin') {
      if (role === 'super_admin') {
        links.push({ name: 'Executive Hub', href: '/dashboard/super-admin', icon: Zap });
      } else {
        links.push({ name: 'Overview', href: '/dashboard/admin', icon: LayoutDashboard });
      }
      links.push({ name: 'Branches', href: '/dashboard/admin/locations', icon: MapPin });
      links.push({ name: 'Staff', href: '/dashboard/admin/staff', icon: Users });
      links.push({ name: 'Attendance', href: '/dashboard/admin/attendance', icon: CalendarCheck });
      links.push({ name: 'Salaries', href: '/dashboard/admin/payroll', icon: Wallet });
      links.push({ name: 'Revenue', href: '/dashboard/admin/revenue', icon: TrendingUp });
      links.push({ name: 'Expenses', href: '/dashboard/admin/expenses', icon: Receipt });
      links.push({ name: 'Tables', href: '/dashboard/admin/tables', icon: Coffee });
      links.push({ name: 'Menu', href: '/dashboard/admin/menu', icon: UtensilsCrossed });
      links.push({ name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package });
      links.push({ name: 'Offers', href: '/dashboard/admin/coupons', icon: Tag });
      links.push({ name: 'Loyalty & CRM', href: '/dashboard/admin/customers', icon: Crown });
      links.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
      links.push({ name: 'All Orders', href: '/dashboard/admin/orders', icon: Receipt });
      links.push({ name: 'Order Reports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp });
      links.push({ name: 'Branch Compare', href: '/dashboard/admin/location-comparison', icon: Target });
      links.push({ name: 'Staff Reports', href: '/dashboard/admin/staff-reports', icon: TrendingUp });
      links.push({ name: 'Payment Intel', href: '/dashboard/admin/payment-intelligence', icon: CreditCard });
      links.push({ name: 'Command Center', href: '/dashboard/admin/command-center', icon: AlertCircle });
      links.push({ name: 'Smart Forecast', href: '/dashboard/admin/forecasting', icon: TrendingUp });
      links.push({ name: 'Export Center', href: '/dashboard/admin/exports', icon: Download });
    } else if (role === 'branch_admin') {
      links.push({ name: 'Overview', href: '/dashboard/branch-admin', icon: LayoutDashboard });
      links.push({ name: 'All Orders', href: '/dashboard/admin/orders', icon: Receipt });
      links.push({ name: 'Order Reports', href: '/dashboard/admin/orders/analytics', icon: TrendingUp });
      links.push({ name: 'Staff List', href: '/dashboard/branch-admin/staff', icon: Users });
      links.push({ name: 'Attendance', href: '/dashboard/branch-admin/attendance', icon: CalendarCheck });
      links.push({ name: 'Salaries', href: '/dashboard/branch-admin/salary', icon: Wallet });
      links.push({ name: 'Revenue', href: '/dashboard/branch-admin/revenue', icon: TrendingUp });
      links.push({ name: 'Expenses', href: '/dashboard/branch-admin/expenses', icon: Receipt });
      links.push({ name: 'Tables', href: '/dashboard/branch-admin/tables', icon: Coffee });
      links.push({ name: 'Menu', href: '/dashboard/branch-admin/menu', icon: UtensilsCrossed });
      links.push({ name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package });
      links.push({ name: 'Loyalty & CRM', href: '/dashboard/admin/customers', icon: Crown });
      links.push({ name: 'Export Center', href: '/dashboard/admin/exports', icon: Download });
      links.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
      links.push({ name: 'Staff Reports', href: '/dashboard/branch-admin/staff-reports', icon: TrendingUp });
    } else if (role === 'chef') {
      links.push({ name: 'Kitchen', href: '/dashboard/chef', icon: UtensilsCrossed });
      links.push({ name: 'Branch Menu', href: '/dashboard/staff/menu', icon: Coffee });
      links.push({ name: 'My Performance', href: '/dashboard/staff/performance', icon: TrendingUp });
      links.push({ name: 'Work History', href: '/dashboard/staff/work-history', icon: History });
      links.push({ name: 'My Attendance', href: '/dashboard/staff/attendance', icon: Calendar });
      links.push({ name: 'Expenses', href: '/dashboard/chef/expenses', icon: Receipt });
    } else {
      links.push({ name: 'My Dashboard', href: '/dashboard/staff', icon: LayoutDashboard });
      links.push({ name: 'New Orders', href: '/dashboard/staff/orders', icon: Receipt });
      links.push({ name: 'Tables', href: '/dashboard/staff/tables', icon: Coffee });
      links.push({ name: 'Menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
      links.push({ name: 'My Performance', href: '/dashboard/staff/performance', icon: TrendingUp });
      links.push({ name: 'Work History', href: '/dashboard/staff/work-history', icon: History });
      links.push({ name: 'Expenses', href: '/dashboard/staff/expenses', icon: Receipt });
      links.push({ name: 'Reservations', href: '/dashboard/reservations', icon: CalendarDays });
    }


    links.push({ name: 'Notifications', href: '/dashboard/notifications', icon: Bell, badge: unreadCount });
    links.push({ name: 'My Profile', href: '/dashboard/profile', icon: Settings });

    return links;
  };

  const links = getLinks();
  const showLabels = isExpanded || isMobile;

  const sidebarVariants = {
    expanded: { width: 260, x: 0 },
    collapsed: { width: 80, x: 0 },
    mobileOpen: { width: 280, x: 0 },
    mobileClosed: { width: 280, x: -280 }
  };

  const content = (
    <div className="h-full flex flex-col bg-transparent border-r border-[var(--color-border)] transition-all duration-300 relative overflow-hidden">
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
      <div className={`flex-1 py-2 custom-scrollbar ${showLabels ? 'px-3 overflow-y-auto' : 'px-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'}`}>
        <div className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isExactMatch = ['Overview', 'My Dashboard', 'All Orders', 'New Orders'].includes(link.name);
            const isActive = isExactMatch ? pathname === link.href : pathname.startsWith(link.href);

            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => isMobile && setIsMobileOpen(false)}
                className={`
                  group flex items-center relative py-2.5 my-2 rounded-xl transition-all duration-200
                  ${showLabels ? 'px-3' : 'justify-center px-0'}
                  ${isActive
                    ? 'bg-primary text-white font-bold'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-text-primary)]'}
                `}
              >
                <div className="relative z-10">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0 transition-transform group-hover:scale-105" />
                  {link.badge > 0 && !showLabels && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-[var(--color-danger)] rounded-full ring-2 ring-[var(--color-surface)]" />
                  )}
                </div>

                {showLabels && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-3 flex-1 flex items-center justify-between z-10"
                  >
                    <span className="text-sm tracking-tight whitespace-nowrap">{link.name}</span>
                    {link.badge > 0 && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${isActive ? 'bg-primary text-white' : 'bg-[var(--color-danger)] text-white'}`}>{link.badge}</span>
                    )}
                  </motion.div>
                )}

                {!showLabels && !isMobile && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-[var(--color-text-primary)] text-[var(--color-bg)] text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                    {link.name}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Transmission Hub Action */}
      <div className="px-3 mb-4">
        <button
          onClick={() => setShowNotifModal(true)}
          className={`
            w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] hover:bg-[var(--color-bg)] transition-all group
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
      <div className={`p-4 mt-auto border-t border-[var(--color-border)] bg-[var(--color-bg-soft)]/50`}>
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
    </>
  );
};

export default Sidebar;
