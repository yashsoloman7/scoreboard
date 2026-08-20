'use client';

// src/app/live/page.tsx - Public Live Scoreboard & Audited Master Judgement Sheet Portal

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { Category, Result, ResultEntry } from '@/types';
import {
  Trophy,
  Medal,
  Radio,
  Music,
  Sparkles,
  CheckCircle2,
  Table,
  Printer,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Award,
  Layers,
  Info,
  UserCheck,
} from 'lucide-react';

export default function LiveScoreboardPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [results, setResults] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'podium' | 'master_sheet'>('podium');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

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
        .maybeSingle();

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
            performance: e.performance ? {
              id: e.performance.id,
              roundId: e.performance.round_id,
              participantId: e.performance.participant_id,
              teamId: e.performance.team_id,
              performanceOrder: e.performance.performance_order,
              performanceCode: e.performance.performance_code,
              status: e.performance.status,
              participant: e.performance.participant ? {
                id: e.performance.participant.id,
                competitionId: e.performance.participant.competition_id,
                participantCode: e.performance.participant.participant_code,
                firstName: e.performance.participant.first_name,
                lastName: e.performance.participant.last_name,
                institution: e.performance.participant.institution,
                environment: e.performance.participant.environment,
              } : null,
              team: e.performance.team ? {
                id: e.performance.team.id,
                competitionId: e.performance.team.competition_id,
                teamCode: e.performance.team.team_code,
                name: e.performance.team.name,
                institution: e.performance.team.institution,
                environment: e.performance.team.environment,
              } : null,
            } : null,
            createdAt: e.created_at,
          })).sort((a: ResultEntry, b: ResultEntry) => a.rank - b.rank),
        });
      } else {
        setResults(null);
      }
    }

    loadResults();

    // Supabase Realtime for instant publishing updates
    const channel = supabase
      .channel(`live_results_${selectedCategory.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'results', filter: `category_id=eq.${selectedCategory.id}` },
        () => loadResults()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategory]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col print:bg-white print:text-black">
      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                Live Official Scoreboard
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Competition Standings & Master Judgment Sheet
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Real-time authoritative scores, podium standings, and certified scrutineer master breakdown sheets.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 print:hidden">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('podium')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'podium'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Podium Standings</span>
              </button>
              <button
                onClick={() => setViewMode('master_sheet')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'master_sheet'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Master Judgment Sheet</span>
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
              title="Print Certified Sheet"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none print:hidden">
          {categories.map((c) => {
            const isSelected = selectedCategory?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode 1: Podium & Visual Top 3 */}
        {viewMode === 'podium' && results && results.entries.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-10">
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

        {/* Detailed Results Table & Master Judgment Sheet */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden print:border-none print:shadow-none">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-slate-200">
                {viewMode === 'master_sheet' ? 'Audited Master Judgement Breakdown Matrix' : 'Official Ranked Standings'}
              </h2>
              <span className="text-xs text-slate-500 font-mono">({selectedCategory?.name})</span>
            </div>
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
                    <th className="px-6 py-3.5">Participant / Team</th>
                    <th className="px-6 py-3.5">Code</th>
                    {viewMode === 'master_sheet' && (
                      <>
                        <th className="px-4 py-3.5 text-center">Judges Panel</th>
                        <th className="px-4 py-3.5 text-right">Raw Avg</th>
                        <th className="px-4 py-3.5 text-right">Variance (σ)</th>
                      </>
                    )}
                    <th className="px-6 py-3.5 text-right">Official Score</th>
                    <th className="px-6 py-3.5 text-center">Scrutiny / Tie Notes</th>
                    <th className="px-4 py-3.5 text-center print:hidden">Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {results.entries.map((entry) => {
                    const name = entry.performance?.participant
                      ? `${entry.performance.participant.firstName} ${entry.performance.participant.lastName}`
                      : entry.performance?.team?.name || 'Performer';
                    const code = entry.performance?.participant?.participantCode || entry.performance?.performanceCode;
                    const isExpanded = expandedEntryId === entry.id;
                    const judgeScores: any[] = entry.breakdownJson?.judgeScores || [];

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 font-bold font-mono">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs ${
                                entry.rank === 1
                                  ? 'bg-amber-500/20 text-amber-300 font-black'
                                  : entry.rank === 2
                                  ? 'bg-slate-700 text-slate-200'
                                  : entry.rank === 3
                                  ? 'bg-amber-900/30 text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
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

                          {viewMode === 'master_sheet' && (
                            <>
                              <td className="px-4 py-4 text-center">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {judgeScores.map((j: any, i: number) => (
                                    <span
                                      key={i}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300"
                                      title={`Judge ${j.judgeSeat}: ${j.weightedTotal.toFixed(2)}`}
                                    >
                                      J{j.judgeSeat}: {j.weightedTotal.toFixed(1)}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right font-mono text-xs text-slate-300">
                                {entry.rawAverage.toFixed(2)}
                              </td>
                              <td className="px-4 py-4 text-right font-mono text-xs text-slate-400">
                                ±{entry.standardDeviation.toFixed(2)}
                              </td>
                            </>
                          )}

                          <td className="px-6 py-4 text-right font-mono font-bold text-base text-indigo-400">
                            {entry.finalScore.toFixed(3)}
                          </td>

                          <td className="px-6 py-4 text-center text-xs">
                            {entry.isTie ? (
                              <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono text-[10px]">
                                {entry.tieResolutionNote || 'Tie Resolved'}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-center print:hidden">
                            <button
                              type="button"
                              className="p-1 rounded text-slate-400 hover:text-white"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Full Judge Scrutiny Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-950/80 border-t border-b border-indigo-500/20">
                            <td colSpan={viewMode === 'master_sheet' ? 8 : 6} className="px-6 py-5">
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-inner">
                                <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                                  <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                                    <UserCheck className="w-4 h-4 text-indigo-400" />
                                    <span>Individual Judge Scrutiny Breakdown: {name}</span>
                                  </h4>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    Total Panel: {judgeScores.length} Judges
                                  </span>
                                </div>

                                {judgeScores.length === 0 ? (
                                  <p className="text-xs text-slate-500">No individual judge breakdown details available.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {judgeScores.map((j: any, i: number) => (
                                      <div
                                        key={i}
                                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-slate-200">
                                            Judge Seat #{j.judgeSeat}
                                          </span>
                                          <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                            Score: {j.weightedTotal.toFixed(2)}
                                          </span>
                                        </div>

                                        {j.entries && Object.keys(j.entries).length > 0 && (
                                          <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/60">
                                            {Object.entries(j.entries).map(([critId, score]: [string, any]) => (
                                              <div key={critId} className="flex items-center justify-between font-mono">
                                                <span className="truncate max-w-[120px] text-slate-400">Criteria Mark:</span>
                                                <span className="text-slate-200 font-semibold">{Number(score).toFixed(1)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
