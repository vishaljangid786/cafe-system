'use client';
import AdminDashboard from '../admin/page';

export default function BranchAdminDashboard() {
  // Scoping is handled by AdminDashboard's useAuth() and the fact that branch_admin has selectedLocation fixed.
  return <AdminDashboard />;
}
