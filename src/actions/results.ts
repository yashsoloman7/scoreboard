'use server';

// src/actions/results.ts - Server Actions for Result Calculations, Approvals & Publications

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { calculatePerformanceScore } from '@/lib/results/scoringEngine';
import { rankPerformancesWithTieBreakers } from '@/lib/results/tieBreakerEngine';
import { Result, ResultEntry, ScoringFormula, TieBreakRule } from '@/types';
import { revalidatePath } from 'next/cache';

export async function calculateAndStoreCategoryResults(
  categoryId: string,
  roundId: string
): Promise<Result> {
  const user = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  // 1. Fetch category formula and tie break rules
  const { data: category } = await supabase
    .from('categories')
    .select('scoring_formula')
    .eq('id', categoryId)
    .single();

  const formula: ScoringFormula = (category?.scoring_formula as ScoringFormula) || 'weighted_sum';

  const { data: tieRulesData } = await supabase
    .from('tie_break_rules')
    .select('*')
    .eq('category_id', categoryId)
    .order('priority_order', { ascending: true });

  const tieRules: TieBreakRule[] = (tieRulesData || []).map((r) => ({
    id: r.id,
    categoryId: r.category_id,
    priorityOrder: r.priority_order,
    ruleType: r.rule_type,
    targetCriterionId: r.target_criterion_id,
    createdAt: r.created_at,
  }));

  // 2. Fetch all performances in this round with locked submissions
  const { data: performances } = await supabase
    .from('performances')
    .select('id, performance_order, score_submissions(*, score_entries(*))')
    .eq('round_id', roundId);

  if (!performances || performances.length === 0) {
    throw new Error('No performances found for this category round.');
  }

  // 3. Compute score for each performance
  const calculatedList = performances.map((perf) => {
    const validSubs = (perf.score_submissions || []).filter((s: any) => s.status === 'locked' || s.status === 'submitted');
    const formattedSubs = validSubs.map((s: any) => ({
      id: s.id,
      performanceId: s.performance_id,
      judgeId: s.judge_id,
      criteriaVersionId: s.criteria_version_id,
      status: s.status,
      idempotencyKey: s.idempotency_key,
      totalRawScore: Number(s.total_raw_score),
      totalWeightedScore: Number(s.total_weighted_score),
      entries: (s.score_entries || []).map((e: any) => ({
        id: e.id,
        submissionId: e.submission_id,
        criterionId: e.criterion_id,
        rawScore: Number(e.raw_score),
        weightedScore: Number(e.weighted_score),
        notes: e.notes,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      })),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return calculatePerformanceScore(perf.id, formattedSubs, formula);
  });

  // 4. Rank with Tie-Breakers
  const ranked = rankPerformancesWithTieBreakers(calculatedList, tieRules);

  // 5. Upsert Results row
  const { data: resultHeader, error: rError } = await supabase
    .from('results')
    .upsert({
      category_id: categoryId,
      round_id: roundId,
      status: 'draft',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'category_id,round_id' })
    .select()
    .single();

  if (rError) throw new Error(`Failed to save results header: ${rError.message}`);

  // 6. Delete old entries and insert new ranked entries
  await supabase.from('result_entries').delete().eq('result_id', resultHeader.id);

  const entriesToInsert = ranked.map((entry) => ({
    result_id: resultHeader.id,
    performance_id: entry.performanceId,
    rank: entry.rank,
    final_score: entry.finalScore,
    judge_count: entry.calculated.judgeCount,
    raw_average: entry.calculated.rawAverage,
    standard_deviation: entry.calculated.standardDeviation,
    breakdown_json: {
      criteriaScores: entry.calculated.criteriaAverages,
      judgeScores: entry.calculated.judgeBreakdown,
      tieBreakNotes: entry.tieResolutionNote,
    },
    is_tie: entry.isTie,
    tie_resolution_note: entry.tieResolutionNote || null,
  }));

  const { data: insertedEntries, error: insErr } = await supabase
    .from('result_entries')
    .insert(entriesToInsert)
    .select('*, performance:performances(*, participant:participants(*), team:teams(*))');

  if (insErr) throw new Error(`Failed to save result entries: ${insErr.message}`);

  // 7. Audit log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'CALCULATE_RESULTS',
    entity: 'results',
    entity_id: resultHeader.id,
    new_state: { categoryId, roundId, formula, totalRanked: ranked.length },
  });

  revalidatePath('/admin/results');

  return {
    id: resultHeader.id,
    categoryId: resultHeader.category_id,
    roundId: resultHeader.round_id,
    status: resultHeader.status,
    approvedBy: resultHeader.approved_by,
    approvedAt: resultHeader.approved_at,
    publishedAt: resultHeader.published_at,
    createdAt: resultHeader.created_at,
    updatedAt: resultHeader.updated_at,
    entries: (insertedEntries || []).map((e: any) => ({
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
      createdAt: e.created_at,
    })),
  };
}

export async function approveResults(resultId: string) {
  const user = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('results')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', resultId);

  if (error) throw new Error(`Failed to approve results: ${error.message}`);

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'APPROVE_RESULTS',
    entity: 'results',
    entity_id: resultId,
  });

  revalidatePath('/admin/results');
}

export async function publishResults(resultId: string) {
  const user = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('results')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', resultId);

  if (error) throw new Error(`Failed to publish results: ${error.message}`);

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'PUBLISH_RESULTS',
    entity: 'results',
    entity_id: resultId,
  });

  revalidatePath('/admin/results');
  revalidatePath('/live');
  revalidatePath('/');
}
