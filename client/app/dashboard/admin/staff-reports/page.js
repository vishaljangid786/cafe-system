'use client';
import { useAuth } from '../../../context/AuthContext';
import StaffReportsAnalytics from '../../../components/StaffReportsAnalytics';

export default function AdminStaffReportsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return <StaffReportsAnalytics user={user} />;
}
