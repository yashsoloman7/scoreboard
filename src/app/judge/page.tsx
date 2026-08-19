'use client';

// src/app/judge/page.tsx - Judge Dashboard with Authorized Category & Performance List

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { supabase } from '@/lib/supabase/client';
import { Category, Performance } from '@/types';
import { PlayCircle, ShieldCheck, CheckCircle2, Clock, Music } from 'lucide-react';
import Link from 'next/link';

export default function JudgeDashboardPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePerformances, setActivePerformances] = useState<Record<string, Performance[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJudgeAssignments() {
      if (!user) return;
      try {
        // Query assigned categories for this judge
        const { data: assignments } = await supabase
          .from('judge_assignments')
          .select('category_id, categories(*, rounds(*, performances(*, participant:participants(*), team:teams(*))))')
          .eq('judge_id', user.id)
          .eq('is_active', true);

        if (assignments) {
          const cats: Category[] = [];
          const perfsMap: Record<string, Performance[]> = {};

          assignments.forEach((a: any) => {
            if (a.categories) {
              cats.push({
                id: a.categories.id,
                competitionId: a.categories.competition_id,
                name: a.categories.name,
                performerType: a.categories.performer_type,
                displayOrder: a.categories.display_order,
                scoringFormula: a.categories.scoring_formula,
                status: a.categories.status,
                createdAt: a.categories.created_at,
                updatedAt: a.categories.updated_at,
              });

              // Extract performances from first round
              const firstRound = a.categories.rounds?.[0];
              if (firstRound?.performances) {
                perfsMap[a.categories.id] = firstRound.performances.map((p: any) => ({
                  id: p.id,
                  roundId: p.round_id,
                  participantId: p.participant_id,
                  teamId: p.team_id,
                  performanceOrder: p.performance_order,
                  performanceCode: p.performance_code,
                  status: p.status,
                  participant: p.participant ? {
                    id: p.participant.id,
                    competitionId: p.participant.competition_id,
                    participantCode: p.participant.participant_code,
                    firstName: p.participant.first_name,
                    lastName: p.participant.last_name,
                    institution: p.participant.institution,
                    environment: p.participant.environment,
                    createdAt: p.participant.created_at,
                    updatedAt: p.participant.updated_at,
                  } : null,
                  team: p.team ? {
                    id: p.team.id,
                    competitionId: p.team.competition_id,
                    teamCode: p.team.team_code,
                    name: p.team.name,
                    environment: p.team.environment,
                    createdAt: p.team.created_at,
                  } : null,
                  createdAt: p.created_at,
                  updatedAt: p.updated_at,
                }));
              }
            }
          });

          setCategories(cats);
          setActivePerformances(perfsMap);
        }
      } catch (err) {
        console.error('Failed to load assignments:', err);
      } finally {
        setLoading(false);
      }
    }

    loadJudgeAssignments();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Music className="w-6 h-6 text-indigo-400" />
              <span>Judge Console</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">Authorized Categories & Live Performance Lineup</p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Encrypted Session Authorized</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 animate-pulse">Loading assigned scoring categories...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center max-w-lg mx-auto">
            <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-200">No Category Assignments Found</h3>
            <p className="text-xs text-slate-400 mt-1">
              Your account is authorized as a Judge, but you have not been assigned to an active competition category yet.
              Please check in with the Scrutineer Desk.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => {
              const perfs = activePerformances[cat.id] || [];
              return (
                <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        {cat.performerType}
                      </span>
                      <h2 className="text-lg font-bold text-white mt-1.5">{cat.name}</h2>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{perfs.length} Scheduled</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {perfs.map((p) => {
                      const name = p.participant
                        ? `${p.participant.firstName} ${p.participant.lastName}`
                        : p.team?.name || 'Performer';
                      const code = p.participant?.participantCode || p.team?.teamCode || p.performanceCode;
                      const isPerforming = p.status === 'performing';

                      return (
                        <Link
                          key={p.id}
                          href={`/judge/${cat.id}/${p.id}`}
                          className={`p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                            isPerforming
                              ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10'
                              : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono font-bold text-amber-400">
                                Order #{p.performanceOrder}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {code}
                              </span>
                            </div>
                            <h3 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
                              {name}
                            </h3>
                            {p.participant?.institution && (
                              <p className="text-xs text-slate-400 truncate mt-0.5">{p.participant.institution}</p>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                              isPerforming
                                ? 'bg-indigo-500 text-white animate-pulse'
                                : p.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {p.status}
                            </span>
                            <span className="text-xs text-indigo-400 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                              <span>Score</span>
                              <PlayCircle className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
