'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getLandingPath } from '../config/navigation';
import LoadingScreen from '../components/ui/LoadingScreen';

// /dashboard has no content of its own — every role lands on its own home
// route (/dashboard/admin, /dashboard/staff, ...). This stub exists so a
// typed or bookmarked "/dashboard" resolves instead of 404ing: it forwards
// to the viewer's landing page, or /login when signed out.
export default function DashboardIndexPage() {
  const router = useRouter();
  const { user, locations, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? getLandingPath(user, locations) : '/login');
  }, [user, locations, loading, router]);

  return <LoadingScreen fullScreen={false} />;
}
