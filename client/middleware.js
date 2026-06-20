import { NextResponse } from 'next/server';

export function middleware() {
  // Auth is handled by AuthContext against the API session. Next middleware
  // cannot reliably see API-owned cookies when client/server use different domains.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/setup'],
};
