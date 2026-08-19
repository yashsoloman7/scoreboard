'use server';

// src/actions/criteria.ts - Criteria Management with Immutability Versioning

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { CriteriaConfigSchema } from '@/lib/validation/schemas';
import { CategoryCriterion, CriteriaVersion } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getActiveCriteriaVersion(categoryId: string): Promise<CriteriaVersion | null> {
  const supabase = await createServerSupabaseClient();
  
  // Fetch latest criteria version
  const { data: version, error: vError } = await supabase
    .from('criteria_versions')
    .select('*')
    .eq('category_id', categoryId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (vError || !version) return null;

  // Fetch criteria rows
  const { data: criteria, error: cError } = await supabase
    .from('category_criteria')
    .select('*')
    .eq('criteria_version_id', version.id)
    .order('display_order', { ascending: true });

  if (cError) return null;

  return {
    id: version.id,
    categoryId: version.category_id,
    versionNumber: version.version_number,
    isLocked: version.is_locked,
    lockedAt: version.locked_at,
    createdBy: version.created_by,
    createdAt: version.created_at,
    criteria: (criteria || []).map((c) => ({
      id: c.id,
      criteriaVersionId: c.criteria_version_id,
      name: c.name,
      description: c.description,
      maxMarks: Number(c.max_marks),
      weight: Number(c.weight),
      displayOrder: c.display_order,
      createdAt: c.created_at,
    })),
  };
}

export async function saveCriteriaConfiguration(configData: unknown): Promise<CriteriaVersion> {
  const user = await requireRole('admin');
  const validated = CriteriaConfigSchema.parse(configData);
  const supabase = await createServerSupabaseClient();

  // Check if current version is locked by existing scores
  const currentVersion = await getActiveCriteriaVersion(validated.categoryId);

  let targetVersionId: string;
  let targetVersionNumber = 1;

  if (currentVersion && currentVersion.isLocked) {
    // Current version has locked scores: Create a NEW version to preserve historical scores
    targetVersionNumber = currentVersion.versionNumber + 1;
    const { data: newVer, error: verErr } = await supabase
      .from('criteria_versions')
      .insert({
        category_id: validated.categoryId,
        version_number: targetVersionNumber,
        is_locked: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (verErr) throw new Error(`Failed to create criteria version: ${verErr.message}`);
    targetVersionId = newVer.id;
  } else if (currentVersion) {
    targetVersionId = currentVersion.id;
    targetVersionNumber = currentVersion.versionNumber;
    // Remove previous criteria in unlocked version to replace cleanly
    await supabase.from('category_criteria').delete().eq('criteria_version_id', targetVersionId);
  } else {
    // Initial version
    const { data: newVer, error: verErr } = await supabase
      .from('criteria_versions')
      .insert({
        category_id: validated.categoryId,
        version_number: 1,
        is_locked: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (verErr) throw new Error(`Failed to create criteria version: ${verErr.message}`);
    targetVersionId = newVer.id;
  }

  // Insert criteria rows
  const criteriaToInsert = validated.criteria.map((c, idx) => ({
    criteria_version_id: targetVersionId,
    name: c.name,
    description: c.description || null,
    max_marks: c.maxMarks,
    weight: c.weight,
    display_order: c.displayOrder || idx,
  }));

  const { data: insertedCriteria, error: insErr } = await supabase
    .from('category_criteria')
    .insert(criteriaToInsert)
    .select();

  if (insErr) {
    throw new Error(`Failed to save criteria items: ${insErr.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'SAVE_CRITERIA_CONFIGURATION',
    entity: 'criteria_versions',
    entity_id: targetVersionId,
    new_state: { versionNumber: targetVersionNumber, count: insertedCriteria.length },
  });

  revalidatePath(`/admin/competitions`);

  return {
    id: targetVersionId,
    categoryId: validated.categoryId,
    versionNumber: targetVersionNumber,
    isLocked: false,
    createdAt: new Date().toISOString(),
    criteria: insertedCriteria.map((c) => ({
      id: c.id,
      criteriaVersionId: c.criteria_version_id,
      name: c.name,
      description: c.description,
      maxMarks: Number(c.max_marks),
      weight: Number(c.weight),
      displayOrder: c.display_order,
      createdAt: c.created_at,
    })),
  };
}
