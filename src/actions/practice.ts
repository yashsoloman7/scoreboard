'use server';

// src/actions/practice.ts - Server Actions for Sandbox Practice Mode

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/guards';
import { Permissions } from '@/lib/auth/roles';
import { PRACTICE_DEMO_PARTICIPANTS, PRACTICE_DEMO_CRITERIA } from '@/lib/practice/practiceManager';
import { revalidatePath } from 'next/cache';

export async function initializePracticeSandbox(competitionId: string) {
  const user = await requirePermission(
    Permissions.canAccessPracticeMode,
    'Unauthorized to initialize practice sandbox'
  );
  const supabase = await createServerSupabaseClient();

  // 1. Create Demo Category
  const { data: cat } = await supabase
    .from('categories')
    .insert({
      competition_id: competitionId,
      name: 'Practice Sandbox (Demo)',
      performer_type: 'solo',
      display_order: 999,
      scoring_formula: 'weighted_sum',
    })
    .select()
    .single();

  // 2. Create Round
  const { data: round } = await supabase
    .from('rounds')
    .insert({
      category_id: cat.id,
      round_number: 1,
      name: 'Practice Session',
      is_final: true,
    })
    .select()
    .single();

  // 3. Create Criteria Version & Criteria
  const { data: version } = await supabase
    .from('criteria_versions')
    .insert({
      category_id: cat.id,
      version_number: 1,
      is_locked: false,
      created_by: user.id,
    })
    .select()
    .single();

  const criteriaRows = PRACTICE_DEMO_CRITERIA.map((c) => ({
    criteria_version_id: version.id,
    name: c.name,
    max_marks: c.maxMarks,
    weight: c.weight,
    display_order: c.displayOrder,
  }));

  await supabase.from('category_criteria').insert(criteriaRows);

  // 4. Insert Demo Participants and Performances
  for (let i = 0; i < PRACTICE_DEMO_PARTICIPANTS.length; i++) {
    const demo = PRACTICE_DEMO_PARTICIPANTS[i];
    const { data: p } = await supabase
      .from('participants')
      .upsert({
        competition_id: competitionId,
        participant_code: demo.participantCode,
        first_name: demo.firstName,
        lastName: demo.lastName,
        institution: demo.institution,
        environment: 'practice',
      }, { onConflict: 'competition_id, participant_code, environment' })
      .select()
      .single();

    const { data: perf } = await supabase
      .from('performances')
      .insert({
        round_id: round.id,
        participant_id: p.id,
        performance_order: i + 1,
        performance_code: `${demo.participantCode}-R1`,
        status: i === 0 ? 'performing' : 'scheduled',
      })
      .select()
      .single();

    await supabase.from('timers').insert({
      performance_id: perf.id,
      status: 'idle',
    });
  }

  // 5. Assign current user as judge to the practice category
  await supabase.from('judge_assignments').upsert({
    competition_id: competitionId,
    category_id: cat.id,
    judge_id: user.id,
    judge_seat_number: 1,
    is_active: true,
  }, { onConflict: 'category_id, judge_id' });

  revalidatePath('/practice');
  return { success: true, categoryId: cat.id, roundId: round.id };
}

export async function resetPracticeSandbox(competitionId: string) {
  await requirePermission(
    Permissions.canAccessPracticeMode,
    'Unauthorized to reset practice sandbox'
  );
  const supabase = await createServerSupabaseClient();

  // Delete practice participants (cascades to performances, scores, etc.)
  await supabase
    .from('participants')
    .delete()
    .eq('competition_id', competitionId)
    .eq('environment', 'practice');

  revalidatePath('/practice');
  return { success: true };
}
