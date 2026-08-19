'use server';

// src/actions/scoring.ts - Server-authoritative Score Submission, Masking & Reopening

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/guards';
import { ScoreSubmissionSchema, ScoreReopenSchema } from '@/lib/validation/schemas';
import { ScoreSubmission } from '@/types';
import { revalidatePath } from 'next/cache';

export async function submitScore(submissionData: unknown) {
  const user = await requireAuth();
  const validated = ScoreSubmissionSchema.parse(submissionData);
  const supabase = await createServerSupabaseClient();

  // Call the atomic stored procedure: submit_judge_score
  const { data, error } = await supabase.rpc('submit_judge_score', {
    p_performance_id: validated.performanceId,
    p_criteria_version_id: validated.criteriaVersionId,
    p_idempotency_key: validated.idempotencyKey,
    p_entries: validated.entries,
    p_device_fingerprint: validated.deviceFingerprint || null,
  });

  if (error) {
    throw new Error(`Scoring submission failed: ${error.message}`);
  }

  // Lock the criteria version if not already locked
  await supabase
    .from('criteria_versions')
    .update({ is_locked: true, locked_at: new Date().toISOString() })
    .eq('id', validated.criteriaVersionId);

  revalidatePath(`/judge`);
  revalidatePath(`/admin/control-room`);

  return {
    success: true,
    submissionId: data.submission_id,
    status: data.status,
    message: 'Score successfully recorded and locked.',
  };
}

export async function reopenScore(reopenData: unknown) {
  await requireRole('admin');
  const validated = ScoreReopenSchema.parse(reopenData);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc('reopen_judge_score', {
    p_submission_id: validated.submissionId,
    p_reason: validated.reason,
  });

  if (error) {
    throw new Error(`Failed to reopen score: ${error.message}`);
  }

  revalidatePath('/admin/control-room');
  revalidatePath('/judge');

  return {
    success: true,
    submissionId: data.submission_id,
    status: data.status,
  };
}

export async function getJudgeSubmissionForPerformance(
  performanceId: string,
  judgeId?: string
): Promise<ScoreSubmission | null> {
  const user = await requireAuth();
  const targetJudgeId = judgeId || user.id;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('score_submissions')
    .select('*, entries:score_entries(*)')
    .eq('performance_id', performanceId)
    .eq('judge_id', targetJudgeId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    performanceId: data.performance_id,
    judgeId: data.judge_id,
    criteriaVersionId: data.criteria_version_id,
    status: data.status,
    idempotencyKey: data.idempotency_key,
    totalRawScore: Number(data.total_raw_score),
    totalWeightedScore: Number(data.total_weighted_score),
    submittedAt: data.submitted_at,
    lockedAt: data.locked_at,
    deviceFingerprint: data.device_fingerprint,
    entries: (data.entries || []).map((e: any) => ({
      id: e.id,
      submissionId: e.submission_id,
      criterionId: e.criterion_id,
      rawScore: Number(e.raw_score),
      weightedScore: Number(e.weighted_score),
      notes: e.notes,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
