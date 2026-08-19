import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Performer from '@/models/Performer';

export async function PUT(req: Request) {
    await dbConnect();
    const body = await req.json();
    const { order } = body;

    if (!order || !Array.isArray(order)) {
        return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    try {
        const updates = order.map((item: { _id: string, performanceOrder: number }) => {
            return Performer.findByIdAndUpdate(item._id, { performanceOrder: item.performanceOrder });
        });

        await Promise.all(updates);
        return NextResponse.json({ message: 'Order updated successfully' });
    } catch (error) {
        console.error("Reorder error:", error);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}
