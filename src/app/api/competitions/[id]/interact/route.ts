import { NextResponse } from 'next/server';

// src/app/api/competitions/[id]/interact/route.ts - Event Interaction Endpoint
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type } = body;

    return NextResponse.json({
      success: true,
      eventId: id,
      type,
      message: 'Interaction recorded'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
