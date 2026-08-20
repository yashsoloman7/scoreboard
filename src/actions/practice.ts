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

  // 1. Check or Create Demo Category
  let { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('competition_id', competitionId)
    .eq('name', 'Practice Sandbox (Demo)')
    .maybeSingle();

  if (!cat) {
    const { data: newCat, error: catError } = await supabase
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

    if (catError || !newCat) {
      throw new Error(`Failed to create practice category: ${catError?.message || 'Unknown error'}`);
    }
    cat = newCat;
  }

  const categoryId = cat!.id;

  // 2. Check or Create Round
  let { data: round } = await supabase
    .from('rounds')
    .select('id')
    .eq('category_id', categoryId)
    .eq('round_number', 1)
    .maybeSingle();

  if (!round) {
    const { data: newRound, error: roundError } = await supabase
      .from('rounds')
      .insert({
        category_id: categoryId,
        round_number: 1,
        name: 'Practice Session',
        is_final: true,
      })
      .select()
      .single();

    if (roundError || !newRound) {
      throw new Error(`Failed to create practice round: ${roundError?.message || 'Unknown error'}`);
    }
    round = newRound;
  }

  const roundId = round!.id;

  // 3. Check or Create Criteria Version & Criteria
  let { data: version } = await supabase
    .from('criteria_versions')
    .select('id')
    .eq('category_id', categoryId)
    .eq('version_number', 1)
    .maybeSingle();

  if (!version) {
    const { data: newVersion, error: versionError } = await supabase
      .from('criteria_versions')
      .insert({
        category_id: categoryId,
        version_number: 1,
        is_locked: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (versionError || !newVersion) {
      throw new Error(`Failed to create criteria version: ${versionError?.message || 'Unknown error'}`);
    }
    version = newVersion;

    const criteriaRows = PRACTICE_DEMO_CRITERIA.map((c) => ({
      criteria_version_id: version!.id,
      name: c.name,
      max_marks: c.maxMarks,
      weight: c.weight,
      display_order: c.displayOrder,
    }));

    await supabase.from('category_criteria').insert(criteriaRows);
  }

  // 4. Insert Demo Participants and Performances
  for (let i = 0; i < PRACTICE_DEMO_PARTICIPANTS.length; i++) {
    const demo = PRACTICE_DEMO_PARTICIPANTS[i];
    const { data: p, error: pError } = await supabase
      .from('participants')
      .upsert({
        competition_id: competitionId,
        participant_code: demo.participantCode,
        first_name: demo.firstName,
        last_name: demo.lastName,
        institution: demo.institution,
        environment: 'practice',
      }, { onConflict: 'competition_id,participant_code,environment' })
      .select()
      .single();

    if (pError || !p) {
      console.error('Participant upsert error:', pError);
      continue;
    }

    const { data: existingPerf } = await supabase
      .from('performances')
      .select('id')
      .eq('round_id', roundId)
      .eq('performance_order', i + 1)
      .maybeSingle();

    let perfId = existingPerf?.id;

    if (!existingPerf) {
      const { data: newPerf, error: perfError } = await supabase
        .from('performances')
        .insert({
          round_id: roundId,
          participant_id: p.id,
          performance_order: i + 1,
          performance_code: `${demo.participantCode}-R1`,
          status: i === 0 ? 'performing' : 'scheduled',
        })
        .select()
        .single();

      if (perfError) {
        console.error('Performance insert error:', perfError);
      } else if (newPerf) {
        perfId = newPerf.id;
      }
    }

    if (perfId) {
      const { data: existingTimer } = await supabase
        .from('timers')
        .select('id')
        .eq('performance_id', perfId)
        .maybeSingle();

      if (!existingTimer) {
        await supabase.from('timers').insert({
          performance_id: perfId,
          status: 'idle',
        });
      }
    }
  }

  // 5. Assign current user as judge to the practice category
  await supabase.from('judge_assignments').upsert({
    competition_id: competitionId,
    category_id: categoryId,
    judge_id: user.id,
    judge_seat_number: 1,
    is_active: true,
  }, { onConflict: 'category_id,judge_id' });

  revalidatePath('/admin/control-room');
  revalidatePath('/judge');
  return { success: true, categoryId, roundId };
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
