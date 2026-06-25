'use client';
import { useParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import StaffDetailReport from '@/app/components/StaffDetailReport';

export default function BranchAdminStaffDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  if (!user) return null;
  return <StaffDetailReport staffId={id} user={user} />;
}
