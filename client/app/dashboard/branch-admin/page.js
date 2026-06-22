'use client';
import AdminDashboard from '../admin/page';

export default function BranchAdminDashboard() {
  // Server-side scoping keeps branch admins inside their assigned branches.
  return <AdminDashboard />;
}
