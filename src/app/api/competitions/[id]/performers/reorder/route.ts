import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// src/app/api/competitions/[id]/performers/reorder/route.ts - Supabase Performers Reorder Endpoint
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { order } = body;

    if (!order || !Array.isArray(order)) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const updates = order.map((item: { id?: string; _id?: string; performanceOrder: number }) => {
      const targetId = item.id || item._id;
      return supabase
        .from('participants')
        .update({ performance_order: item.performanceOrder })
        .eq('id', targetId);
    });

    await Promise.all(updates);
    return NextResponse.json({ message: 'Order updated successfully' });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update order' },
      { status: 500 }
    );
  }
}
