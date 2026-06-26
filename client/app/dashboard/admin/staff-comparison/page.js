'use client';
import { useAuth } from '../../../context/AuthContext';
import StaffComparison from '../../../components/StaffComparison';

export default function AdminStaffComparisonPage() {
  const { user } = useAuth();

  if (!user) return null;

  return <StaffComparison user={user} />;
}
