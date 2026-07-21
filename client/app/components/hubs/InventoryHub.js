'use client';
import { Package, Truck } from 'lucide-react';
import TabHub from '@/app/components/ui/TabHub';
import InventoryDashboard from '@/app/dashboard/admin/inventory/page';
import ProcurementPage from '@/app/dashboard/admin/procurement/page';

// Stock on hand and how it gets replenished are one workflow — you check what is
// low, then raise a purchase order for it. They were two sidebar entries.
const TABS = [
  { key: 'inventory', label: 'Inventory', icon: Package, pageKey: 'page_inventory', render: () => <InventoryDashboard /> },
  { key: 'procurement', label: 'Procurement', icon: Truck, pageKey: 'page_procurement', render: () => <ProcurementPage /> },
];

export default function InventoryHub({ defaultTab = 'inventory' }) {
  return <TabHub tabs={TABS} defaultTab={defaultTab} emptyMessage="You don't have access to Inventory or Procurement." />;
}
