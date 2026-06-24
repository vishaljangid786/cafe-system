'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Coffee, Receipt, UtensilsCrossed, Package,
  TrendingUp, Users, CalendarCheck, CalendarDays, Zap, Menu as MenuIcon,
} from 'lucide-react';

/**
 * Mobile-first bottom tab bar. Shows on phones AND tablets (hidden at lg+, where
 * the desktop sidebar takes over). Each role gets up to 4 of its most-used links
 * plus a "More" tab that opens the full sidebar drawer — so nothing is lost while
 * keeping the bar to a max of 5 tabs.
 *
 * `onMore` is wired from the dashboard layout to open the mobile sidebar drawer.
 */
export default function BottomNav({ onMore }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const hasPerm = (key) => user.role === 'super_admin' || user.permissions?.[key] === true;

  // Candidate links per role, in priority order. `perm` (optional) gates the link;
  // the first 4 that pass become the tabs, then a "More" tab is appended.
  let candidates = [];
  switch (user.role) {
    case 'staff':
      candidates = [
        { name: 'Home', href: '/dashboard/staff', icon: LayoutDashboard, exact: true },
        { name: 'Tables', href: '/dashboard/staff/tables', icon: Coffee },
        { name: 'Orders', href: '/dashboard/staff/orders', icon: Receipt },
        { name: 'Menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed },
      ];
      break;
    case 'chef':
      candidates = [
        { name: 'Kitchen', href: '/dashboard/chef', icon: UtensilsCrossed, exact: true },
        { name: 'Menu', href: '/dashboard/staff/menu', icon: Coffee },
        { name: 'Stats', href: '/dashboard/chef/performance', icon: Zap },
        { name: 'Expenses', href: '/dashboard/chef/expenses', icon: Receipt },
      ];
      break;
    case 'branch_admin':
      candidates = [
        { name: 'Home', href: '/dashboard/branch-admin', icon: LayoutDashboard, exact: true },
        { name: 'Tables', href: '/dashboard/branch-admin/tables', icon: Coffee, perm: 'manageOrders' },
        { name: 'Staff', href: '/dashboard/branch-admin/staff', icon: Users, perm: 'manageStaff' },
        { name: 'Revenue', href: '/dashboard/branch-admin/revenue', icon: TrendingUp, perm: 'viewRevenue' },
        { name: 'Menu', href: '/dashboard/branch-admin/menu', icon: UtensilsCrossed, perm: 'manageOrders' },
        { name: 'Attendance', href: '/dashboard/branch-admin/attendance', icon: CalendarCheck, perm: 'manageStaff' },
      ];
      break;
    case 'location_admin':
      candidates = [
        { name: 'Home', href: '/dashboard/location-admin', icon: LayoutDashboard, exact: true },
        { name: 'Tables', href: '/dashboard/location-admin/tables', icon: Coffee, perm: 'manageOrders' },
        { name: 'Menu', href: '/dashboard/location-admin/menu', icon: UtensilsCrossed, perm: 'manageOrders' },
        { name: 'Revenue', href: '/dashboard/location-admin/revenue', icon: TrendingUp, perm: 'viewRevenue' },
        { name: 'Bookings', href: '/dashboard/location-admin/bookings', icon: CalendarDays },
      ];
      break;
    case 'admin':
    case 'super_admin':
      candidates = [
        { name: 'Home', href: user.role === 'super_admin' ? '/dashboard/super-admin' : '/dashboard/admin', icon: LayoutDashboard, exact: true },
        { name: 'Orders', href: '/dashboard/admin/orders', icon: Receipt, perm: 'viewOrders' },
        { name: 'Revenue', href: '/dashboard/admin/revenue', icon: TrendingUp, perm: 'viewRevenue' },
        { name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package, perm: 'manageOrders' },
        { name: 'Staff', href: '/dashboard/admin/staff', icon: Users, perm: 'manageStaff' },
        { name: 'Tables', href: '/dashboard/admin/tables', icon: Coffee, perm: 'manageOrders' },
      ];
      break;
    default:
      candidates = [{ name: 'Home', href: '/dashboard', icon: LayoutDashboard, exact: true }];
  }

  const links = candidates.filter((c) => !c.perm || hasPerm(c.perm)).slice(0, 4);

  const isActive = (link) =>
    link.exact ? pathname === link.href : (pathname === link.href || pathname.startsWith(link.href + '/'));

  const anyActive = links.some(isActive);

  const tabClass = (active) =>
    `relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1.5 group`;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-90 bg-(--color-surface)/95 backdrop-blur border-t border-(--color-border)"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around max-w-xl mx-auto px-1 pt-1.5 pb-1">
        {links.map((link) => {
          const active = isActive(link);
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
              <div className={`p-1.5 rounded-lg transition-colors duration-200 ${active ? 'bg-primary text-(--color-on-primary)' : 'text-(--color-text-muted) group-hover:text-(--color-text-primary)'}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-semibold truncate max-w-full ${active ? 'text-primary' : 'text-(--color-text-muted)'}`}>
                {link.name}
              </span>
            </Link>
          );
        })}

        <button type="button" onClick={onMore} className={tabClass(false)} aria-label="Open full menu">
          <div className={`p-1.5 rounded-lg transition-colors duration-200 ${!anyActive ? 'bg-primary text-(--color-on-primary)' : 'text-(--color-text-muted) group-hover:text-(--color-text-primary)'}`}>
            <MenuIcon size={20} strokeWidth={!anyActive ? 2.5 : 2} />
          </div>
          <span className={`text-[10px] font-semibold ${!anyActive ? 'text-primary' : 'text-(--color-text-muted)'}`}>
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
