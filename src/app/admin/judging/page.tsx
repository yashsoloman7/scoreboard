"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Trophy, ExternalLink, Calendar, ChevronRight, Globe, EyeOff, ListOrdered, Activity, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import LiveMonitor from '@/components/LiveMonitor';

export default function JudgingPanel() {
    const [competitions, setCompetitions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [monitorId, setMonitorId] = useState<string | null>(null);

    useEffect(() => {
        fetchCompetitions();
    }, []);

    const fetchCompetitions = async () => {
        try {
            const res = await fetch('/api/competitions?all=true');
            if (res.ok) {
                const data = await res.json();
                setCompetitions(data);
            }
        } catch (error) {
            console.error("Failed to fetch competitions:", error);
        } finally {
            setLoading(false);
        }
    };

    const togglePublish = async (competitionId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;

        try {
            const res = await fetch(`/api/competitions/${competitionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublished: newStatus })
            });

            if (res.ok) {
                setCompetitions(competitions.map(c =>
                    c._id === competitionId ? { ...c, isPublished: newStatus } : c
                ));
            }
        } catch (error) {
            console.error("Failed to toggle publish status:", error);
        }
    };

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
                    Judging Control Panel
                </h1>
                <p className="text-slate-400">Monitor active competitions and judge assignments.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {competitions.map((comp) => (
                    <motion.div
                        key={comp._id}
                        whileHover={{ y: -5 }}
                        className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0f172a]/60 hover:border-cyan-500/30 transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${comp.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                comp.status === 'completed' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                }`}>
                                {comp.status?.toUpperCase() || 'UPCOMING'}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 truncate" title={comp.name}>{comp.name}</h3>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center text-sm text-slate-400">
                                <Calendar className="w-4 h-4 mr-2 opacity-70" />
                                {new Date(comp.date).toLocaleDateString()}
                            </div>
                            <div className="flex items-center text-sm text-slate-400">
                                <Users className="w-4 h-4 mr-2 opacity-70" />
                                {comp.judges?.length || 0} Judges Assigned
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {/* Publishing Controls */}
                            {comp.isPublished ? (
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => togglePublish(comp._id, true)}
                                    className="w-full text-xs mb-2 bg-red-600/80 hover:bg-red-500 border border-red-500/30"
                                >
                                    <EyeOff className="w-3 h-3 mr-2" /> Unpublish (Set to Draft)
                                </Button>
                            ) : (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => togglePublish(comp._id, false)}
                                    className="w-full text-xs mb-2 bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20"
                                >
                                    <Globe className="w-3 h-3 mr-2" /> Publish Results (Go Live)
                                </Button>
                            )}

                            <Link href={`/judge/${comp._id}`} className="flex-1">
                                <Button variant="secondary" className="w-full text-xs" size="sm">
                                    <ExternalLink className="w-3 h-3 mr-2" /> Judge View
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="flex-1 text-xs border-white/10 hover:bg-white/5 text-cyan-400 border-cyan-500/30"
                                size="sm"
                                onClick={() => setMonitorId(comp._id)}
                            >
                                <Activity className="w-3 h-3 mr-1" /> Monitor
                            </Button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <Link href={`/admin/competitions/${comp._id}/results`}>
                                <Button className="w-full text-xs bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30" size="sm">
                                    <Trophy className="w-3 h-3 mr-2" /> Results
                                </Button>
                            </Link>
                            <Link href={`/admin/competitions/${comp._id}/performers`}>
                                <Button className="w-full text-xs bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30" size="sm">
                                    <ListOrdered className="w-3 h-3 mr-2" /> Program
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                ))}

                {competitions.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
                        No competitions found.
                    </div>
                )}
            </div>

            {/* Live Monitor Overlay */}
            <AnimatePresence>
                {monitorId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <div className="w-full max-w-2xl h-[400px] relative">
                            <button
                                onClick={() => setMonitorId(null)}
                                className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors flex items-center gap-2"
                            >
                                Close Monitor <X className="w-6 h-6" />
                            </button>
                            <LiveMonitor
                                competitionId={monitorId}
                                onClose={() => setMonitorId(null)}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
