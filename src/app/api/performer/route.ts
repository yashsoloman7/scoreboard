import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Performer from '@/models/Performer';

export async function POST(req: Request) {
    await dbConnect();
    try {
        const body = await req.json();
        const performer = await Performer.create(body);
        return NextResponse.json(performer, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create performer' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    try {
        const query = competitionId ? { competitionId } : {};
        // Sort by performanceOrder ASC, then by creation time
        const performers = await Performer.find(query).sort({ performanceOrder: 1, createdAt: 1 });
        return NextResponse.json(performers);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch performers' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Performer ID required' }, { status: 400 });
    }

    try {
        await Performer.findByIdAndDelete(id);
        return NextResponse.json({ message: 'Performer deleted' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete performer' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Performer ID required' }, { status: 400 });
    }

    try {
        const body = await req.json();
        const updatedPerformer = await Performer.findByIdAndUpdate(id, body, { new: true });
        return NextResponse.json(updatedPerformer);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update performer' }, { status: 500 });
    }
}
