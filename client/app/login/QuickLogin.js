'use client';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, Crown, Shield, Building2, MapPin, ChefHat, User } from 'lucide-react';

// Dev-only convenience. All seeded demo accounts share one password.
const DEMO_PASSWORD = 'password123';

// Grouped by role, in descending privilege order. Labels are display-only.
const ROLE_GROUPS = [
  {
    role: 'super_admin',
    label: 'Super Admin',
    icon: Crown,
    accounts: [{ name: 'Super', email: 'super@cafeos.com' }],
  },
  {
    role: 'admin',
    label: 'Admin',
    icon: Shield,
    accounts: [
      { name: 'Rajesh', email: 'rajesh.admin@cafeos.com' },
      { name: 'Meera', email: 'meera.admin@cafeos.com' },
    ],
  },
  {
    role: 'branch_admin',
    label: 'Branch Admin',
    icon: Building2,
    accounts: [
      { name: 'Arjun · BA1', email: 'arjun.ba1@cafeos.com' },
      { name: 'Kavya · BA1', email: 'kavya.ba1@cafeos.com' },
      { name: 'Rohan · Multi', email: 'rohan.multi@cafeos.com' },
      { name: 'Aditya · BA2', email: 'aditya.ba2@cafeos.com' },
      { name: 'Karthik · BA3', email: 'karthik.ba3@cafeos.com' },
    ],
  },
  {
    role: 'location_admin',
    label: 'Location Admin',
    icon: MapPin,
    accounts: [
      { name: 'Sneha · LA1', email: 'sneha.la1@cafeos.com' },
      { name: 'Nikhil · LA2', email: 'nikhil.la2@cafeos.com' },
      { name: 'Divya · LA3', email: 'divya.la3@cafeos.com' },
    ],
  },
  {
    role: 'chef',
    label: 'Chef',
    icon: ChefHat,
    accounts: [
      { name: 'Ramesh', email: 'ramesh.chef1@cafeos.com' },
      { name: 'Suresh', email: 'suresh.chef2@cafeos.com' },
      { name: 'Mahesh', email: 'mahesh.chef3@cafeos.com' },
    ],
  },
  {
    role: 'staff',
    label: 'Staff',
    icon: User,
    accounts: [
      { name: 'Priya', email: 'priya.staff1@cafeos.com' },
      { name: 'Anjali', email: 'anjali.staff2@cafeos.com' },
      { name: 'Deepak', email: 'deepak.staff3@cafeos.com' },
    ],
  },
];

export default function QuickLogin() {
  const { login } = useAuth();
  const [open, setOpen] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  // The panel exposes seeded demo accounts + a shared password, so it is hidden in
  // production builds BY DEFAULT. For a public demo deployment it can be explicitly
  // opted-in by setting NEXT_PUBLIC_ENABLE_QUICK_LOGIN=true at build time. Both env
  // vars are inlined by Next at build time, so when the flag is unset the whole panel
  // (and the hardcoded credentials) is still tree-shaken out of a production bundle.
  // Hooks are declared above this line so the rules-of-hooks are not violated.
  const quickLoginEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_QUICK_LOGIN === 'true';
  if (!quickLoginEnabled) return null;

  const handleQuickLogin = async (email) => {
    if (pendingEmail) return;
    setPendingEmail(email);
    const res = await login(email, DEMO_PASSWORD);
    if (!res.success) {
      toast.error(res.message || 'Quick login failed.');
      setPendingEmail(null); // on success the route changes & this unmounts
    }
  };

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed border-(--color-border) text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-hover) transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <Zap size={13} className="text-primary" />
          Quick Login (Demo)
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              {ROLE_GROUPS.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.role}>
                    <div className="flex items-center gap-1.5 mb-2 ml-0.5">
                      <Icon size={12} className="text-(--color-text-muted)" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.accounts.map((acct) => {
                        const isPending = pendingEmail === acct.email;
                        return (
                          <button
                            key={acct.email}
                            type="button"
                            title={acct.email}
                            disabled={!!pendingEmail}
                            onClick={() => handleQuickLogin(acct.email)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-(--color-border) bg-(--color-surface-soft) text-(--color-text-secondary) hover:text-(--color-text-primary) hover:border-primary hover:bg-(--color-hover) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPending && (
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                            {acct.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-(--color-text-muted) ml-0.5">
                All accounts use password <span className="font-mono text-(--color-text-secondary)">{DEMO_PASSWORD}</span>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
