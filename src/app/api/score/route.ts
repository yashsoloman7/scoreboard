import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Score from '@/models/Score';

// Submit a score
export async function POST(req: Request) {
    await dbConnect();
    try {
        const body = await req.json();
        const score = await Score.create(body);
        return NextResponse.json(score, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 });
    }
}

// Get all scores for a competition (e.g., for results page)
export async function GET(req: Request) {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get('competitionId');

    if (!competitionId) {
        return NextResponse.json({ error: 'Competition ID required' }, { status: 400 });
    }

    try {
        const query: any = { competitionId };

        const judgeId = searchParams.get('judgeId');
        if (judgeId) query.judgeId = judgeId;

        const performerId = searchParams.get('performerId');
        if (performerId) query.performerId = performerId;

        const scores = await Score.find(query);
        return NextResponse.json(scores);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
    }
}
