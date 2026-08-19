"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic2, Users, CheckCircle, Clock } from 'lucide-react';

interface LiveMonitorProps {
    competitionId: string;
    onClose: () => void;
}

export default function LiveMonitor({ competitionId, onClose }: LiveMonitorProps) {
    const [performers, setPerformers] = useState<any[]>([]);
    const [scores, setScores] = useState<any[]>([]);
    const [judges, setJudges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [perfRes, scoreRes, compRes] = await Promise.all([
                    fetch(`/api/performer?competitionId=${competitionId}`),
                    fetch(`/api/score?competitionId=${competitionId}`),
                    fetch(`/api/competitions/${competitionId}`)
                ]);

                if (perfRes.ok && scoreRes.ok && compRes.ok) {
                    setPerformers(await perfRes.json());
                    setScores(await scoreRes.json());
                    const comp = await compRes.json();
                    setJudges(comp.judges || []);
                }
            } catch (error) {
                console.error("Monitor fetch error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, [competitionId]);

    // Determine "Current" Performer
    // Logic: First performer who has < total judges scores, OR the last one updated?
    // Let's go with: The first performer in order who is NOT fully scored.
    const currentPerformer = performers.find(p => {
        const pScores = scores.filter(s => s.performerId === p._id);
        return pScores.length < judges.length;
    });

    // Or if all are scored, show the last one?
    const displayPerformer = currentPerformer || performers[performers.length - 1];

    if (loading) return (
        <div className="flex items-center justify-center p-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    if (!displayPerformer) return (
        <div className="p-10 text-center text-slate-500">
            No performers found.
        </div>
    );

    const perfScores = scores.filter(s => s.performerId === displayPerformer._id);
    const scoredJudgeIds = perfScores.map((s: any) => s.judgeId);

    return (
        <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col h-full">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 flex justify-between items-start">
                <div>
                    <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Live Stage
                    </div>
                    <h2 className="text-3xl font-black text-white">{displayPerformer.name}</h2>
                    <div className="text-indigo-200 text-sm mt-1">{displayPerformer.type} {displayPerformer.groupMembers?.length ? `w/ ${displayPerformer.groupMembers.join(', ')}` : ''}</div>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-black text-cyan-400">
                        {perfScores.length} <span className="text-xl text-slate-500">/ {judges.length}</span>
                    </div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Scores In</div>
                </div>
            </div>

            <div className="p-6 flex-1 bg-[#1e293b]/50">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Judge Status</h3>
                <div className="grid grid-cols-2 gap-3">
                    {judges.map((judge: any) => {
                        const hasScored = scoredJudgeIds.includes(judge.id || judge._id); // Handle both formats if inconsistent
                        return (
                            <div
                                key={judge.id || judge._id}
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${hasScored
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : 'bg-slate-800/50 border-white/5 opacity-60'
                                    }`}
                            >
                                <span className={`font-medium ${hasScored ? 'text-emerald-200' : 'text-slate-400'}`}>
                                    {judge.name}
                                </span>
                                {hasScored ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                ) : (
                                    <Clock className="w-5 h-5 text-slate-500 animate-pulse" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 bg-black/20 text-center text-xs text-slate-500 border-t border-white/5">
                Auto-refreshing every 3s
            </div>
        </div>
    );
}
