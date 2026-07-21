'use client';
import { useMemo, useState } from 'react';
import { Users, CalendarCheck, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { canViewPage } from '@/app/config/pages';
import TeamDirectory from './TeamDirectory';
import AttendanceSection from './AttendanceSection';
import LoginAsSection from './LoginAsSection';

// Unified People hub: the old Users, Staff, Attendance and Login-As
// (impersonate) pages folded into one page. Every historical route renders
// this hub with a preselected tab, so old bookmarks and nav items keep
// working. Tabs stay individually permission-gated: the layout guard still
// gates each route by its own pageKey, and inside the hub a tab only shows
// when the viewer's allowedPages / role grant that section.
//
// Only the active tab is mounted, so each section keeps its original
// self-contained fetching exactly as it had as a standalone page.
const TABS = [
  {
    key: 'team',
    label: 'Team',
    icon: Users,
    // Users and Staff were merged earlier — either grant opens the directory.
    visible: (user) => canViewPage(user, 'page_staff') || canViewPage(user, 'page_users'),
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    visible: (user) => canViewPage(user, 'page_attendance'),
  },
  {
    key: 'login-as',
    label: 'Login As',
    icon: ArrowRightLeft,
    // Same reach the standalone page had: the page grant plus the actor check
    // it enforced internally. Anyone currently impersonating always sees it so
    // they can switch back.
    visible: (user) =>
      (canViewPage(user, 'page_impersonate')
        && (['super_admin', 'admin', 'branch_admin'].includes(user?.role) || user?.permissions?.impersonateUsers === true))
      || !!user?.isImpersonating || !!user?.impersonatedBy,
  },
];

export default function PeopleHub({ defaultTab = 'team' }) {
  const { user } = useAuth();
  const visibleTabs = useMemo(() => TABS.filter((t) => t.visible(user)), [user]);
  const [active, setActive] = useState(defaultTab);
  // A route can request a tab the viewer isn't granted (e.g. deep link to
  // /admin/attendance without page_attendance never passes the layout guard,
  // but /admin/staff with only page_users does) — fall back to the first
  // tab this viewer may see.
  const activeTab = visibleTabs.find((t) => t.key === active) || visibleTabs[0];

  if (!user) return null;

  if (!activeTab) {
    return (
      <div className="py-32 bg-(--color-surface) rounded-xl border border-dashed border-(--color-border) flex flex-col items-center justify-center text-(--color-text-muted)">
        <ShieldAlert size={48} className="mb-4 opacity-30" />
        <p className="text-sm font-medium">You don&apos;t have access to any People sections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {visibleTabs.length > 1 && (
        <div className="inline-flex flex-wrap items-center gap-1 bg-(--color-surface) border border-(--color-border) rounded-xl p-1.5 shadow-sm">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-normal transition-all ${
                activeTab.key === t.key
                  ? 'bg-primary text-(--color-on-primary) shadow-sm'
                  : 'text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-(--color-surface-soft)'
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab.key === 'team' && <TeamDirectory />}
      {activeTab.key === 'attendance' && <AttendanceSection />}
      {activeTab.key === 'login-as' && <LoginAsSection />}
    </div>
  );
}
