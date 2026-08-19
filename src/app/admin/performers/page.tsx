"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, Search, Edit, ExternalLink, Music, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function PerformersPage() {
    const [performers, setPerformers] = useState<any[]>([]);
    const [competitions, setCompetitions] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch all performers
                const perfRes = await fetch('/api/performer');
                const perfs = await perfRes.json();

                // Fetch all competitions to map names
                const compRes = await fetch('/api/competitions');
                const comps = await compRes.json();

                const compMap: Record<string, string> = {};
                comps.forEach((c: any) => {
                    compMap[c._id] = c.name;
                });

                setPerformers(perfs);
                setCompetitions(compMap);
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const filteredPerformers = performers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (competitions[p.competitionId] || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#020617]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen container mx-auto px-4 py-8 max-w-7xl">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
                    Performers Directory
                </h1>
                <p className="text-slate-400">View and manage performers across all competitions.</p>
            </motion.div>

            <div className="flex gap-4 mb-8">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <Input
                        placeholder="Search performers or competitions..."
                        className="pl-10 bg-[#0f172a]/60 border-white/10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPerformers.map((performer, idx) => (
                    <motion.div
                        key={performer._id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0f172a]/60 hover:border-cyan-500/30 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
                                    {performer.image ? (
                                        <img src={performer.image} alt={performer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-6 h-6 text-slate-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{performer.name}</h3>
                                    <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded border border-cyan-700/30">
                                        {performer.type}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6 space-y-2">
                            <div className="flex items-center text-sm text-slate-400">
                                <Music className="w-4 h-4 mr-2 opacity-70" />
                                <span className="truncate">{competitions[performer.competitionId] || 'Unknown Competition'}</span>
                            </div>
                        </div>

                        <Link href={`/admin/competitions/${performer.competitionId}/edit`}>
                            <Button variant="outline" className="w-full text-xs border-white/10 hover:bg-white/5" size="sm">
                                <Edit className="w-3 h-3 mr-2" /> Manage in Competition
                            </Button>
                        </Link>
                    </motion.div>
                ))}

                {filteredPerformers.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                        No performers found matching your search.
                    </div>
                )}
            </div>
        </div>
    );
}
