import { NextResponse } from 'next/server';

const AUTH_ROUTES = new Set(['/login', '/signup', '/setup']);

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const hasAuthCookie = request.cookies.has('token');

  if (pathname.startsWith('/dashboard') && !hasAuthCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_ROUTES.has(pathname) && hasAuthCookie) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/setup'],
};
