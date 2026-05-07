'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { 
  Coffee, LayoutDashboard, UtensilsCrossed, 
  Receipt, History, User, Bell, Package, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const links = [];

  if (user.role === 'staff') {
    links.push({ name: 'Tables', href: '/dashboard/staff/tables', icon: Coffee });
    links.push({ name: 'Orders', href: '/dashboard/staff/orders', icon: Receipt });
    links.push({ name: 'Menu', href: '/dashboard/staff/menu', icon: UtensilsCrossed });
    links.push({ name: 'Profile', href: '/dashboard/profile', icon: User });
  } else if (user.role === 'chef') {
    links.push({ name: 'Kitchen', href: '/dashboard/chef', icon: UtensilsCrossed });
    links.push({ name: 'Menu', href: '/dashboard/staff/menu', icon: Coffee });
    links.push({ name: 'Performance', href: '/dashboard/chef/performance', icon: Zap });
    links.push({ name: 'Profile', href: '/dashboard/profile', icon: User });
  } else if (user.role === 'super_admin' || user.role === 'admin') {
    links.push({ name: 'Home', href: user.role === 'super_admin' ? '/dashboard/super-admin' : '/dashboard/admin', icon: LayoutDashboard });
    links.push({ name: 'Orders', href: '/dashboard/admin/orders', icon: Receipt });
    links.push({ name: 'Inventory', href: '/dashboard/admin/inventory', icon: Package });
    links.push({ name: 'Profile', href: '/dashboard/profile', icon: User });
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2 bg-[var(--color-bg)]/80 backdrop-blur-2xl border-t border-[var(--color-border)] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
 
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className="relative flex flex-col items-center gap-1 p-2 group"
            >
              <div className={`p-2 rounded-2xl transition-all duration-300 ${
                isActive 
                  ? 'bg-[var(--color-primary)] text-black shadow-lg shadow-[var(--color-primary)]/30 -translate-y-1' 
                  : 'text-[var(--color-text-muted)]'
              }`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {link.name}
              </span>
              
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-active"
                  className="absolute -top-2 w-1 h-1 bg-[var(--color-primary)] rounded-full"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
