import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/score/route.ts - Supabase-backed Scores API Endpoint
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('competitionId') || searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Competition ID required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: scores, error } = await supabase
      .from('scores')
      .select('*')
      .eq('event_id', eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(scores || []);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}
