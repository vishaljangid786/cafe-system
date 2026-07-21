'use client';
import { TrendingUp, Receipt, CreditCard } from 'lucide-react';
import TabHub from '@/app/components/ui/TabHub';
import RevenuePage from '@/app/dashboard/admin/revenue/page';
import ExpensesPage from '@/app/dashboard/admin/expenses/page';
import PaymentInformationPage from '@/app/dashboard/admin/payment-intelligence/page';

// Money in, money out, and how it was taken. Three routes that were always read
// together when answering "how did we do".
const TABS = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUp, pageKey: 'page_revenue', render: () => <RevenuePage /> },
  { key: 'expenses', label: 'Expenses', icon: Receipt, pageKey: 'page_expenses', render: () => <ExpensesPage /> },
  { key: 'payments', label: 'Payment Insights', icon: CreditCard, pageKey: 'page_paymentinsights', render: () => <PaymentInformationPage /> },
];

export default function FinanceHub({ defaultTab = 'revenue' }) {
  return <TabHub tabs={TABS} defaultTab={defaultTab} emptyMessage="You don't have access to any Finance section." />;
}
