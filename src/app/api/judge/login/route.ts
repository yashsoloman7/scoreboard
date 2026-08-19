import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Competition from '@/models/Competition';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const { competitionId, judgeId, password } = body;

        if (!competitionId || !judgeId || !password) {
            return NextResponse.json(
                { message: 'Competition ID, Judge ID, and Password are required' },
                { status: 400 }
            );
        }

        const competition = await Competition.findById(competitionId);
        if (!competition) {
            return NextResponse.json(
                { message: 'Competition not found' },
                { status: 404 }
            );
        }

        const judge = competition.judges.find((j: any) => j.id === judgeId);
        if (!judge) {
            return NextResponse.json(
                { message: 'Judge not found' },
                { status: 404 }
            );
        }

        // Direct password comparison for now (in a real app, use hashing here)
        if (judge.password !== password) {
            return NextResponse.json(
                { message: 'Invalid credentials' },
                { status: 401 }
            );
        }

        return NextResponse.json(
            { message: 'Login successful', judge },
            { status: 200 }
        );

    } catch (error) {
        console.error('Judge login error:', error);
        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
