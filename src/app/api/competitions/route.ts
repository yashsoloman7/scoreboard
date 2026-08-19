import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Competition from '@/models/Competition';

export async function GET(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get('all') === 'true';

    try {
        const query = showAll ? {} : { isPublished: true };
        const competitions = await Competition.find(query).sort({ date: 1 });
        return NextResponse.json(competitions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch competitions' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    await dbConnect();
    try {
        const body = await req.json();
        const competition = await Competition.create(body);
        return NextResponse.json(competition, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 });
    }
}
