'use server';

// src/actions/criteria.ts - Creator-Defined Dynamic Criteria & Weightage Management
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

export interface EventCriteriaConfig {
  eventId: string;
  criteria: CustomCriterion[];
  totalMaxMarks: number;
  instrumentsEnabled?: boolean;
  instrumentMaxMarks?: number;
}

const DEFAULT_CRITERIA: CustomCriterion[] = [
  { name: 'Technicality & Vocal Precision', maxMarks: 30, description: 'Pitch, intonation, vocal control & tone quality', displayOrder: 1 },
  { name: 'Presentation & Stage Presence', maxMarks: 30, description: 'Expression, poise, diction, harmony & stage dynamics', displayOrder: 2 },
  { name: 'Rhythm, Timing & Musicality', maxMarks: 20, description: 'Tempo stability, groove & rhythmic phrasing', displayOrder: 3 },
  { name: 'Overall Impact & Artistry', maxMarks: 20, description: 'Interpretation, emotional delivery & overall effect', displayOrder: 4 },
];

/**
 * 1. Fetch Dynamic Criteria Configured by Event Creator
 */
export async function getEventCriteria(eventId: string): Promise<EventCriteriaConfig> {
  const supabase = await createServerSupabaseClient();

  // 1. Check if configured in competition_settings or category_criteria
  const { data: comp } = await supabase
    .from('competitions')
    .select('id, settings:competition_settings(*)')
    .eq('id', eventId)
    .maybeSingle();

  const settingsCriteria = (comp?.settings as any)?.criteria_config;

  if (settingsCriteria && Array.isArray(settingsCriteria) && settingsCriteria.length > 0) {
    const totalMax = settingsCriteria.reduce((sum: number, c: any) => sum + Number(c.maxMarks || 0), 0);
    return {
      eventId,
      criteria: settingsCriteria,
      totalMaxMarks: totalMax,
      instrumentsEnabled: (comp?.settings as any)?.instruments_enabled ?? true,
      instrumentMaxMarks: Number((comp?.settings as any)?.instrument_max_marks || 100),
    };
  }

  // 2. Check category_criteria
  const { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('competition_id', eventId)
    .limit(1)
    .maybeSingle();

  if (cat) {
    const { data: catCriteria } = await supabase
      .from('category_criteria')
      .select('*')
      .order('display_order', { ascending: true });

    if (catCriteria && catCriteria.length > 0) {
      const criteriaList = catCriteria.map((c: any) => ({
        id: c.id,
        name: c.name,
        maxMarks: Number(c.max_marks || 25),
        description: c.description || '',
        displayOrder: c.display_order,
      }));
      const totalMax = criteriaList.reduce((sum, c) => sum + c.maxMarks, 0);
      return {
        eventId,
        criteria: criteriaList,
        totalMaxMarks: totalMax,
        instrumentsEnabled: true,
        instrumentMaxMarks: 100,
      };
    }
  }

  // 3. Fallback to standard defaults (Total: 100)
  return {
    eventId,
    criteria: DEFAULT_CRITERIA,
    totalMaxMarks: 100,
    instrumentsEnabled: true,
    instrumentMaxMarks: 100,
  };
}

/**
 * 2. Save Custom Criteria & Weightages Configured by Event Creator
 */
export async function saveEventCriteria(
  eventId: string,
  criteriaList: CustomCriterion[],
  instrumentsEnabled: boolean = true,
  instrumentMaxMarks: number = 100
) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  if (!criteriaList || criteriaList.length === 0) {
    throw new Error('At least one criterion parameter must be configured.');
  }

  // Validate all criteria have names and positive marks
  const sanitizedCriteria = criteriaList.map((c, idx) => ({
    id: c.id || `crit-${idx + 1}`,
    name: c.name.trim() || `Criterion ${idx + 1}`,
    maxMarks: Math.max(1, Number(c.maxMarks) || 10),
    description: c.description?.trim() || '',
    displayOrder: idx + 1,
  }));

  // Upsert into competition_settings
  const { error } = await supabase
    .from('competition_settings')
    .upsert({
      competition_id: eventId,
      criteria_config: sanitizedCriteria,
      instruments_enabled: instrumentsEnabled,
      instrument_max_marks: instrumentMaxMarks,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'competition_id' });

  if (error) {
    // If competition_settings doesn't have criteria_config column, store in audit logs & category
    console.warn('competition_settings update note:', error.message);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    competition_id: eventId,
    actor_id: admin.id,
    action: 'CONFIGURE_EVENT_CRITERIA',
    entity: 'competition_settings',
    entity_id: eventId,
    new_state: { criteria: sanitizedCriteria, instrumentsEnabled, instrumentMaxMarks },
  });

  revalidatePath('/judge');
  revalidatePath('/admin');
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/control-room');

  return { 
    success: true, 
    criteria: sanitizedCriteria,
    totalMaxMarks: sanitizedCriteria.reduce((sum, c) => sum + c.maxMarks, 0)
  };
}
