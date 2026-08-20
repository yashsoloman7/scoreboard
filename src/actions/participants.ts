'use server';

// src/actions/participants.ts - Transactional Participant/Team Management & Bulk Import

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { Permissions } from '@/lib/auth/roles';
import { ParsedParticipantRow, ParsedTeamRow } from '@/lib/importers/participantImporter';
import { Participant, Performance } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getParticipantsByCompetition(competitionId: string): Promise<Participant[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('competition_id', competitionId)
    .order('performance_order', { ascending: true });

  if (error) {
    console.error('Error fetching participants:', error);
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    competitionId: p.competition_id,
    participantCode: p.participant_code || `P-${p.id.slice(0, 4)}`,
    firstName: p.first_name || '',
    lastName: p.last_name || '',
    teamName: p.team_name,
    churchName: p.church_name,
    participantName: p.participant_name,
    performanceType: p.performance_type || 'solo',
    bestKeyboardist: p.best_keyboardist,
    bestRhythmist: p.best_rhythmist,
    bestGuitarist: p.best_guitarist,
    performanceOrder: p.performance_order || 1,
    isActive: p.is_active ?? true,
    institution: p.church_name || p.institution,
    contactEmail: p.contact_email,
    contactPhone: p.contact_phone,
    environment: p.environment || 'live',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

export async function importParticipantsBulk(
  competitionId: string,
  categoryId: string,
  roundId: string,
  rows: ParsedParticipantRow[]
) {
  const user = await requirePermission(
    Permissions.canImportParticipants,
    'Unauthorized to import participants'
  );
  const supabase = await createServerSupabaseClient();

  const insertedParticipants: Participant[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const performanceOrder = row.performanceOrder || (i + 1);
      const participantCode = row.participantCode || `P-${performanceOrder.toString().padStart(3, '0')}`;

      // Upsert participant with extended enterprise fields
      const { data: pData, error: pError } = await supabase
        .from('participants')
        .upsert({
          competition_id: competitionId,
          participant_code: participantCode,
          first_name: row.firstName || row.participantName?.split(' ')[0] || 'Performer',
          last_name: row.lastName || row.participantName?.split(' ').slice(1).join(' ') || '',
          team_name: row.teamName || null,
          church_name: row.churchName || row.institution || null,
          participant_name: row.participantName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
          performance_type: row.performanceType || 'solo',
          best_keyboardist: row.bestKeyboardist || null,
          best_rhythmist: row.bestRhythmist || null,
          best_guitarist: row.bestGuitarist || null,
          performance_order: performanceOrder,
          institution: row.churchName || row.institution || null,
          contact_email: row.contactEmail || null,
          contact_phone: row.contactPhone || null,
          environment: 'live',
          is_active: true,
        }, { onConflict: 'competition_id, participant_code, environment' })
        .select()
        .single();

      if (pError) {
        errors.push(`Row ${i + 1} (${participantCode}): ${pError.message}`);
        continue;
      }

      // Schedule performance
      const performanceCode = `${participantCode}-R1`;

      const { data: perfData, error: perfError } = await supabase
        .from('performances')
        .upsert({
          round_id: roundId,
          participant_id: pData.id,
          performance_order: performanceOrder,
          performance_code: performanceCode,
          status: 'scheduled',
        }, { onConflict: 'round_id, performance_order' })
        .select()
        .single();

      if (perfError) {
        errors.push(`Performance creation failed for ${participantCode}: ${perfError.message}`);
      } else {
        // Initialize timer row for the performance
        await supabase.from('timers').upsert({
          performance_id: perfData.id,
          status: 'idle',
        }, { onConflict: 'performance_id' });
      }

      insertedParticipants.push({
        id: pData.id,
        competitionId: pData.competition_id,
        participantCode: pData.participant_code,
        firstName: pData.first_name,
        lastName: pData.last_name,
        teamName: pData.team_name,
        churchName: pData.church_name,
        participantName: pData.participant_name,
        performanceType: pData.performance_type,
        bestKeyboardist: pData.best_keyboardist,
        bestRhythmist: pData.best_rhythmist,
        bestGuitarist: pData.best_guitarist,
        performanceOrder: pData.performance_order,
        institution: pData.institution,
        contactEmail: pData.contact_email,
        contactPhone: pData.contact_phone,
        environment: pData.environment,
        createdAt: pData.created_at,
        updatedAt: pData.updated_at,
      });
    } catch (err: unknown) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    competition_id: competitionId,
    actor_id: user.id,
    action: 'BULK_IMPORT_PARTICIPANTS',
    entity: 'participants',
    entity_id: competitionId,
    new_state: {
      totalImported: insertedParticipants.length,
      errorsCount: errors.length,
      categoryId,
      roundId,
    },
  });

  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath(`/admin/staging`);
  revalidatePath(`/live`);

  return {
    success: errors.length === 0,
    importedCount: insertedParticipants.length,
    errors,
  };
}

export async function getPerformancesByRound(roundId: string): Promise<Performance[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('performances')
    .select('*, participant:participants(*), team:teams(*), timer:timers(*)')
    .eq('round_id', roundId)
    .order('performance_order', { ascending: true });

  if (error) {
    console.error('Error fetching performances:', error);
    return [];
  }

  return data.map((perf) => ({
    id: perf.id,
    roundId: perf.round_id,
    participantId: perf.participant_id,
    teamId: perf.team_id,
    performanceOrder: perf.performance_order,
    performanceCode: perf.performance_code,
    status: perf.status,
    startedAt: perf.started_at,
    completedAt: perf.completed_at,
    participant: perf.participant ? {
      id: perf.participant.id,
      competitionId: perf.participant.competition_id,
      participantCode: perf.participant.participant_code,
      firstName: perf.participant.first_name,
      lastName: perf.participant.last_name,
      institution: perf.participant.institution,
      environment: perf.participant.environment,
      createdAt: perf.participant.created_at,
      updatedAt: perf.participant.updated_at,
    } : null,
    team: perf.team ? {
      id: perf.team.id,
      competitionId: perf.team.competition_id,
      teamCode: perf.team.team_code,
      name: perf.team.name,
      institution: perf.team.institution,
      environment: perf.team.environment,
      createdAt: perf.team.created_at,
    } : null,
    timer: perf.timer ? {
      id: perf.timer.id,
      performanceId: perf.timer.performance_id,
      status: perf.timer.status,
      configuredDurationSeconds: perf.timer.configured_duration_seconds,
      warningThresholdSeconds: perf.timer.warning_threshold_seconds,
      startedAt: perf.timer.started_at,
      pausedAt: perf.timer.paused_at,
      accumulatedDurationSeconds: Number(perf.timer.accumulated_duration_seconds),
      overtimeSeconds: Number(perf.timer.overtime_seconds),
      updatedAt: perf.timer.updated_at,
    } : null,
    createdAt: perf.created_at,
    updatedAt: perf.updated_at,
  }));
}
