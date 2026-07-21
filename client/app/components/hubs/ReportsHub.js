'use client';
import { TrendingUp, Users } from 'lucide-react';
import TabHub from '@/app/components/ui/TabHub';
import OrderAnalyticsDashboard from '@/app/dashboard/admin/orders/analytics/page';
import AdminStaffReportsPage from '@/app/dashboard/admin/staff-reports/page';

// What sold, and who sold it.
const TABS = [
  { key: 'orders', label: 'Order Reports', icon: TrendingUp, pageKey: 'page_orderreports', render: () => <OrderAnalyticsDashboard /> },
  { key: 'staff', label: 'Staff Reports', icon: Users, pageKey: 'page_staffreports', render: () => <AdminStaffReportsPage /> },
];

export default function ReportsHub({ defaultTab = 'orders' }) {
  return <TabHub tabs={TABS} defaultTab={defaultTab} emptyMessage="You don't have access to any Reports section." />;
}
