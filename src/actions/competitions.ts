'use server';

// src/actions/competitions.ts - Server Actions for Competitions & Settings

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { CompetitionSchema, CompetitionSettingsSchema } from '@/lib/validation/schemas';
import { Competition, CompetitionSettings } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getCompetitions(): Promise<Competition[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('competitions')
    .select('*, settings:competition_settings(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching competitions:', error);
    return [];
  }

  return data.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    venue: c.venue,
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    environment: c.environment,
    createdBy: c.created_by,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    settings: c.settings ? {
      competitionId: c.settings.competition_id,
      allowMultipleJudgeDevices: c.settings.allow_multiple_judge_devices,
      requireAdminDeviceApproval: c.settings.require_admin_device_approval,
      autoLockScoreOnSubmit: c.settings.auto_lock_score_on_submit,
      defaultTimerDurationSeconds: c.settings.default_timer_duration_seconds,
      warningThresholdSeconds: c.settings.warning_threshold_seconds,
      allowPracticeMode: c.settings.allow_practice_mode,
      updatedAt: c.settings.updated_at,
    } : undefined,
  }));
}

export async function getCompetitionById(id: string): Promise<Competition | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('competitions')
    .select('*, settings:competition_settings(*)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    venue: data.venue,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    environment: data.environment,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    settings: data.settings ? {
      competitionId: data.settings.competition_id,
      allowMultipleJudgeDevices: data.settings.allow_multiple_judge_devices,
      requireAdminDeviceApproval: data.settings.require_admin_device_approval,
      autoLockScoreOnSubmit: data.settings.auto_lock_score_on_submit,
      defaultTimerDurationSeconds: data.settings.default_timer_duration_seconds,
      warningThresholdSeconds: data.settings.warning_threshold_seconds,
      allowPracticeMode: data.settings.allow_practice_mode,
      updatedAt: data.settings.updated_at,
    } : undefined,
  };
}

export async function createCompetition(formData: unknown) {
  const user = await requireRole('admin');
  const validated = CompetitionSchema.parse(formData);
  const supabase = await createServerSupabaseClient();

  // Insert competition
  const { data: comp, error: compError } = await supabase
    .from('competitions')
    .insert({
      code: validated.code.toUpperCase(),
      name: validated.name,
      description: validated.description,
      venue: validated.venue,
      start_date: validated.startDate,
      end_date: validated.endDate,
      environment: validated.environment,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (compError) {
    throw new Error(`Failed to create competition: ${compError.message}`);
  }

  // Insert default settings
  await supabase.from('competition_settings').insert({
    competition_id: comp.id,
  });

  // Initialize competition state
  await supabase.from('competition_state').insert({
    competition_id: comp.id,
    is_live_active: false,
    updated_by: user.id,
  });

  // Log audit
  await supabase.from('audit_logs').insert({
    competition_id: comp.id,
    actor_id: user.id,
    action: 'CREATE_COMPETITION',
    entity: 'competitions',
    entity_id: comp.id,
    new_state: comp,
  });

  revalidatePath('/admin/competitions');
  return comp;
}

export async function updateCompetitionSettings(
  competitionId: string,
  settingsData: unknown
) {
  const user = await requireRole('admin');
  const validated = CompetitionSettingsSchema.parse(settingsData);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('competition_settings')
    .upsert({
      competition_id: competitionId,
      allow_multiple_judge_devices: validated.allowMultipleJudgeDevices,
      require_admin_device_approval: validated.requireAdminDeviceApproval,
      auto_lock_score_on_submit: validated.autoLockScoreOnSubmit,
      default_timer_duration_seconds: validated.defaultTimerDurationSeconds,
      warning_threshold_seconds: validated.warningThresholdSeconds,
      allow_practice_mode: validated.allowPracticeMode,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    competition_id: competitionId,
    actor_id: user.id,
    action: 'UPDATE_COMPETITION_SETTINGS',
    entity: 'competition_settings',
    entity_id: competitionId,
    new_state: validated,
  });

  revalidatePath(`/admin/competitions/${competitionId}`);
}

export async function deleteCompetition(competitionId: string) {
  const user = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  // Fetch competition name for audit
  const { data: comp } = await supabase
    .from('competitions')
    .select('name, code')
    .eq('id', competitionId)
    .maybeSingle();

  // Delete competition (cascade handles participants, scores, timers, event_state)
  const { error } = await supabase
    .from('competitions')
    .delete()
    .eq('id', competitionId);

  if (error) {
    throw new Error(`Failed to delete competition: ${error.message}`);
  }

  // Insert audit record
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'DELETE_COMPETITION',
    entity: 'competitions',
    entity_id: competitionId,
    old_state: comp || { id: competitionId },
  });

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/competitions');
  revalidatePath('/admin/control-room');
  revalidatePath('/live');

  return { success: true };
}
