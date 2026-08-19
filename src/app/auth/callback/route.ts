// src/app/auth/callback/route.ts - OAuth Exchange Route Handler

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check user role to redirect appropriately
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ensure profile row exists
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || 'User',
          avatar_url: user.user_metadata?.avatar_url || null,
        }, { onConflict: 'id' });

        // Query role
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        const role = userRole?.role;

        if (role === 'super_admin' || role === 'admin') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        } else if (role === 'event_operator') {
          return NextResponse.redirect(new URL('/admin/control-room', request.url));
        } else if (role === 'judge') {
          return NextResponse.redirect(new URL('/judge', request.url));
        } else {
          return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, request.url));
}
