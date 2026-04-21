'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'super_admin' || user.role === 'admin') router.push('/dashboard/admin');
        else if (user.role === 'location_admin') router.push('/dashboard/location-admin');
        else router.push('/dashboard/staff');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="h-12 w-12 rounded-xl border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
    </div>
  );
}
