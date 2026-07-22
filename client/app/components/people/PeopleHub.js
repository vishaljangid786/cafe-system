'use client';
import { Users, CalendarCheck, Wallet } from 'lucide-react';
import { canViewPage } from '@/app/config/pages';
import TabHub from '@/app/components/ui/TabHub';
import TeamDirectory from './TeamDirectory';
import AttendanceSection from './AttendanceSection';
import PayrollPage from '@/app/dashboard/admin/payroll/page';

// Everything about PEOPLE in one page: who they are, whether they showed up, and
// what they are paid.
//
// Permissions editing and "Login As" are no longer their own tabs — both are now
// per-row actions in the Team directory's ⋮ menu (permission-editing modal and an
// eye/Login-As action), each shown only to a viewer who may use it. That keeps
// every person's controls in one place instead of a separate tab.
//
// Gating is per tab — see TabHub.
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
