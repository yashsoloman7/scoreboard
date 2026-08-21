'use server';

// src/actions/scoring.ts - Server-authoritative Score Submission, Cryptographic Hashing, Strict SUM-TOTAL, & Tie-Breaker Engine

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, requireRole } from '@/lib/auth/guards';
import { ScoreSubmissionSchema, ScoreReopenSchema, ScoreInputSchema, AdminScoreOverrideSchema } from '@/lib/validation/schemas';
import { ScoreSubmission, ParticipantAggregatedScore, TieBreakerAlert } from '@/types';
import { revalidatePath } from 'next/cache';
import { generateScoreHash } from '@/lib/scoring/crypto';

export { generateScoreHash };

/**
 * 1. JUDGE SUBMIT SCORE (Strict SUM-TOTAL & Server-side Cryptographic Hashing)
 */
export async function submitJudgeScore(input: unknown) {
  try {
    const user = await requireAuth();
    const validated = ScoreInputSchema.parse(input);
    const supabase = await createServerSupabaseClient();
    const adminSupabase = createAdminClient();

    // 1. Verify Event is in Live Mode and inputs are unlocked
    const { data: state, error: stateErr } = await supabase
      .from('event_state')
      .select('*')
      .eq('event_id', validated.eventId)
      .maybeSingle();

    if (stateErr || !state) {
      return { success: false, error: 'Event staging state could not be resolved.' };
    }

    if (state.stage_mode !== 'live' || !state.is_judge_input_unlocked) {
      return { 
        success: false, 
        error: 'Scoring locked: Performance timer is not running or judge inputs are closed.' 
      };
    }

    if (state.active_participant_id && state.active_participant_id !== validated.participantId) {
      return { 
        success: false, 
        error: 'Mismatched Performer: Performer on stage has changed.' 
      };
    }

    // 2. Strict SUM-TOTAL Calculation (Strictly NO averages or variances)
    const strictTotalSum = 
      Number(validated.soloScore || 0) +
      Number(validated.duetScore || 0) +
      Number(validated.groupScore || 0) +
      Number(validated.keyboardistScore || 0) +
      Number(validated.rhythmistScore || 0) +
      Number(validated.guitaristScore || 0);

    // 3. Cryptographic SHA-256 Hash Calculation
    const scoreHash = generateScoreHash(
      validated.eventId,
      validated.participantId,
      user.id,
      strictTotalSum
    );

    // 4. Atomic Database Insert/Lock using elevated client to enforce server authority
    const { data: scoreRecord, error: scoreErr } = await adminSupabase
      .from('scores')
      .upsert({
        event_id: validated.eventId,
        participant_id: validated.participantId,
        judge_id: user.id,
        category: validated.category,
        solo_score: validated.soloScore,
        duet_score: validated.duetScore,
        group_score: validated.groupScore,
        keyboardist_score: validated.keyboardistScore,
        rhythmist_score: validated.rhythmistScore,
        guitarist_score: validated.guitaristScore,
        total_score: strictTotalSum,
        score_hash: scoreHash,
        is_locked: true,
        device_fingerprint: validated.deviceFingerprint || null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'event_id,participant_id,judge_id,category' })
      .select()
      .single();

    if (scoreErr) {
      return { success: false, error: `Failed to insert score: ${scoreErr.message}` };
    }

    revalidatePath('/live');
    revalidatePath('/judge');
    revalidatePath('/admin');
    revalidatePath('/admin/control-room');

    return {
      success: true,
      scoreId: scoreRecord.id,
      totalScore: strictTotalSum,
      hashReceipt: scoreHash,
      submittedAt: scoreRecord.submitted_at,
    };
  } catch (err: unknown) {
    console.error('Submit score action error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Scoring submission failure.' };
  }
}

/**
 * 2. ADMIN SCORE OVERRIDE (Exclusive Permission + Full Audit Trail + Hash Recomputation)
 */
export async function adminOverrideScore(input: unknown) {
  try {
    const adminUser = await requireRole('admin');
    const validated = AdminScoreOverrideSchema.parse(input);
    const supabase = await createServerSupabaseClient();

    // 1. Fetch current score record
    const { data: existingScore, error: fetchErr } = await supabase
      .from('scores')
      .select('*')
      .eq('id', validated.scoreId)
      .single();

    if (fetchErr || !existingScore) {
      return { success: false, error: 'Target score record does not exist.' };
    }

    // 2. Strict SUM Recomputation
    const newTotalSum =
      Number(validated.newSoloScore || 0) +
      Number(validated.newDuetScore || 0) +
      Number(validated.newGroupScore || 0) +
      Number(validated.newKeyboardistScore || 0) +
      Number(validated.newRhythmistScore || 0) +
      Number(validated.newGuitaristScore || 0);

    // 3. New Cryptographic Hash Generation
    const newHash = generateScoreHash(
      existingScore.event_id,
      existingScore.participant_id,
      existingScore.judge_id,
      newTotalSum
    );

    // 4. Update Score with Audit Metadata
    const { error: updateErr } = await supabase
      .from('scores')
      .update({
        solo_score: validated.newSoloScore,
        duet_score: validated.newDuetScore,
        group_score: validated.newGroupScore,
        keyboardist_score: validated.newKeyboardistScore,
        rhythmist_score: validated.newRhythmistScore,
        guitarist_score: validated.newGuitaristScore,
        total_score: newTotalSum,
        score_hash: newHash,
        is_admin_override: true,
        override_reason: validated.reason,
        overridden_by: adminUser.id,
        overridden_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', validated.scoreId);

    if (updateErr) {
      return { success: false, error: `Override update failed: ${updateErr.message}` };
    }

    // 5. Append to Audit Logs Table
    await supabase.from('audit_logs').insert({
      event_id: existingScore.event_id,
      actor_id: adminUser.id,
      action: 'ADMIN_SCORE_OVERRIDE',
      entity: 'scores',
      entity_id: existingScore.id,
      old_state: existingScore,
      new_state: {
        total_score: newTotalSum,
        score_hash: newHash,
        reason: validated.reason,
      },
      reason: validated.reason,
    });

    revalidatePath('/live');
    revalidatePath('/admin');
    revalidatePath('/admin/control-room');

    return {
      success: true,
      message: 'Score successfully overridden and audit logged.',
      newTotalScore: newTotalSum,
      newHashReceipt: newHash,
    };
  } catch (err: unknown) {
    console.error('Admin override error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Admin override failure.' };
  }
}

/**
 * 3. STRICT SUM-TOTAL AGGREGATION & REAL-TIME TIE-BREAKER ENGINE
 */
export async function getAggregatedLeaderboardAndTies(eventId: string): Promise<{
  leaderboard: ParticipantAggregatedScore[];
  tieAlerts: TieBreakerAlert[];
}> {
  const supabase = await createServerSupabaseClient();

  // Fetch participants and all scores
  const [{ data: participants }, { data: scores }] = await Promise.all([
    supabase.from('participants').select('*').eq('competition_id', eventId),
    supabase.from('scores').select('*').eq('event_id', eventId),
  ]);

  if (!participants || participants.length === 0) {
    return { leaderboard: [], tieAlerts: [] };
  }

  const scoreMap = new Map<string, ParticipantAggregatedScore>();

  participants.forEach((p) => {
    scoreMap.set(p.id, {
      participantId: p.id,
      teamName: p.team_name || p.first_name || 'Team Participant',
      churchName: p.church_name || p.institution || 'Independent',
      participantName: p.participant_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Performer',
      performanceType: p.performance_type || 'solo',
      bestKeyboardist: p.best_keyboardist || null,
      bestRhythmist: p.best_rhythmist || null,
      bestGuitarist: p.best_guitarist || null,
      soloSums: 0,
      duetSums: 0,
      groupSums: 0,
      keyboardistSums: 0,
      rhythmistSums: 0,
      guitaristSums: 0,
      specialInstrumentTotal: 0,
      grandTotal: 0,
      judgeCount: 0,
      isTie: false,
      tieCategories: [],
    });
  });

  // Calculate Strict Sum Totals (No average/variance)
  (scores || []).forEach((s) => {
    const entry = scoreMap.get(s.participant_id);
    if (!entry) return;

    entry.soloSums += Number(s.solo_score || 0);
    entry.duetSums += Number(s.duet_score || 0);
    entry.groupSums += Number(s.group_score || 0);
    entry.keyboardistSums += Number(s.keyboardist_score || 0);
    entry.rhythmistSums += Number(s.rhythmist_score || 0);
    entry.guitaristSums += Number(s.guitarist_score || 0);
    entry.judgeCount += 1;
  });

  // Compute Grand Totals & Instrument Totals
  const results: ParticipantAggregatedScore[] = Array.from(scoreMap.values()).map((item) => {
    const specialInstrumentTotal = item.keyboardistSums + item.rhythmistSums + item.guitaristSums;
    const grandTotal = item.soloSums + item.duetSums + item.groupSums + specialInstrumentTotal;
    return {
      ...item,
      specialInstrumentTotal,
      grandTotal,
    };
  });

  // Sort Descending by Grand Total
  results.sort((a, b) => b.grandTotal - a.grandTotal);

  // Tie-Breaker Detection Algorithm
  const tieAlerts: TieBreakerAlert[] = [];
  const checkTieCategory = (
    catName: string,
    getValue: (item: ParticipantAggregatedScore) => number
  ) => {
    const valueBuckets = new Map<number, ParticipantAggregatedScore[]>();

    results.forEach((item) => {
      const val = getValue(item);
      if (val <= 0) return; // Ignore zero scores
      const bucket = valueBuckets.get(val) || [];
      bucket.push(item);
      valueBuckets.set(val, bucket);
    });

    valueBuckets.forEach((tiedList, scoreVal) => {
      if (tiedList.length > 1) {
        tiedList.forEach((t) => {
          t.isTie = true;
          if (!t.tieCategories.includes(catName)) t.tieCategories.push(catName);
        });

        tieAlerts.push({
          category: catName,
          score: scoreVal,
          tiedTeams: tiedList.map((t) => ({
            participantId: t.participantId,
            teamName: t.teamName,
            churchName: t.churchName,
          })),
          alertMessage: `Tie Alert [${catName}]: ${tiedList.length} teams tied with identical score ${scoreVal.toFixed(2)} pts`,
        });
      }
    });
  };

  // Run tie check across all strict categories & Grand Total
  checkTieCategory('Grand Total', (i) => i.grandTotal);
  checkTieCategory('Solo Performance', (i) => i.soloSums);
  checkTieCategory('Duet Performance', (i) => i.duetSums);
  checkTieCategory('Group Performance', (i) => i.groupSums);
  checkTieCategory('Best Keyboardist', (i) => i.keyboardistSums);
  checkTieCategory('Best Rhythmist', (i) => i.rhythmistSums);
  checkTieCategory('Best Guitarist', (i) => i.guitaristSums);

  return { leaderboard: results, tieAlerts };
}

/**
 * Backward Compatible Stored-Procedure Scoring Actions
 */
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
