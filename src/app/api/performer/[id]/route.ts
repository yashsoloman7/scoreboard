import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/performer/[id]/route.ts - Supabase Single Performer Query Endpoint
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: performer, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !performer) {
      return NextResponse.json({ error: 'Performer not found' }, { status: 404 });
    }
    return NextResponse.json(performer);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch performer' },
      { status: 500 }
    );
  }
}
