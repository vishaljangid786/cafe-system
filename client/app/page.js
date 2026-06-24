'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import LoadingScreen from './components/ui/LoadingScreen';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'super_admin' || user.role === 'admin') router.push('/dashboard/admin');
        else if (user.role === 'branch_admin') router.push('/dashboard/branch-admin');
        else if (user.role === 'location_admin') router.push('/dashboard/location-admin');
        else if (user.role === 'chef') router.push('/dashboard/chef');
        else router.push('/dashboard/staff');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return <LoadingScreen message="Starting CafeOS" />;
}
