import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const userCookie = request.cookies.get('user')?.value;
  const { pathname } = request.nextUrl;

  // Paths that do not require authentication
  const isAuthRoute = pathname.startsWith('/login');

  if (!token && !isAuthRoute) {
    // Redirect to login if unauthenticated and trying to access protected routes
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthRoute) {
    // Prevent authenticated users from visiting login
    if (userCookie) {
      try {
        const user = JSON.parse(userCookie);
        if (user.role === 'super_admin' || user.role === 'admin') {
          return NextResponse.redirect(new URL('/dashboard/admin', request.url));
        } else if (user.role === 'location_admin') {
          return NextResponse.redirect(new URL('/dashboard/location-admin', request.url));
        } else {
          return NextResponse.redirect(new URL('/dashboard/staff', request.url));
        }
      } catch (err) {
        // Fallback
        return NextResponse.redirect(new URL('/dashboard/staff', request.url));
      }
    }
  }

  // Basic Role-Based Routing Prevention (e.g., Staff trying to hit /dashboard/admin)
  if (token && userCookie && pathname.startsWith('/dashboard/')) {
    try {
      const user = JSON.parse(userCookie);
      
      if (pathname.startsWith('/dashboard/admin') && !['super_admin', 'admin'].includes(user.role)) {
        return NextResponse.redirect(new URL('/login', request.url)); // Or an unauthorized page
      }
      
      if (pathname.startsWith('/dashboard/location-admin') && !['location_admin', 'super_admin', 'admin'].includes(user.role)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      if (pathname.startsWith('/dashboard/staff') && !['staff', 'location_admin', 'admin', 'super_admin'].includes(user.role)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch (err) {
      // Ignored
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
