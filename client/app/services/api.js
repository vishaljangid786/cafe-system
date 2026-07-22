import axios from 'axios';
import Cookies from 'js-cookie';
import { rememberIntendedPath } from '../utils/returnTo';

// Resolve the API base URL at runtime (in the browser).
//
// When the API is served from a DIFFERENT domain than this client (our Vercel
// setup: client on cafe-orgaization-system…, API on cafe-system-three…), the
// auth `token` cookie is a THIRD-PARTY cookie. Modern browsers (Safari ITP,
// Brave, Chrome's third-party-cookie phase-out / Incognito) drop it on reload —
// which silently logs the user out.
//
// To keep the cookie FIRST-PARTY we route every request through THIS origin's
// `/api` path, which next.config.mjs transparently rewrites to the real API
// (API_PROXY_TARGET). The browser then sees the cookie as belonging to this
// origin, so it is stored and sent on every reload.
//
// A direct localhost API (local full-stack dev) is left untouched: localhost
// ports are the same *site*, so SameSite=Lax cookies already work there.
const resolveBaseURL = () => {
  const configured = process.env.NEXT_PUBLIC_API_URL || 'https://cafe-system-three.vercel.app/api';

  // SSR / non-browser: nothing to proxy against — use the configured value.
  if (typeof window === 'undefined') return configured;

  // Already a relative path → it targets this origin's proxy. Use as-is.
  if (configured.startsWith('/')) return configured;

  let apiHost;
  try {
    apiHost = new URL(configured).hostname;
  } catch {
    return configured; // not an absolute URL we can reason about
  }

  const isLocalApi = ['localhost', '127.0.0.1'].includes(apiHost);
  const isSameHost = apiHost === window.location.hostname;

  // Remote, cross-origin API → go through the same-origin proxy so the auth
  // cookie stays first-party and survives reloads.
  if (!isLocalApi && !isSameHost) return '/api';

  return configured;
};

const api = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // httpOnly cookie is automatically sent with every request — no manual token needed
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const csrfToken = Cookies.get('csrfToken');
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers['x-csrf-token'] = csrfToken;
    }
  }

  // File uploads must not share the 10s default. A photo upload travels
  // browser → same-origin proxy → API serverless function → Cloudinary, and a
  // COLD serverless function plus a real photo routinely takes longer than 10s.
  // When it does, axios aborts and the user sees "upload failed" — then a retry
  // hits a now-warm function and works, which is exactly the "have to try a few
  // times" symptom. Give anything carrying a file a much longer budget.
  const isUpload =
    (typeof FormData !== 'undefined' && config.data instanceof FormData)
    || String(config.headers?.['Content-Type'] || '').includes('multipart/form-data');
  if (isUpload && (config.timeout == null || config.timeout < 60000)) {
    config.timeout = 60000;
  }

  return config;
});

// Response Interceptor: Handle Global Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      Cookies.remove('selectedLocation');
      // Public pages must never be bounced to /login on a 401. The /auth/profile
      // probe legitimately 401s for logged-out visitors browsing these pages.
      const publicPaths = ['/login', '/signup', '/bookings', '/order', '/feedback'];
      const onPublicPath = typeof window !== 'undefined' &&
        publicPaths.some((p) => window.location.pathname === p || window.location.pathname.startsWith(`${p}/`));
      const isProfileProbe = error.config?.url?.includes('/auth/profile');
      if (typeof window !== 'undefined' && !onPublicPath && !isProfileProbe) {
        // A token that lapsed mid-work is the case this matters most for: without
        // it you sign back in and land on the dashboard home, having lost the page
        // you were actually on.
        rememberIntendedPath(window.location.pathname);
        window.location.href = '/login';
      }
    }

    // A blocked cafe answers 403 on every route, which is indistinguishable
    // from a routine permission denial by status alone — hence the explicit
    // code. Broadcast it so the dashboard can swap itself for the lock screen
    // instead of every page firing its own "could not load" toast.
    if (status === 403 && error.response?.data?.code === 'CAFE_SUSPENDED') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cafe-suspended', { detail: error.response.data.suspension || {} })
        );
      }
    }

    // A removed account keeps whatever token it was holding until that token
    // expires, so bounce it out rather than leaving a dead dashboard on screen.
    if (status === 403 && error.response?.headers?.['x-account-state'] === 'deleted') {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        Cookies.remove('selectedLocation');
        window.location.href = '/login?removed=1';
      }
    }

    // For GET requests returning 404, treat it as "no data found" rather than a
    // hard failure. Pages that do setData(res.data?.data || []) will just render
    // an empty state instead of firing a "could not load" toast.
    // NOTE: this can mask a genuinely broken/mistyped endpoint as "empty", so in
    // development we log the swallowed 404 to keep real bugs visible.
    if (status === 404 && error.config?.method === 'get' && error.config?.allowEmpty404 === true) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[api] GET ${error.config?.url} returned 404 — treating as empty data. Verify the endpoint is correct.`);
      }
      return Promise.resolve({ data: { success: true, data: null } });
    }

    return Promise.reject(error);
  }
);

export default api;
