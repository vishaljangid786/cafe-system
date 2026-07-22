'use client';
import { Store, MapPin, Network } from 'lucide-react';
import TabHub from '@/app/components/ui/TabHub';
import CafesPage from '@/app/dashboard/admin/cafes/page';
import BranchesPage from '@/app/dashboard/admin/locations/page';
import BranchHierarchy from '@/app/components/hubs/BranchHierarchy';

// Cafes and Branches are the same job at two levels — a cafe is the brand, a
// branch is an outlet of it — so they were always opened one after the other.
// One tabbed page keeps both, gated per tab. The Hierarchy tab shows the whole
// cafe → branch → people org tree in one place.
const TABS = [
  { key: 'cafes', label: 'Cafes', icon: Store, pageKey: 'page_cafes', render: () => <CafesPage /> },
  { key: 'branches', label: 'Branches', icon: MapPin, pageKey: 'page_branches', render: () => <BranchesPage /> },
  { key: 'hierarchy', label: 'Hierarchy', icon: Network, pageKey: 'page_branches', render: () => <BranchHierarchy /> },
];

export default function PlacesHub({ defaultTab = 'cafes' }) {
  return <TabHub tabs={TABS} defaultTab={defaultTab} emptyMessage="You don't have access to Cafes or Branches." />;
}
