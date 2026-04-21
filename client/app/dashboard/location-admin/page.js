'use client';
import AdminDashboard from '../admin/page';

export default function LocationAdminDashboard() {
  // Scoping is handled by AdminDashboard's useAuth() and the fact that location_admin has selectedLocation fixed.
  return <AdminDashboard />;
}
