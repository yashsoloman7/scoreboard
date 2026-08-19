import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Performer from '@/models/Performer';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    await dbConnect();
    const { id } = await params;
    try {
        const performer = await Performer.findById(id);
        if (!performer) {
            return NextResponse.json({ error: 'Performer not found' }, { status: 404 });
        }
        return NextResponse.json(performer);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch performer' }, { status: 500 });
    }
}
