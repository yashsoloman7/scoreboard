import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/competitions/route.ts - Supabase-backed Competitions API Endpoint
export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('*')
      .neq('environment', 'practice')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(competitions || []);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch competitions' },
      { status: 500 }
    );
  }
}
