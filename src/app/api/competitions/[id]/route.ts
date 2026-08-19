import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Competition from '@/models/Competition';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    const { id } = await params;

    try {
        const competition = await Competition.findById(id);
        if (!competition) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }
        return NextResponse.json(competition);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch competition' }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    const { id } = await params;

    try {
        const body = await req.json();
        const updatedCompetition = await Competition.findByIdAndUpdate(id, body, { new: true });

        if (!updatedCompetition) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        return NextResponse.json(updatedCompetition);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update competition' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    await dbConnect();
    const { id } = await params;

    try {
        const deletedCompetition = await Competition.findByIdAndDelete(id);

        if (!deletedCompetition) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Competition deleted successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete competition' }, { status: 500 });
    }
}
