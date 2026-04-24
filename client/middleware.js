import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const userCookie = request.cookies.get('user')?.value;
  const { pathname } = request.nextUrl;

  // Paths that do not require authentication
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/setup');

  if (!token && !isAuthRoute) {
    // Redirect to login if unauthenticated and trying to access protected routes
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthRoute) {
    // If it's the login page, always redirect authenticated users to dashboard
    if (pathname.startsWith('/login')) {
      if (userCookie) {
        try {
          const user = JSON.parse(userCookie);
          if (user.role === 'super_admin' || user.role === 'admin') {
            return NextResponse.redirect(new URL('/dashboard/admin', request.url));
          } else if (user.role === 'branch_admin') {
            return NextResponse.redirect(new URL('/dashboard/branch-admin', request.url));
          } else if (user.role === 'chef') {
            return NextResponse.redirect(new URL('/dashboard/chef', request.url));
          } else {
            return NextResponse.redirect(new URL('/dashboard/staff', request.url));
          }
        } catch (err) {
          return NextResponse.redirect(new URL('/dashboard/staff', request.url));
        }
      }
    }
    
    // For /signup, allow super_admin and admin to stay (for personnel registration)
    // Others should be redirected to their dashboard
    if (pathname.startsWith('/signup')) {
      if (userCookie) {
        try {
          const user = JSON.parse(userCookie);
          if (user.role !== 'super_admin' && user.role !== 'admin') {
            // Staff, Chef, and Branch Admin shouldn't be here
            return NextResponse.redirect(new URL('/dashboard/staff', request.url));
          }
          // Admins stay on /signup to register others
        } catch (err) {
          return NextResponse.redirect(new URL('/dashboard/staff', request.url));
        }
      }
    }
  }

  // Basic Role-Based Routing Prevention (e.g., Staff trying to hit /dashboard/admin)
  if (token && userCookie && pathname.startsWith('/dashboard/')) {
    try {
      const user = JSON.parse(userCookie);
      
      if (pathname.startsWith('/dashboard/admin') && !['super_admin', 'admin'].includes(user.role)) {
        const allowedSubPaths = ['/dashboard/admin/orders'];
        if (user.role === 'branch_admin' && allowedSubPaths.some(p => pathname.startsWith(p))) {
          // Allow branch_admin to access order surveillance
        } else {
          return NextResponse.redirect(new URL('/login', request.url));
        }
      }
      
      if (pathname.startsWith('/dashboard/branch-admin') && !['branch_admin', 'super_admin', 'admin'].includes(user.role)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      if (pathname.startsWith('/dashboard/staff') && !['staff', 'branch_admin', 'admin', 'super_admin', 'chef'].includes(user.role)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      if (pathname.startsWith('/dashboard/chef') && !['chef', 'super_admin', 'admin'].includes(user.role)) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch (err) {
      // Ignored
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/setup'],
};
