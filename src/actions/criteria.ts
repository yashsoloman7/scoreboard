'use server';

// src/actions/criteria.ts - Creator-Defined Dynamic Criteria, Time Slots & Weightage Management
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';

export interface CustomCriterion {
  id?: string;
  name: string;
  maxMarks: number;
  description?: string;
  displayOrder?: number;
}

export interface TimeSlotConfig {
  soloDurationSeconds: number;
  duetDurationSeconds: number;
  groupDurationSeconds: number;
}

export interface EventCriteriaConfig {
  eventId: string;
  criteria: CustomCriterion[];
  totalMaxMarks: number;
  timeSlots: TimeSlotConfig;
  instrumentsEnabled?: boolean;
  instrumentMaxMarks?: number;
}

const DEFAULT_CRITERIA: CustomCriterion[] = [
  { name: 'Technicality & Vocal Precision', maxMarks: 30, description: 'Pitch accuracy, intonation, vocal control & breathing', displayOrder: 1 },
  { name: 'Presentation & Stage Presence', maxMarks: 30, description: 'Expression, diction, poise, harmony & dynamics', displayOrder: 2 },
  { name: 'Rhythm, Timing & Musicality', maxMarks: 20, description: 'Tempo stability, groove & rhythmic phrasing', displayOrder: 3 },
  { name: 'Overall Impact & Artistry', maxMarks: 20, description: 'Interpretation, emotional delivery & overall effect', displayOrder: 4 },
];

const DEFAULT_TIME_SLOTS: TimeSlotConfig = {
  soloDurationSeconds: 240, // 4 mins
  duetDurationSeconds: 300, // 5 mins
  groupDurationSeconds: 480, // 8 mins
};

/**
 * 1. Fetch Dynamic Criteria & Time Slots Configured by Event Creator
 */
export async function getEventCriteria(eventId: string): Promise<EventCriteriaConfig> {
  const supabase = await createServerSupabaseClient();

  const { data: settings } = await supabase
    .from('competition_settings')
    .select('*')
    .eq('competition_id', eventId)
    .maybeSingle();

  const settingsCriteria = settings?.criteria_config;

  const timeSlots: TimeSlotConfig = {
    soloDurationSeconds: Number(settings?.solo_duration_seconds || DEFAULT_TIME_SLOTS.soloDurationSeconds),
    duetDurationSeconds: Number(settings?.duet_duration_seconds || DEFAULT_TIME_SLOTS.duetDurationSeconds),
    groupDurationSeconds: Number(settings?.group_duration_seconds || DEFAULT_TIME_SLOTS.groupDurationSeconds),
  };

  if (settingsCriteria && Array.isArray(settingsCriteria) && settingsCriteria.length > 0) {
    const totalMax = settingsCriteria.reduce((sum: number, c: any) => sum + Number(c.maxMarks || 0), 0);
    return {
      eventId,
      criteria: settingsCriteria,
      totalMaxMarks: totalMax,
      timeSlots,
      instrumentsEnabled: settings?.instruments_enabled ?? true,
      instrumentMaxMarks: Number(settings?.instrument_max_marks || 100),
    };
  }

  return {
    eventId,
    criteria: DEFAULT_CRITERIA,
    totalMaxMarks: 100,
    timeSlots,
    instrumentsEnabled: true,
    instrumentMaxMarks: 100,
  };
}

/**
 * 2. Save Custom Criteria, Weightages & Category Time Slots
 */
export async function saveEventCriteria(
  eventId: string,
  criteriaList: CustomCriterion[],
  timeSlots: TimeSlotConfig = DEFAULT_TIME_SLOTS,
  instrumentsEnabled: boolean = true,
  instrumentMaxMarks: number = 100
) {
  try {
    const admin = await requireRole('admin');
    const supabase = await createServerSupabaseClient();

    if (!criteriaList || criteriaList.length === 0) {
      throw new Error('At least one criterion parameter must be configured.');
    }

    const sanitizedCriteria = criteriaList.map((c, idx) => ({
      id: c.id || `crit-${idx + 1}`,
      name: c.name.trim() || `Criterion ${idx + 1}`,
      maxMarks: Math.max(1, Number(c.maxMarks) || 10),
      description: c.description?.trim() || '',
      displayOrder: idx + 1,
    }));

    try {
      const { error } = await supabase
        .from('competition_settings')
        .upsert({
          competition_id: eventId,
          criteria_config: sanitizedCriteria,
          solo_duration_seconds: timeSlots.soloDurationSeconds,
          duet_duration_seconds: timeSlots.duetDurationSeconds,
          group_duration_seconds: timeSlots.groupDurationSeconds,
          instruments_enabled: instrumentsEnabled,
          instrument_max_marks: instrumentMaxMarks,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'competition_id' });

      if (error) {
        console.warn('competition_settings update note:', error.message);
      }
    } catch (upsertErr) {
      console.warn('Failed to upsert competition_settings in saveEventCriteria:', upsertErr);
    }

    try {
      await supabase.from('audit_logs').insert({
        competition_id: eventId,
        actor_id: admin.id,
        action: 'CONFIGURE_EVENT_CRITERIA_AND_TIMESLOTS',
        entity: 'competition_settings',
        entity_id: eventId,
        new_state: { criteria: sanitizedCriteria, timeSlots, instrumentsEnabled, instrumentMaxMarks },
      });
    } catch (auditErr) {
      console.warn('Audit log write warning in saveEventCriteria:', auditErr);
    }

    try {
      revalidatePath('/judge');
      revalidatePath('/admin');
      revalidatePath('/admin/dashboard');
      revalidatePath('/admin/control-room');
      revalidatePath('/admin/staging');
    } catch (revErr) {
      console.warn('revalidatePath note:', revErr);
    }

    return { 
      success: true, 
      criteria: sanitizedCriteria,
      totalMaxMarks: sanitizedCriteria.reduce((sum, c) => sum + c.maxMarks, 0),
      timeSlots
    };
  } catch (error: unknown) {
    console.error('Error in saveEventCriteria:', error);
    if (error instanceof Error) throw error;
    throw new Error('Failed to save event criteria.');
  }
}
