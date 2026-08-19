'use server';

// src/actions/awards.ts - Dynamic Awards Management, Auto-Winner Assignment & Manual Overrides

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { AwardSchema, AwardOverrideSchema } from '@/lib/validation/schemas';
import { Award, AwardWinner } from '@/types';
import { SEED_AWARDS } from '@/lib/awards/awardEngine';
import { revalidatePath } from 'next/cache';

export async function seedCompetitionAwards(competitionId: string) {
  const user = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const toInsert = SEED_AWARDS.map((a) => ({
    competition_id: competitionId,
    code: a.code,
    name: a.name,
    description: a.description,
    display_order: a.displayOrder,
    is_active: true,
  }));

  const { error } = await supabase
    .from('awards')
    .upsert(toInsert, { onConflict: 'competition_id, code' });

  if (error) throw new Error(`Failed to seed awards: ${error.message}`);

  await supabase.from('audit_logs').insert({
    competition_id: competitionId,
    actor_id: user.id,
    action: 'SEED_AWARDS',
    entity: 'awards',
    entity_id: competitionId,
    new_state: { count: toInsert.length },
  });

  revalidatePath('/admin/awards');
}

export async function getCompetitionAwards(competitionId: string): Promise<Award[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('awards')
    .select('*, winners:award_winners(*, participant:participants(*), team:teams(*))')
    .eq('competition_id', competitionId)
    .order('display_order', { ascending: true });

  if (error) return [];

  return data.map((a) => ({
    id: a.id,
    competitionId: a.competition_id,
    categoryId: a.category_id,
    code: a.code,
    name: a.name,
    description: a.description,
    displayOrder: a.display_order,
    isActive: a.is_active,
    winners: (a.winners || []).map((w: any) => ({
      id: w.id,
      awardId: w.award_id,
      performanceId: w.performance_id,
      participantId: w.participant_id,
      teamId: w.team_id,
      isOverride: w.is_override,
      overrideReason: w.override_reason,
      overriddenBy: w.overridden_by,
      awardedAt: w.awarded_at,
      participant: w.participant ? {
        id: w.participant.id,
        competitionId: w.participant.competition_id,
        participantCode: w.participant.participant_code,
        firstName: w.participant.first_name,
        lastName: w.participant.last_name,
        environment: w.participant.environment,
        createdAt: w.participant.created_at,
        updatedAt: w.participant.updated_at,
      } : undefined,
      team: w.team ? {
        id: w.team.id,
        competitionId: w.team.competition_id,
        teamCode: w.team.team_code,
        name: w.team.name,
        environment: w.team.environment,
        createdAt: w.team.created_at,
      } : undefined,
    })),
    createdAt: a.created_at,
  }));
}

export async function overrideAwardWinner(overridePayload: unknown) {
  const user = await requireRole('admin');
  const validated = AwardOverrideSchema.parse(overridePayload);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('award_winners')
    .upsert({
      award_id: validated.awardId,
      performance_id: validated.performanceId || null,
      participant_id: validated.participantId || null,
      team_id: validated.teamId || null,
      is_override: true,
      override_reason: validated.overrideReason,
      overridden_by: user.id,
      awarded_at: new Date().toISOString(),
    }, { onConflict: 'award_id, performance_id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to override award: ${error.message}`);

  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'OVERRIDE_AWARD_WINNER',
    entity: 'award_winners',
    entity_id: data.id,
    reason: validated.overrideReason,
    new_state: data,
  });

  revalidatePath('/admin/awards');
}
