'use client';
import FinanceHub from '@/app/components/hubs/FinanceHub';

// Revenue + Expenses + Payment Insights as one tabbed page. The individual
// routes still exist so deep links from other screens keep landing on the exact
// section they meant; the sidebar now shows only this hub.
export default function FinancePage() {
  return <FinanceHub defaultTab="revenue" />;
}
