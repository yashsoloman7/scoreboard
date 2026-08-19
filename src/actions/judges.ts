'use server';

// src/actions/judges.ts - Judge Authorization, Category Assignment & Session Security

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { JudgeAssignmentSchema } from '@/lib/validation/schemas';
import { JudgeAssignment, JudgeSession, UserProfile } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getJudges(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*, roles:user_roles(role)')
    .order('full_name', { ascending: true });

  if (error) return [];

  return data.map((p) => {
    const role = p.roles?.[0]?.role || 'unauthorized';
    return {
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      phoneNumber: p.phone_number,
      avatarUrl: p.avatar_url,
      isActive: p.is_active,
      role,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function authorizeUserRole(userId: string, role: string) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  // Upsert user role
  const { error } = await supabase
    .from('user_roles')
    .upsert({
      user_id: userId,
      role: role as any,
      granted_by: admin.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id, role' });

  if (error) {
    throw new Error(`Failed to update role: ${error.message}`);
  }

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'AUTHORIZE_USER_ROLE',
    entity: 'user_roles',
    entity_id: userId,
    new_state: { role, userId },
  });

  revalidatePath('/admin/judges');
}

export async function assignJudgeToCategory(assignmentData: unknown): Promise<JudgeAssignment> {
  const admin = await requireRole('admin');
  const validated = JudgeAssignmentSchema.parse(assignmentData);
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('judge_assignments')
    .upsert({
      competition_id: validated.competitionId,
      category_id: validated.categoryId,
      judge_id: validated.judgeId,
      judge_seat_number: validated.judgeSeatNumber,
      is_active: true,
    }, { onConflict: 'category_id, judge_id' })
    .select('*, judge:profiles(*)')
    .single();

  if (error) {
    throw new Error(`Failed to assign judge: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    competition_id: validated.competitionId,
    actor_id: admin.id,
    action: 'ASSIGN_JUDGE_TO_CATEGORY',
    entity: 'judge_assignments',
    entity_id: data.id,
    new_state: data,
  });

  revalidatePath(`/admin/competitions/${validated.competitionId}`);

  return {
    id: data.id,
    competitionId: data.competition_id,
    categoryId: data.category_id,
    judgeId: data.judge_id,
    judgeSeatNumber: data.judge_seat_number,
    isActive: data.is_active,
    assignedAt: data.assigned_at,
  };
}

export async function getJudgeAssignments(categoryId: string): Promise<JudgeAssignment[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('judge_assignments')
    .select('*, judge:profiles(*)')
    .eq('category_id', categoryId)
    .order('judge_seat_number', { ascending: true });

  if (error) return [];

  return data.map((d) => ({
    id: d.id,
    competitionId: d.competition_id,
    categoryId: d.category_id,
    judgeId: d.judge_id,
    judgeSeatNumber: d.judge_seat_number,
    isActive: d.is_active,
    judge: d.judge ? {
      id: d.judge.id,
      email: d.judge.email,
      fullName: d.judge.full_name,
      phoneNumber: d.judge.phone_number,
      avatarUrl: d.judge.avatar_url,
      isActive: d.judge.is_active,
      role: 'judge',
      createdAt: d.judge.created_at,
      updatedAt: d.judge.updated_at,
    } : undefined,
    assignedAt: d.assigned_at,
  }));
}

export async function toggleJudgeSessionApproval(sessionId: string, approve: boolean) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('judge_sessions')
    .update({
      is_approved: approve,
      approved_by: approve ? admin.id : null,
      is_revoked: !approve,
    })
    .eq('id', sessionId);

  if (error) {
    throw new Error(`Failed to update judge session: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: approve ? 'APPROVE_JUDGE_SESSION' : 'REVOKE_JUDGE_SESSION',
    entity: 'judge_sessions',
    entity_id: sessionId,
  });

  revalidatePath('/admin/sessions');
}
