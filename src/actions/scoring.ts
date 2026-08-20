'use server';

// src/actions/scoring.ts - Server-authoritative Score Submission, Masking & Reopening

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/guards';
import { ScoreSubmissionSchema, ScoreReopenSchema } from '@/lib/validation/schemas';
import { ScoreSubmission } from '@/types';
import { revalidatePath } from 'next/cache';

export async function submitScore(submissionData: unknown) {
  try {
    const user = await requireAuth();
    const validated = ScoreSubmissionSchema.parse(submissionData);
    const supabase = await createServerSupabaseClient();

    let submissionId: string | null = null;
    let rpcFailed = false;

    // 1. Attempt stored procedure RPC first
    try {
      const { data, error } = await supabase.rpc('submit_judge_score', {
        p_performance_id: validated.performanceId,
        p_criteria_version_id: validated.criteriaVersionId,
        p_idempotency_key: validated.idempotencyKey,
        p_entries: validated.entries,
        p_device_fingerprint: validated.deviceFingerprint || null,
      });

      if (!error && data?.submission_id) {
        submissionId = data.submission_id;
      } else {
        rpcFailed = true;
      }
    } catch {
      rpcFailed = true;
    }

    // 2. Direct database query fallback
    if (rpcFailed || !submissionId) {
      // Fetch criteria to compute weighted scores
      const { data: criteriaList, error: criteriaErr } = await supabase
        .from('category_criteria')
        .select('*')
        .eq('criteria_version_id', validated.criteriaVersionId);

      if (criteriaErr || !criteriaList || criteriaList.length === 0) {
        return {
          success: false,
          error: `Criteria not found for version ${validated.criteriaVersionId}`,
        };
      }

      const criteriaMap = new Map(criteriaList.map((c: any) => [c.id, c]));

      let totalRaw = 0;
      let totalWeighted = 0;

      const preparedEntries = validated.entries.map((entry) => {
        const crit = criteriaMap.get(entry.criterionId);
        const maxMarks = crit ? Number(crit.max_marks) : 10;
        const weight = crit ? Number(crit.weight) : 1.0;
        const rawScore = Number(entry.rawScore);
        const weightedScore = maxMarks > 0 ? (rawScore / maxMarks) * weight : 0;

        totalRaw += rawScore;
        totalWeighted += weightedScore;

        return {
          criterionId: entry.criterionId,
          rawScore,
          weightedScore,
          notes: entry.notes || null,
        };
      });

      // Upsert submission record
      const { data: subData, error: subErr } = await supabase
        .from('score_submissions')
        .upsert(
          {
            performance_id: validated.performanceId,
            judge_id: user.id,
            criteria_version_id: validated.criteriaVersionId,
            status: 'locked',
            idempotency_key: validated.idempotencyKey,
            total_raw_score: totalRaw,
            total_weighted_score: totalWeighted,
            device_fingerprint: validated.deviceFingerprint || null,
            submitted_at: new Date().toISOString(),
            locked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'performance_id,judge_id,criteria_version_id' }
        )
        .select()
        .single();

      if (subErr || !subData) {
        return {
          success: false,
          error: `Failed to save score submission: ${subErr?.message || 'Database error'}`,
        };
      }

      submissionId = subData.id;

      // Upsert score entries
      const entryRows = preparedEntries.map((e) => ({
        submission_id: submissionId,
        criterion_id: e.criterionId,
        raw_score: e.rawScore,
        weighted_score: e.weightedScore,
        notes: e.notes,
        updated_at: new Date().toISOString(),
      }));

      const { error: entriesErr } = await supabase
        .from('score_entries')
        .upsert(entryRows, { onConflict: 'submission_id,criterion_id' });

      if (entriesErr) {
        return {
          success: false,
          error: `Failed to record score entries: ${entriesErr.message}`,
        };
      }

      // Log audit entry
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'SCORE_SUBMITTED_AND_LOCKED',
        entity: 'score_submissions',
        entity_id: submissionId,
        new_state: { raw_total: totalRaw, weighted_total: totalWeighted, performance_id: validated.performanceId },
      });
    }

    // Lock the criteria version
    await supabase
      .from('criteria_versions')
      .update({ is_locked: true, locked_at: new Date().toISOString() })
      .eq('id', validated.criteriaVersionId);

    revalidatePath(`/judge`);
    revalidatePath(`/admin/control-room`);

    return {
      success: true,
      submissionId,
      status: 'locked',
      message: 'Score successfully recorded and locked.',
    };
  } catch (err: unknown) {
    console.error('Submit score action error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An error occurred during submission',
    };
  }
}

export async function reopenScore(reopenData: unknown) {
  try {
    const user = await requireRole('admin');
    const validated = ScoreReopenSchema.parse(reopenData);
    const supabase = await createServerSupabaseClient();

    let rpcSucceeded = false;
    let resultStatus = 'reopened';

    try {
      const { data, error } = await supabase.rpc('reopen_judge_score', {
        p_submission_id: validated.submissionId,
        p_reason: validated.reason,
      });

      if (!error && data) {
        rpcSucceeded = true;
        resultStatus = data.status || 'reopened';
      }
    } catch {
      // fallback
    }

    if (!rpcSucceeded) {
      const { data: sub, error: subErr } = await supabase
        .from('score_submissions')
        .select('*, entries:score_entries(*)')
        .eq('id', validated.submissionId)
        .single();

      if (subErr || !sub) {
        return { success: false, error: `Score submission not found: ${subErr?.message}` };
      }

      // Record in score_history
      await supabase.from('score_history').insert({
        submission_id: sub.id,
        reopened_by: user.id,
        reopen_reason: validated.reason,
        previous_raw_total: sub.total_raw_score,
        previous_weighted_total: sub.total_weighted_score,
        previous_scores_snapshot: sub.entries || [],
      });

      // Update status to reopened
      const { error: updateErr } = await supabase
        .from('score_submissions')
        .update({
          status: 'reopened',
          locked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', validated.submissionId);

      if (updateErr) {
        return { success: false, error: `Failed to reopen score: ${updateErr.message}` };
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'SCORE_REOPENED',
        entity: 'score_submissions',
        entity_id: sub.id,
        reason: validated.reason,
      });
    }

    revalidatePath('/admin/control-room');
    revalidatePath('/judge');

    return {
      success: true,
      submissionId: validated.submissionId,
      status: resultStatus,
    };
  } catch (err: unknown) {
    console.error('Reopen score error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reopen score',
    };
  }
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
