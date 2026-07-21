'use client';
import ReportsHub from '@/app/components/hubs/ReportsHub';

// Order Reports + Staff Reports as one tabbed page.
export default function ReportsPage() {
  return <ReportsHub defaultTab="orders" />;
}
