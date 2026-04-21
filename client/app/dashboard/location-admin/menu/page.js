'use client';
import MenuManagementPage from '../../admin/menu/page';

export default function LocationAdminMenuPage() {
  // We can reuse the same component as the API should handle scoping via the selectedLocation in context or automatically based on user role.
  // However, since we want strict filtering for location admins, we can wrap it or ensure the API call uses the locationId.
  return <MenuManagementPage />;
}
