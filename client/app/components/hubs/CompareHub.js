'use client';
import { Users, Target } from 'lucide-react';
import TabHub from '@/app/components/ui/TabHub';
import AdminStaffComparisonPage from '@/app/dashboard/admin/staff-comparison/page';
import LocationComparisonPage from '@/app/dashboard/admin/location-comparison/page';

// Side-by-side performance — the same question asked of people and of branches.
const TABS = [
  { key: 'staff', label: 'Staff', icon: Users, pageKey: 'page_staffcomparison', render: () => <AdminStaffComparisonPage /> },
  { key: 'branches', label: 'Branches', icon: Target, pageKey: 'page_branchcompare', render: () => <LocationComparisonPage /> },
];

export default function CompareHub({ defaultTab = 'staff' }) {
  return <TabHub tabs={TABS} defaultTab={defaultTab} emptyMessage="You don't have access to any Comparison section." />;
}
