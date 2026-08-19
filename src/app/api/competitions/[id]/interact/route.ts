import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import dbConnect from '@/lib/db';
import Competition from '@/models/Competition';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { type, text } = body; // type: 'like' | 'comment'

        await dbConnect();
        const competition = await Competition.findById(id);

        if (!competition) {
            return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
        }

        const userId = session.user.email; // Using email as ID since we don't have a user database yet

        if (type === 'like') {
            const isLiked = competition.likes.includes(userId);
            if (isLiked) {
                competition.likes = competition.likes.filter((id: string) => id !== userId);
            } else {
                competition.likes.push(userId);
            }
        } else if (type === 'comment') {
            if (!text || !text.trim()) {
                return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
            }
            competition.comments.push({
                userId,
                userName: session.user.name || 'Anonymous',
                text: text.trim(),
                timestamp: new Date(),
            });
        } else {
            return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 });
        }

        await competition.save();

        return NextResponse.json({
            success: true,
            likes: competition.likes,
            comments: competition.comments
        });

    } catch (error) {
        console.error('Error handling interaction:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
