'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { routeForPage } from '../config/routes';
import { canViewPage } from '../config/pages';
import { getLandingPath } from '../config/navigation';
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
  const { user, locations = [] } = useAuth();

  if (!user) return null;

  // Candidate links per role, in priority order. Each carries the pageKey it
  // opens; the first 4 the user may actually VIEW become the tabs, then a "More"
  // tab is appended. Gating uses the allowedPages model (canViewPage) — the same
  // rule the sidebar and the route guard apply — instead of the legacy coarse
  // permission flags, which could show a tab for a page the guard then bounced.
  // Hrefs come from the shared route registry (config/routes.js).
  const r = (pageKey) => routeForPage(user.role, pageKey);
  let candidates = [];
  switch (user.role) {
    case 'staff':
      candidates = [
        { name: 'Home', pageKey: 'page_overview', href: r('page_overview'), icon: LayoutDashboard, exact: true },
        { name: 'Tables', pageKey: 'page_tables', href: r('page_tables'), icon: Coffee },
        { name: 'Orders', pageKey: 'page_orders', href: r('page_orders'), icon: Receipt },
        { name: 'Menu', pageKey: 'page_menu', href: r('page_menu'), icon: UtensilsCrossed },
      ];
      break;
    case 'chef':
      candidates = [
        { name: 'Kitchen', pageKey: 'page_orders', href: r('page_orders'), icon: UtensilsCrossed, exact: true },
        { name: 'Menu', pageKey: 'page_menu', href: r('page_menu'), icon: Coffee },
        { name: 'Stats', pageKey: 'page_myperformance', href: r('page_myperformance'), icon: Zap },
        { name: 'Expenses', pageKey: 'page_expenses', href: r('page_expenses'), icon: Receipt },
      ];
      break;
    case 'branch_admin':
      candidates = [
        { name: 'Home', pageKey: 'page_overview', href: r('page_overview'), icon: LayoutDashboard, exact: true },
        { name: 'Tables', pageKey: 'page_tables', href: r('page_tables'), icon: Coffee },
        { name: 'Staff', pageKey: 'page_staff', href: r('page_staff'), icon: Users },
        { name: 'Revenue', pageKey: 'page_revenue', href: r('page_revenue'), icon: TrendingUp },
        { name: 'Menu', pageKey: 'page_menu', href: r('page_menu'), icon: UtensilsCrossed },
        { name: 'Attendance', pageKey: 'page_attendance', href: r('page_attendance'), icon: CalendarCheck },
      ];
      break;
    case 'location_admin':
      candidates = [
        { name: 'Home', pageKey: 'page_overview', href: r('page_overview'), icon: LayoutDashboard, exact: true },
        { name: 'Tables', pageKey: 'page_tables', href: r('page_tables'), icon: Coffee },
        { name: 'Menu', pageKey: 'page_menu', href: r('page_menu'), icon: UtensilsCrossed },
        { name: 'Revenue', pageKey: 'page_revenue', href: r('page_revenue'), icon: TrendingUp },
        // Bookings is a legacy shim route not in the registry; keep until the
        // bookings pages collapse into /dashboard/reservations.
        { name: 'Bookings', pageKey: 'page_reservations', href: '/dashboard/location-admin/bookings', icon: CalendarDays },
      ];
      break;
    case 'admin':
    case 'super_admin':
      candidates = [
        { name: 'Home', href: user.role === 'super_admin' ? r('page_admincenter') : r('page_overview'), icon: LayoutDashboard, exact: true },
        { name: 'Orders', pageKey: 'page_orders', href: r('page_orders'), icon: Receipt },
        { name: 'Revenue', pageKey: 'page_revenue', href: r('page_revenue'), icon: TrendingUp },
        { name: 'Inventory', pageKey: 'page_inventory', href: r('page_inventory'), icon: Package },
        { name: 'Staff', pageKey: 'page_staff', href: r('page_staff'), icon: Users },
        { name: 'Tables', pageKey: 'page_tables', href: r('page_tables'), icon: Coffee },
      ];
      break;
    default:
      candidates = [{ name: 'Home', href: getLandingPath(user, locations), icon: LayoutDashboard, exact: true }];
  }

  const links = candidates.filter((c) => !c.pageKey || canViewPage(user, c.pageKey)).slice(0, 4);

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
