'use client';
import { Users, CalendarCheck, ArrowRightLeft, Wallet, ShieldCheck } from 'lucide-react';
import { canViewPage } from '@/app/config/pages';
import TabHub from '@/app/components/ui/TabHub';
import TeamDirectory from './TeamDirectory';
import AttendanceSection from './AttendanceSection';
import LoginAsSection from './LoginAsSection';
import PayrollPage from '@/app/dashboard/admin/payroll/page';
import PermissionManager from '@/app/components/ui/PermissionManager';

// Everything about PEOPLE in one page: who they are, whether they showed up,
// what they are paid, what they may do, and signing in as them.
//
// These were five separate routes (Users, Staff, Attendance, Salaries,
// Permissions, Login As) that all answered questions about the same person, so
// managing one employee meant walking the sidebar. Each is a tab now; every old
// route still resolves here with its tab preselected, so bookmarks keep working.
//
// Gating is per tab — see TabHub. A branch admin without the Permissions grant
// simply has no Permissions tab.
const TABS = [
  {
    key: 'team',
    label: 'Team',
    icon: Users,
    // Users and Staff were merged first — either grant opens the directory.
    visible: (user) => canViewPage(user, 'page_staff') || canViewPage(user, 'page_users'),
    render: () => <TeamDirectory />,
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    pageKey: 'page_attendance',
    render: () => <AttendanceSection />,
  },
  {
    key: 'salaries',
    label: 'Salaries',
    icon: Wallet,
    pageKey: 'page_salaries',
    render: () => <PayrollPage />,
  },
  {
    key: 'permissions',
    label: 'Permissions',
    icon: ShieldCheck,
    // location_admin is barred from PUT /users/:id/permissions server-side, so
    // showing them the editor would only produce 403s.
    visible: (user) =>
      canViewPage(user, 'page_permissions')
      && ['super_admin', 'admin', 'branch_admin'].includes(user?.role),
    render: () => <PermissionManager />,
  },
  {
    key: 'login-as',
    label: 'Login As',
    icon: ArrowRightLeft,
    // The page grant plus the actor check the standalone page enforced
    // internally. Anyone currently impersonating always sees it, so they always
    // have a way back to their own account.
    visible: (user) =>
      (canViewPage(user, 'page_impersonate')
        && (['super_admin', 'admin', 'branch_admin'].includes(user?.role) || user?.permissions?.impersonateUsers === true))
      || !!user?.isImpersonating || !!user?.impersonatedBy,
    render: () => <LoginAsSection />,
  },
];

export default function PeopleHub({ defaultTab = 'team' }) {
  return (
    <TabHub
      tabs={TABS}
      defaultTab={defaultTab}
      emptyMessage="You don't have access to any People section."
    />
  );
}
