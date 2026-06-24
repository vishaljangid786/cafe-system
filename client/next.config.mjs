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
  process.env.API_PROXY_TARGET || 'https://cafe-system-three.vercel.app';

const nextConfig = {
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
