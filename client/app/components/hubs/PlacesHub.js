'use client';
import { Store, MapPin } from 'lucide-react';
import TabHub from '@/app/components/ui/TabHub';
import CafesPage from '@/app/dashboard/admin/cafes/page';
import BranchesPage from '@/app/dashboard/admin/locations/page';

// Cafes and Branches are the same job at two levels — a cafe is the brand, a
// branch is an outlet of it — so they were always opened one after the other.
// One tabbed page keeps both, gated per tab.
const TABS = [
  { key: 'cafes', label: 'Cafes', icon: Store, pageKey: 'page_cafes', render: () => <CafesPage /> },
  { key: 'branches', label: 'Branches', icon: MapPin, pageKey: 'page_branches', render: () => <BranchesPage /> },
];

export default function PlacesHub({ defaultTab = 'cafes' }) {
  return <TabHub tabs={TABS} defaultTab={defaultTab} emptyMessage="You don't have access to Cafes or Branches." />;
}
