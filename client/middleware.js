import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Paths that do not require authentication
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/setup');

  if (!token && !isAuthRoute) {
    // Redirect to login if unauthenticated and trying to access protected routes
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthRoute) {
    if (pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard/profile', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/setup'],
};
