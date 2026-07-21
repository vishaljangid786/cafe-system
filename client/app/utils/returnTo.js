'use client';

// Remember where somebody was actually trying to go, so signing in takes them
// there instead of dumping them on a generic landing page.
//
// This matters most when a session expires mid-work: you click something, the
// token has quietly lapsed, you get bounced to the login screen, and after
// signing in you land on the dashboard home with no idea where you were. With
// this, you come back to the exact page you were on.
//
// sessionStorage, not a cookie or the URL: it survives the redirect to /login
// and back, is scoped to this tab, and disappears when the tab closes — so a
// stale intent from last week never hijacks a fresh login.

const KEY = 'cafeos:returnTo';

// Only same-origin dashboard paths are ever honoured.
//
// This is the open-redirect guard: if any string were accepted, a crafted link
// like /login?next=https://evil.example could send a freshly-authenticated user
// straight off-site, and the URL bar would show they arrived from your app.
// Rejecting anything that doesn't start with a single '/dashboard' closes that.
const isSafePath = (p) =>
  typeof p === 'string'
  && p.startsWith('/dashboard')
  && !p.startsWith('//')          // protocol-relative -> another host
  && !p.includes('://')           // absolute URL smuggled in
  && !p.includes('\\');           // backslash tricks some URL parsers

export const rememberIntendedPath = (pathname) => {
  if (typeof window === 'undefined') return;
  if (!isSafePath(pathname)) return;
  // The landing pages are where an unremembered login already goes, so storing
  // them would add a redirect without changing the destination.
  try { window.sessionStorage.setItem(KEY, pathname); } catch { /* private mode */ }
};

// Read AND clear — an intent is consumed once. Leaving it would re-hijack the
// next login in the same tab.
export const takeIntendedPath = () => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return isSafePath(value) ? value : null;
  } catch {
    return null;
  }
};

export const clearIntendedPath = () => {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
};
