'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'super_admin' || user.role === 'admin') router.push('/dashboard/admin');
        else if (user.role === 'branch_admin') router.push('/dashboard/branch-admin');
        else router.push('/dashboard/staff');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-amber-600" size={40} />
    </div>
  );
}
