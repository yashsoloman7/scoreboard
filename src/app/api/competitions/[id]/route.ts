import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/competitions/[id]/route.ts - Supabase Competition Query Endpoint
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: competition, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }
    return NextResponse.json(competition);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch competition' },
      { status: 500 }
    );
  }
}
