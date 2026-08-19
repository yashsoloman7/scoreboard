import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import dbConnect from '@/lib/db';
import Competition from '@/models/Competition';

export const dynamic = 'force-dynamic';

export default async function JudgesPage() {
    await dbConnect();
    // Fetch only active or upcoming competitions
    const competitions = await Competition.find({ status: { $in: ['active', 'upcoming'] } });

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6 text-center text-white bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                Active Competitions for Judging
            </h1>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {competitions.map((comp) => (
                    <Card key={comp._id} className="hover:border-indigo-500/50 transition-colors">
                        <CardHeader>
                            <CardTitle>{comp.name}</CardTitle>
                            <p className="text-sm text-gray-400">
                                {new Date(comp.date).toLocaleDateString()}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mb-4">
                                <span className={`px-2 py-1 text-xs rounded ${comp.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                                    {comp.status.toUpperCase()}
                                </span>
                                <span className="text-sm text-gray-400">{comp.judges.length} Judges Assigned</span>
                            </div>
                            <Link href={`/judge/${comp._id}`} className="block">
                                <Button className="w-full">
                                    Enter Judge Interface
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
                {competitions.length === 0 && (
                    <p className="text-center text-gray-500 col-span-full">No active competitions found.</p>
                )}
            </div>
        </div>
    );
}
