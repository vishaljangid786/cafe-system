'use client';
import InventoryHub from '@/app/components/hubs/InventoryHub';

// Inventory + Procurement as one tabbed page.
export default function StockPage() {
  return <InventoryHub defaultTab="inventory" />;
}
