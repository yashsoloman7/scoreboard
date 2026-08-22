import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/performer/route.ts - Supabase-backed Performers API Endpoint
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    const supabase = await createServerSupabaseClient();
    let query = supabase.from('participants').select('*').order('performance_order', { ascending: true });
    if (competitionId) {
      query = query.eq('competition_id', competitionId);
    }
    const { data: participants, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(participants || []);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch performers' },
      { status: 500 }
    );
  }
}
