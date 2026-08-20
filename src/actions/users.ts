'use server';

// src/actions/users.ts - Super Admin & Admin User Role Management
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { AppRole, UserProfile } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getUsersWithRoles(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*, roles:user_roles(role)')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    phoneNumber: p.phone_number,
    avatarUrl: p.avatar_url,
    isActive: p.is_active,
    role: (p.roles?.[0]?.role as AppRole) || 'unauthorized',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

/**
 * Super Admin & Admin Role Granting
 */
export async function grantUserRole(targetUserId: string, newRole: AppRole) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  // If granting super_admin, require actor to be super_admin
  if (newRole === 'super_admin') {
    await requireRole('super_admin');
  }

  // Delete previous role entries for single active role per user or upsert
  await supabase.from('user_roles').delete().eq('user_id', targetUserId);

  const { error } = await supabase.from('user_roles').insert({
    user_id: targetUserId,
    role: newRole,
    granted_by: admin.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to grant role: ${error.message}`);
  }

  // Insert audit trail
  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'GRANT_USER_ROLE',
    entity: 'user_roles',
    entity_id: targetUserId,
    new_state: { role: newRole, userId: targetUserId },
  });

  // Fetch user profile to send welcome email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profile?.email) {
    try {
      const { sendWelcomeEmail } = await import('@/lib/email/welcomeEmail');
      await sendWelcomeEmail({
        toEmail: profile.email,
        fullName: profile.full_name || undefined,
        role: newRole,
      });
    } catch (e) {
      console.warn('[Email Warning] Failed to send role update email:', e);
    }
  }

  revalidatePath('/admin/users');
  revalidatePath('/admin/dashboard');

  return { success: true };
}

/**
 * Revoke User Role
 */
export async function revokeUserRole(targetUserId: string) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId);

  if (error) {
    throw new Error(`Failed to revoke role: ${error.message}`);
  }

  await supabase.from('audit_logs').insert({
    actor_id: admin.id,
    action: 'REVOKE_USER_ROLE',
    entity: 'user_roles',
    entity_id: targetUserId,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin/dashboard');

  return { success: true };
}

/**
 * Direct Add User & Role Assignment
 */
export async function createUserWithRole(email: string, fullName: string, role: AppRole) {
  const admin = await requireRole('admin');
  const supabase = await createServerSupabaseClient();

  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  let targetUserId = existing?.id;

  if (!targetUserId) {
    // Insert into profiles
    const { data: newProfile, error: pError } = await supabase
      .from('profiles')
      .insert({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        is_active: true,
      })
      .select('id')
      .single();

    if (pError) {
      throw new Error(`Failed to create profile: ${pError.message}`);
    }
    targetUserId = newProfile.id;
  }

  // Assign role & trigger welcome email
  await grantUserRole(targetUserId, role);

  revalidatePath('/admin/users');
  revalidatePath('/admin/dashboard');

  return { success: true, userId: targetUserId };
}

/**
 * Direct trigger welcome email
 */
export async function sendWelcomeEmailToUser(
  email: string,
  role: AppRole = 'super_admin',
  fullName: string = 'CC Church Bhilai Administrator'
) {
  const { sendWelcomeEmail } = await import('@/lib/email/welcomeEmail');
  return await sendWelcomeEmail({
    toEmail: email.trim().toLowerCase(),
    fullName,
    role,
  });
}
