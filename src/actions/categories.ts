'use server';

// src/actions/categories.ts - Server Actions for Categories, Rounds, and Criteria Setup

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { CategorySchema, RoundSchema } from '@/lib/validation/schemas';
import { Category, Round } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getCategories(competitionId: string): Promise<Category[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('categories')
    .select('*, rounds(*)')
    .eq('competition_id', competitionId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data.map((cat) => ({
    id: cat.id,
    competitionId: cat.competition_id,
    name: cat.name,
    performerType: cat.performer_type,
    displayOrder: cat.display_order,
    scoringFormula: cat.scoring_formula,
    status: cat.status,
    createdAt: cat.created_at,
    updatedAt: cat.updated_at,
    rounds: cat.rounds?.map((r: any) => ({
      id: r.id,
      categoryId: r.category_id,
      roundNumber: r.round_number,
      name: r.name,
      isFinal: r.is_final,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  }));
}

export async function createCategory(formData: unknown): Promise<Category> {
  const user = await requireRole('admin');
  const validated = CategorySchema.parse(formData);
  const supabase = await createServerSupabaseClient();

  // Create Category
  const { data: category, error: catError } = await supabase
    .from('categories')
    .insert({
      competition_id: validated.competitionId,
      name: validated.name,
      performer_type: validated.performerType,
      display_order: validated.displayOrder,
      scoring_formula: validated.scoringFormula,
    })
    .select()
    .single();

  if (catError) {
    throw new Error(`Failed to create category: ${catError.message}`);
  }

  // Create default Preliminary Round
  const { data: round } = await supabase
    .from('rounds')
    .insert({
      category_id: category.id,
      round_number: 1,
      name: 'Round 1 (Preliminary)',
      is_final: true,
    })
    .select()
    .single();

  // Create initial Criteria Version (v1)
  await supabase
    .from('criteria_versions')
    .insert({
      category_id: category.id,
      version_number: 1,
      is_locked: false,
      created_by: user.id,
    });

  // Default tie break rule (Highest Average)
  await supabase
    .from('tie_break_rules')
    .insert({
      category_id: category.id,
      priority_order: 1,
      rule_type: 'highest_average',
    });

  revalidatePath(`/admin/competitions/${validated.competitionId}`);

  return {
    id: category.id,
    competitionId: category.competition_id,
    name: category.name,
    performerType: category.performer_type,
    displayOrder: category.display_order,
    scoringFormula: category.scoring_formula,
    status: category.status,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
    rounds: round ? [{
      id: round.id,
      categoryId: round.category_id,
      roundNumber: round.round_number,
      name: round.name,
      isFinal: round.is_final,
      createdAt: round.created_at,
      updatedAt: round.updated_at,
    }] : [],
  };
}

export async function createRound(formData: unknown): Promise<Round> {
  await requireRole('admin');
  const validated = RoundSchema.parse(formData);
  const supabase = await createServerSupabaseClient();

  const { data: round, error } = await supabase
    .from('rounds')
    .insert({
      category_id: validated.categoryId,
      round_number: validated.roundNumber,
      name: validated.name,
      is_final: validated.isFinal,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create round: ${error.message}`);
  }

  return {
    id: round.id,
    categoryId: round.category_id,
    roundNumber: round.round_number,
    name: round.name,
    isFinal: round.is_final,
    createdAt: round.created_at,
    updatedAt: round.updated_at,
  };
}
