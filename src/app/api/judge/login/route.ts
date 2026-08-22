import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/judge/login/route.ts - Supabase Judge Verification Endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;
    const supabase = await createServerSupabaseClient();

    if (email) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (profile) {
        return NextResponse.json({ message: 'Judge profile found', judge: profile }, { status: 200 });
      }
    }

    return NextResponse.json(
      { message: 'Please sign in via the universal authentication portal at /auth/login' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
