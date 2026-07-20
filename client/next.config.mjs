/** @type {import('next').NextConfig} */

// Same-origin API proxy.
//
// The Express API is deployed on a DIFFERENT domain (cafe-system-three.vercel.app)
// than this client (cafe-orgaization-system-by-vishal.vercel.app). The auth `token`
// cookie is therefore a THIRD-PARTY cookie on the client origin, and modern browsers
// (Safari ITP, Brave, Chrome's third-party-cookie phase-out / Incognito) block it —
// so it is dropped on reload and the user is logged out.
//
// Routing /api/* through THIS origin makes the cookie first-party (stored & sent by
// every browser). In production set the client env NEXT_PUBLIC_API_URL=/api so the
// browser calls this origin; Next forwards each request to API_PROXY_TARGET.
//
// Local dev is unaffected: there NEXT_PUBLIC_API_URL points straight at
// http://localhost:5000/api, so axios never hits the /api rewrite.
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET || 'http://localhost:5000';

// Security response headers applied to every route. The CSP keeps compatibility
// with the current inline theme/runtime scripts; move to nonce-based scripts later.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:5000 http://127.0.0.1:5000 ws://localhost:5000 ws://127.0.0.1:5000 wss:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' }, // clickjacking
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
