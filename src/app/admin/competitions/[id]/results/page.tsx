"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Crown, ArrowLeft, Trophy, Medal, Star, Calculator, Download, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ResultsAnalysisPage() {
    const params = useParams();
    const router = useRouter();
    const competitionId = params.id as string;

    const [competition, setCompetition] = useState<any>(null);
    const [performers, setPerformers] = useState<any[]>([]);
    const [scores, setScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [compRes, perfRes, scoreRes] = await Promise.all([
                    fetch(`/api/competitions/${competitionId}`),
                    fetch(`/api/performer?competitionId=${competitionId}`),
                    fetch(`/api/score?competitionId=${competitionId}`)
                ]);

                if (compRes.ok && perfRes.ok && scoreRes.ok) {
                    setCompetition(await compRes.json());
                    setPerformers(await perfRes.json());
                    setScores(await scoreRes.json());
                }
            } catch (error) {
                console.error("Failed to load results data", error);
            } finally {
                setLoading(false);
            }
        };

        if (competitionId) fetchData();
    }, [competitionId]);

    const toggleWinnersReveal = async () => {
        if (!competition) return;
        const newStatus = !competition.winnersRevealed;

        try {
            const res = await fetch(`/api/competitions/${competitionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ winnersRevealed: newStatus })
            });

            if (res.ok) {
                setCompetition({ ...competition, winnersRevealed: newStatus });
            }
        } catch (error) {
            console.error("Failed to update winner reveal status", error);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
    );

    if (!competition) return <div className="text-white text-center p-10">Competition not found</div>;

    // --- Calculation Logic ---
    const results = performers.map(p => {
        const pScores = scores.filter(s => s.performerId === p._id);

        let validScores = pScores;
        let droppedScores: any[] = [];

        // Olympic Scoring Logic: Drop Highest and Lowest Total Score
        // Only apply if we have enough judges (at least 3) to strictly drop 2 and still have a score.
        if (competition.scoringSystem === 'olympic' && pScores.length >= 3) {
            // Sort by Total Score
            const sortedByTotal = [...pScores].sort((a, b) => a.totalScore - b.totalScore);

            // Remove Lowest (Index 0) and Highest (Index length-1)
            const lowest = sortedByTotal[0];
            const highest = sortedByTotal[sortedByTotal.length - 1];

            droppedScores = [lowest, highest];
            validScores = sortedByTotal.slice(1, sortedByTotal.length - 1);
        }

        const total = validScores.reduce((acc: number, curr: any) => acc + curr.totalScore, 0);
        const count = validScores.length;
        const average = count > 0 ? total / count : 0;

        // Standard Deviation & Outlier Detection
        // We calculate this based on VALID scores (if olympic is on, we analyze the remaining ones for consistency)
        // OR we should analyze ALL scores to find the "rouge" judge? 
        // Let's analyze ALL scores to find outliers, even if they were dropped.
        const allScores = pScores.map(s => s.totalScore);
        const allTotal = allScores.reduce((a, b) => a + b, 0);
        const allAvg = allScores.length > 0 ? allTotal / allScores.length : 0;

        const squareDiffs = allScores.map(score => {
            const diff = score - allAvg;
            return diff * diff;
        });
        const avgSquareDiff = allScores.length > 0 ? squareDiffs.reduce((a, b) => a + b, 0) / allScores.length : 0;
        const stdDev = Math.sqrt(avgSquareDiff);

        // Identify Outliers (Z-Score > 1.5)
        const outlierScores = pScores.filter(s => {
            if (stdDev === 0) return false;
            const zScore = Math.abs((s.totalScore - allAvg) / stdDev);
            return zScore > 1.5;
        }).map(s => s.judgeId);

        // Detailed criteria breakdown (using only valid scores)
        const criteriaTotals: Record<string, number> = {};
        validScores.forEach((s: any) => {
            for (const [key, val] of Object.entries(s.scores)) {
                criteriaTotals[key] = (criteriaTotals[key] || 0) + (val as number);
            }
        });

        return {
            ...p,
            totalScore: total,
            averageScore: average,
            judgeCount: count,
            rawJudgeCount: pScores.length, // Total judges who scored
            droppedScores, // For UI indication
            stdDev,
            outlierScores, // Array of Judge IDs
            criteriaTotals
        };
    }).sort((a, b) => b.averageScore - a.averageScore);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Crown className="w-6 h-6 text-yellow-400" fill="currentColor" />;
        if (index === 1) return <Medal className="w-6 h-6 text-slate-300" />;
        if (index === 2) return <Medal className="w-6 h-6 text-orange-400" />;
        return <span className="text-slate-500 font-bold w-6 text-center">{index + 1}</span>;
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white">
            <nav className="border-b border-white/10 bg-[#0f172a]/50 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5 mr-1" /> Back
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-2">
                                Results Analysis
                                {competition.scoringSystem === 'olympic' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest font-bold">
                                        Olympic Scoring
                                    </span>
                                )}
                            </h1>
                            <p className="text-xs text-slate-400">{competition.name}</p>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="glass-card p-6 rounded-xl bg-[#0f172a]/60 border border-white/5">
                        <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Total Performers</div>
                        <div className="text-3xl font-black">{performers.length}</div>
                    </div>
                    <div className="glass-card p-6 rounded-xl bg-[#0f172a]/60 border border-white/5">
                        <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Total Scores</div>
                        <div className="text-3xl font-black text-cyan-400">{scores.length}</div>
                    </div>
                    <div className="glass-card p-6 rounded-xl bg-[#0f172a]/60 border border-white/5">
                        <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Batches / Judges</div>
                        <div className="text-3xl font-black text-purple-400">{competition.judges.length}</div>
                    </div>

                    {/* Reveal Toggle Card */}
                    <div className={`glass-card p-6 rounded-xl border border-white/5 flex flex-col justify-center items-center transition-colors ${competition.winnersRevealed ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-[#0f172a]/60'}`}>
                        <div className="text-slate-400 text-xs mb-2 uppercase tracking-wider">Podium Visibility</div>
                        <Button
                            onClick={toggleWinnersReveal}
                            className={`w-full ${competition.winnersRevealed ? 'bg-yellow-600 hover:bg-yellow-500 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            {competition.winnersRevealed ? (
                                <><Eye className="w-4 h-4 mr-2" /> Winners Revealed</>
                            ) : (
                                <><EyeOff className="w-4 h-4 mr-2" /> Winners Hidden</>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Leaderboard Table */}
                <div className="glass-card rounded-xl overflow-hidden border border-white/5 bg-[#0f172a]/40">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-yellow-500" /> Official Standings
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                                <tr>
                                    <th className="p-4 w-16 text-center">Rank</th>
                                    <th className="p-4">Performer</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4 text-center">Judges</th>
                                    <th className="p-4 text-right">Avg Score</th>
                                    <th className="p-4 text-right">Total Pts</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {results.map((r, idx) => (
                                    <motion.tr
                                        key={r._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td className="p-4 text-center flex justify-center items-center">
                                            {getRankIcon(idx)}
                                        </td>
                                        <td className="p-4 font-medium text-lg">
                                            <div className="flex items-center gap-3">
                                                {r.image && <img src={r.image} className="w-8 h-8 rounded-full object-cover" />}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        {r.name}
                                                        {r.stdDev > 2 && (
                                                            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 uppercase font-bold" title={`High Score Variance (SD: ${r.stdDev.toFixed(2)})`}>
                                                                Controversial
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.groupMembers && r.groupMembers.length > 0 && (
                                                        <div className="text-xs text-slate-500">w/ {r.groupMembers.join(', ')}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">{r.type}</td>
                                        <td className="p-4 text-center text-slate-400">
                                            {r.judgeCount}
                                            {r.droppedScores && r.droppedScores.length > 0 && (
                                                <span className="text-xs text-slate-600 block" title="Highest and Lowest scores dropped">
                                                    (of {r.rawJudgeCount})
                                                </span>
                                            )}
                                            {r.outlierScores && r.outlierScores.length > 0 && (
                                                <span className="text-xs text-orange-400 block mt-1" title={`${r.outlierScores.length} Outlier Scores Detected`}>
                                                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block mr-1"></span>
                                                    {r.outlierScores.length} Outlier{r.outlierScores.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-bold text-cyan-400 text-xl">{r.averageScore.toFixed(2)}</td>
                                        <td className="p-4 text-right text-slate-500 font-mono">{r.totalScore.toFixed(1)}</td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {results.length === 0 && (
                        <div className="p-10 text-center text-slate-500">No scores submitted yet.</div>
                    )}
                </div>

                {/* Prize Recommendations (Simple Logic) */}
                {competition.prizeCategories.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-400" /> Prize Recommendations
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {competition.prizeCategories.map((prize: any, idx: number) => {
                                const winner = results[0];
                                return (
                                    <div key={idx} className="glass-card p-4 rounded-lg border border-white/5 bg-gradient-to-br from-yellow-500/10 to-transparent">
                                        <h3 className="font-bold text-yellow-200">{prize.name}</h3>
                                        <p className="text-xs text-yellow-500/60 mb-3">{prize.description}</p>
                                        {winner ? (
                                            <div className="flex items-center gap-2 bg-black/20 p-2 rounded">
                                                <Crown className="w-4 h-4 text-yellow-400" />
                                                <span className="font-bold">{winner.name}</span>
                                                <span className="text-xs text-slate-400">({winner.averageScore.toFixed(1)})</span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500">No data</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
