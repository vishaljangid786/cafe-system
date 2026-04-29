'use client';
import { useAuth } from '../../../context/AuthContext';
import StaffPerformanceDashboard from '../../../components/StaffPerformanceDashboard';

export default function ChefPerformancePage() {
  const { user } = useAuth();

  if (!user) return null;

  return <StaffPerformanceDashboard user={user} role="chef" />;
}
