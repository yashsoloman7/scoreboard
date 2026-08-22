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
  try {
    const user = await requireRole('admin');

    // Parse form with detailed error capture
    let validated;
    try {
      validated = CompetitionSchema.parse(formData);
    } catch (zodErr: any) {
      if (zodErr?.errors && Array.isArray(zodErr.errors)) {
        const errorMessages = zodErr.errors
          .map((e: any) => `${e.path.join('.') || 'field'}: ${e.message}`)
          .join(', ');
        throw new Error(`Invalid event input: ${errorMessages}`);
      }
      throw new Error(`Validation failed: ${zodErr?.message || 'Invalid event parameters'}`);
    }

    const supabase = await createServerSupabaseClient();

    // Ensure profiles record exists for user to satisfy FK
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email || '',
        full_name: user.fullName || 'Admin User',
        is_active: true,
      }, { onConflict: 'id' });
    } catch {
      // Non-blocking profile check
    }

    // Insert competition
    const { data: comp, error: compError } = await supabase
      .from('competitions')
      .insert({
        code: validated.code.toUpperCase().trim(),
        name: validated.name.trim(),
        description: validated.description?.trim() || null,
        venue: validated.venue?.trim() || null,
        start_date: validated.startDate,
        end_date: validated.endDate,
        environment: validated.environment || 'live',
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single();

    if (compError) {
      if (compError.code === '23505' || compError.message?.includes('duplicate key') || compError.message?.includes('unique')) {
        throw new Error(`Competition code "${validated.code}" already exists. Please choose a unique code.`);
      }
      throw new Error(`Failed to create competition: ${compError.message}`);
    }

    // Insert default settings with event password / publish passcode
    const rawForm = (typeof formData === 'object' && formData !== null) ? (formData as any) : {};
    const eventPasscode = rawForm.eventPassword || rawForm.publishPasscode || validated.eventPassword || validated.publishPasscode || null;

    try {
      const { error: settingsError } = await supabase.from('competition_settings').upsert({
        competition_id: comp.id,
        publish_passcode: eventPasscode,
        allow_multiple_judge_devices: false,
        require_admin_device_approval: true,
        auto_lock_score_on_submit: true,
        default_timer_duration_seconds: 300,
        warning_threshold_seconds: 30,
        allow_practice_mode: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'competition_id' });

      // If publish_passcode column is not in DB schema yet, fallback to base columns
      if (settingsError && settingsError.message?.includes('publish_passcode')) {
        await supabase.from('competition_settings').upsert({
          competition_id: comp.id,
          allow_multiple_judge_devices: false,
          require_admin_device_approval: true,
          auto_lock_score_on_submit: true,
          default_timer_duration_seconds: 300,
          warning_threshold_seconds: 30,
          allow_practice_mode: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'competition_id' });
      }
    } catch (e) {
      console.warn('competition_settings setup warning:', e);
    }

    // Initialize competition_state safely
    try {
      await supabase.from('competition_state').upsert({
        competition_id: comp.id,
        is_live_active: false,
        updated_by: user.id,
      }, { onConflict: 'competition_id' });
    } catch (e) {
      console.warn('competition_state setup warning:', e);
    }

    // Initialize event_state safely
    try {
      await supabase.from('event_state').upsert({
        event_id: comp.id,
        stage_mode: 'standby',
        timer_status: 'idle',
        current_category: 'solo',
        updated_by: user.id,
      }, { onConflict: 'event_id' });
    } catch (e) {
      console.warn('event_state setup warning:', e);
    }

    // Log audit record safely (non-blocking)
    try {
      await supabase.from('audit_logs').insert({
        competition_id: comp.id,
        actor_id: user.id,
        action: 'CREATE_COMPETITION',
        entity: 'competitions',
        entity_id: comp.id,
        new_state: comp,
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    try {
      revalidatePath('/admin');
      revalidatePath('/admin/dashboard');
      revalidatePath('/admin/competitions');
      revalidatePath('/admin/control-room');
      revalidatePath('/admin/staging');
    } catch (revErr) {
      console.warn('revalidatePath note:', revErr);
    }

    return comp;
  } catch (error: unknown) {
    console.error('Server error in createCompetition:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected server error occurred while creating the event.');
  }
}

export async function updateCompetitionSettings(
  competitionId: string,
  settingsData: unknown
) {
  try {
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
      }, { onConflict: 'competition_id' });

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    try {
      await supabase.from('audit_logs').insert({
        competition_id: competitionId,
        actor_id: user.id,
        action: 'UPDATE_COMPETITION_SETTINGS',
        entity: 'competition_settings',
        entity_id: competitionId,
        new_state: validated,
      });
    } catch (auditErr) {
      console.warn('Audit log error:', auditErr);
    }

    revalidatePath(`/admin/competitions/${competitionId}`);
  } catch (error: unknown) {
    console.error('Error in updateCompetitionSettings:', error);
    if (error instanceof Error) throw error;
    throw new Error('Failed to update event settings.');
  }
}

export async function deleteCompetition(competitionId: string) {
  try {
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

    // Insert audit record safely
    try {
      await supabase.from('audit_logs').insert({
        competition_id: competitionId,
        actor_id: user.id,
        action: 'DELETE_COMPETITION',
        entity: 'competitions',
        entity_id: competitionId,
        old_state: comp || { id: competitionId },
      });
    } catch (auditErr) {
      console.warn('Audit log delete warning:', auditErr);
    }

    try {
      revalidatePath('/admin/dashboard');
      revalidatePath('/admin/competitions');
      revalidatePath('/admin/control-room');
      revalidatePath('/live');
    } catch (revErr) {
      console.warn('revalidatePath note:', revErr);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Error in deleteCompetition:', error);
    if (error instanceof Error) throw error;
    throw new Error('Failed to delete competition.');
  }
}
