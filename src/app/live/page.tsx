'use client';

// src/app/live/page.tsx - Public Live Scoreboard & Published Results Portal

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { Category, Result, ResultEntry } from '@/types';
import { Trophy, Medal, Radio, Music, Sparkles, CheckCircle2 } from 'lucide-react';

export default function LiveScoreboardPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [results, setResults] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch active categories
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('categories').select('*').order('display_order');
      if (data && data.length > 0) {
        setCategories(data as any);
        setSelectedCategory(data[0] as any);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Fetch published results for selected category
  useEffect(() => {
    if (!selectedCategory) return;

    async function loadResults() {
      const { data: res } = await supabase
        .from('results')
        .select('*, entries:result_entries(*, performance:performances(*, participant:participants(*), team:teams(*)))')
        .eq('category_id', selectedCategory!.id)
        .eq('status', 'published')
        .single();

      if (res) {
        setResults({
          id: res.id,
          categoryId: res.category_id,
          roundId: res.round_id,
          status: res.status,
          approvedBy: res.approved_by,
          approvedAt: res.approved_at,
          publishedAt: res.published_at,
          createdAt: res.created_at,
          updatedAt: res.updated_at,
          entries: (res.entries || []).map((e: any) => ({
            id: e.id,
            resultId: e.result_id,
            performanceId: e.performance_id,
            rank: e.rank,
            finalScore: Number(e.final_score),
            judgeCount: e.judge_count,
            rawAverage: Number(e.raw_average),
            standardDeviation: Number(e.standard_deviation),
            breakdownJson: e.breakdown_json,
            isTie: e.is_tie,
            tieResolutionNote: e.tie_resolution_note,
            performance: e.performance,
            createdAt: e.created_at,
          })).sort((a: ResultEntry, b: ResultEntry) => a.rank - b.rank),
        });
      } else {
        setResults(null);
      }
    }

    loadResults();
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>OFFICIAL LIVE BOARD</span>
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">State Music Competition Results</h1>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory?.id === c.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Podium Top 3 View */}
        {results && results.entries.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Rank 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center order-2 md:order-1 shadow-lg">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-lg mb-3">
                🥈 2nd
              </div>
              <h3 className="font-bold text-base text-white">
                {results.entries[1]?.performance?.participant
                  ? `${results.entries[1].performance.participant.firstName} ${results.entries[1].performance.participant.lastName}`
                  : results.entries[1]?.performance?.team?.name || 'Runner Up'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {results.entries[1]?.performance?.participant?.institution || ''}
              </p>
              <div className="mt-4 text-2xl font-black font-mono text-slate-200">
                {results.entries[1]?.finalScore.toFixed(3)}
              </div>
            </div>

            {/* Rank 1 (Winner) */}
            <div className="bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-6 flex flex-col items-center text-center order-1 md:order-2 shadow-2xl scale-105 relative">
              <div className="absolute -top-3 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-3 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>STATE CHAMPION</span>
              </div>
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 font-bold text-2xl mb-3 mt-2">
                🥇 1st
              </div>
              <h3 className="font-extrabold text-lg text-white">
                {results.entries[0]?.performance?.participant
                  ? `${results.entries[0].performance.participant.firstName} ${results.entries[0].performance.participant.lastName}`
                  : results.entries[0]?.performance?.team?.name || 'Winner'}
              </h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {results.entries[0]?.performance?.participant?.institution || ''}
              </p>
              <div className="mt-4 text-3xl font-black font-mono text-amber-400">
                {results.entries[0]?.finalScore.toFixed(3)}
              </div>
            </div>

            {/* Rank 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center order-3 shadow-lg">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-600 font-bold text-lg mb-3">
                🥉 3rd
              </div>
              <h3 className="font-bold text-base text-white">
                {results.entries[2]?.performance?.participant
                  ? `${results.entries[2].performance.participant.firstName} ${results.entries[2].performance.participant.lastName}`
                  : results.entries[2]?.performance?.team?.name || 'Second Runner Up'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {results.entries[2]?.performance?.participant?.institution || ''}
              </p>
              <div className="mt-4 text-2xl font-black font-mono text-slate-200">
                {results.entries[2]?.finalScore.toFixed(3)}
              </div>
            </div>
          </div>
        )}

        {/* Detailed Results Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-200">Official Ranked Standings</h2>
            {results?.publishedAt && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Certified & Published</span>
              </span>
            )}
          </div>

          {!results || results.entries.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Music className="w-10 h-10 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">Scoring in Progress</p>
              <p className="text-xs text-slate-500 mt-1">Official certified results will appear here once published by Scrutineers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-[11px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Rank</th>
                    <th className="px-6 py-3.5">Participant</th>
                    <th className="px-6 py-3.5">Code</th>
                    <th className="px-6 py-3.5 text-right">Official Score</th>
                    <th className="px-6 py-3.5 text-center">Status / Tie Scrutiny</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {results.entries.map((entry) => {
                    const name = entry.performance?.participant
                      ? `${entry.performance.participant.firstName} ${entry.performance.participant.lastName}`
                      : entry.performance?.team?.name || 'Performer';
                    const code = entry.performance?.participant?.participantCode || entry.performance?.performanceCode;

                    return (
                      <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-bold font-mono">
                          <span className={`px-2.5 py-1 rounded-lg text-xs ${
                            entry.rank === 1
                              ? 'bg-amber-500/20 text-amber-300 font-black'
                              : entry.rank === 2
                              ? 'bg-slate-700 text-slate-200'
                              : entry.rank === 3
                              ? 'bg-amber-900/30 text-amber-400'
                              : 'text-slate-400'
                          }`}>
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white">
                          <div className="font-semibold">{name}</div>
                          {entry.performance?.participant?.institution && (
                            <div className="text-xs text-slate-400">{entry.performance.participant.institution}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">{code}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-base text-indigo-400">
                          {entry.finalScore.toFixed(3)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {entry.tieResolutionNote ? (
                            <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                              {entry.tieResolutionNote}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
