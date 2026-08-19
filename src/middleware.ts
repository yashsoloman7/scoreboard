// src/middleware.ts - Edge Route Protection & Session Refresh Middleware

import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and auth endpoints bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/icons') ||
    pathname === '/auth/login' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/unauthorized'
  ) {
    return NextResponse.next();
  }

  const { response, user, supabase } = await updateSession(request);

  const isProtectedAdminRoute = pathname.startsWith('/admin');
  const isProtectedJudgeRoute = pathname.startsWith('/judge');
  const isPracticeRoute = pathname.startsWith('/practice');

  if (isProtectedAdminRoute || isProtectedJudgeRoute || isPracticeRoute) {
    if (!user) {
      const redirectUrl = new URL('/auth/login', request.url);
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Query user role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const role = userRole?.role || 'unauthorized';

    if (role === 'unauthorized') {
      return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
    }

    // Role-specific route boundaries
    if (isProtectedAdminRoute) {
      if (pathname.startsWith('/admin/control-room')) {
        if (!['super_admin', 'admin', 'event_operator'].includes(role)) {
          return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
        }
      } else {
        if (!['super_admin', 'admin'].includes(role)) {
          return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
        }
      }
    }

    if (isProtectedJudgeRoute) {
      if (!['judge', 'admin', 'super_admin'].includes(role)) {
        return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/judge/:path*',
    '/practice/:path*',
    '/auth/:path*',
  ],
};
