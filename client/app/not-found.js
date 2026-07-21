'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, ArrowRight } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { getLandingPath } from './config/navigation';

// Shown for any URL that matches no route — a mistyped address, or a bookmark to
// a page that has since been folded into a hub.
//
// A dead end is the wrong answer for someone who is already signed in: they know
// where they want to be, so send them there. The short delay is deliberate —
// redirecting instantly makes a mistyped URL look like the app silently ignored
// it, and leaves nothing on screen to explain what happened.
const REDIRECT_AFTER_MS = 2500;

export default function NotFound() {
  const router = useRouter();
  const { user, loading, locations = [] } = useAuth();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (loading) return;
    const dest = user ? getLandingPath(user, locations) : '/login';
    setTarget(dest);
    const t = setTimeout(() => router.replace(dest), REDIRECT_AFTER_MS);
    return () => clearTimeout(t);
  }, [user, loading, locations, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-(--color-bg-base)">
      <div className="w-full max-w-md text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
          <Compass size={30} />
        </div>

        <p className="text-5xl font-semibold tracking-tight text-(--color-text-primary)">404</p>
        <h1 className="text-lg font-semibold text-(--color-text-primary) mt-3">
          This page doesn&apos;t exist
        </h1>
        <p className="text-sm text-(--color-text-muted) mt-2 leading-relaxed">
          The address may be mistyped, or the page has moved — several sections were
          recently combined into tabbed pages.
        </p>

        {!loading && target && (
          <>
            <button
              type="button"
              onClick={() => router.replace(target)}
              className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-(--color-on-primary) text-xs font-semibold tracking-normal hover:opacity-90 transition-opacity"
            >
              {user ? 'Go to my dashboard' : 'Go to sign in'}
              <ArrowRight size={15} />
            </button>
            <p className="text-[11px] font-medium text-(--color-text-muted) mt-3">
              Taking you there automatically…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
