'use client';
import { useAuth } from '../../../context/AuthContext';
import StaffPerformanceDashboard from '../../../components/StaffPerformanceDashboard';

export default function StaffPerformancePage() {
  const { user } = useAuth();

  if (!user) return null;

  return <StaffPerformanceDashboard user={user} role={user.role} />;
}
