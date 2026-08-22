'use server';

// src/actions/users.ts - Super Admin & Admin User Role Management

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { AppRole, UserProfile } from '@/types';
import { revalidatePath } from 'next/cache';
import { MASTER_SUPER_ADMIN_EMAIL } from '@/lib/constants';

export async function getUsersWithRoles(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  
  const [{ data: profiles, error: pError }, { data: roles, error: rError }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_roles').select('*'),
  ]);

  if (pError) {
    console.warn('[User Registry Notice] Profiles query:', pError.message);
  }

  const roleMap = new Map<string, AppRole>();
  (roles || []).forEach((r: any) => {
    roleMap.set(r.user_id, r.role as AppRole);
  });

  const list: UserProfile[] = (profiles || []).map((p: any) => {
    const isMaster = p.email?.toLowerCase() === MASTER_SUPER_ADMIN_EMAIL.toLowerCase();
    return {
      id: p.id,
      email: p.email,
      fullName: isMaster ? 'Master Super Administrator' : (p.full_name || 'Staff User'),
      phoneNumber: p.phone_number || null,
      avatarUrl: p.avatar_url || null,
      isActive: p.is_active ?? true,
      role: isMaster ? 'super_admin' : (roleMap.get(p.id) || 'unauthorized'),
      createdAt: p.created_at,
      updatedAt: p.updated_at || p.created_at,
    };
  });

  // Always ensure Master Super Admin is included at the top of the user list
  const hasMaster = list.some((u) => u.email.toLowerCase() === MASTER_SUPER_ADMIN_EMAIL.toLowerCase());
  if (!hasMaster) {
    list.unshift({
      id: 'master-super-admin',
      email: MASTER_SUPER_ADMIN_EMAIL,
      fullName: 'Master Super Administrator',
      phoneNumber: null,
      avatarUrl: null,
      isActive: true,
      role: 'super_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return list;
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

  let resolvedId = targetUserId;
  if (resolvedId === 'master-super-admin') {
    const { data: p } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', MASTER_SUPER_ADMIN_EMAIL.toLowerCase())
      .maybeSingle();
    if (p?.id) resolvedId = p.id;
  }

  // Delete previous role entries for single active role per user or upsert
  await supabase.from('user_roles').delete().eq('user_id', resolvedId);

  const { error } = await supabase.from('user_roles').insert({
    user_id: resolvedId,
    role: newRole,
    granted_by: admin.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn(`Role grant warning: ${error.message}`);
  }

  // Insert audit trail
  try {
    await supabase.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'GRANT_USER_ROLE',
      entity: 'user_roles',
      entity_id: resolvedId,
      new_state: { role: newRole, userId: resolvedId },
    });
  } catch (e) {
    // Non-blocking audit log
  }

  // Fetch user profile to send welcome email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', resolvedId)
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

  let resolvedId = targetUserId;
  if (resolvedId === 'master-super-admin') {
    const { data: p } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', MASTER_SUPER_ADMIN_EMAIL.toLowerCase())
      .maybeSingle();
    if (p?.id) resolvedId = p.id;
  }

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', resolvedId);

  if (error) {
    throw new Error(`Failed to revoke role: ${error.message}`);
  }

  try {
    await supabase.from('audit_logs').insert({
      actor_id: admin.id,
      action: 'REVOKE_USER_ROLE',
      entity: 'user_roles',
      entity_id: resolvedId,
    });
  } catch (e) {
    // Non-blocking
  }

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

  const cleanEmail = email.trim().toLowerCase();

  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();

  let targetUserId = existing?.id;

  if (!targetUserId) {
    // Insert into profiles
    const { data: newProfile, error: pError } = await supabase
      .from('profiles')
      .insert({
        email: cleanEmail,
        full_name: fullName.trim() || cleanEmail.split('@')[0],
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
  fullName: string = 'Administrator'
) {
  const { sendWelcomeEmail } = await import('@/lib/email/welcomeEmail');
  return await sendWelcomeEmail({
    toEmail: email.trim().toLowerCase(),
    fullName,
    role,
  });
}

/**
 * Master Super Admin Bootstrap:
 * Designates navgirekanta65@gmail.com as the Master Super Administrator automatically.
 */
export async function claimInitialSuperAdmin(): Promise<{ success: boolean; message: string; role?: AppRole }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required. Please sign in to verify Super Admin access.');
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  const isTargetMasterAdmin = userEmail === MASTER_SUPER_ADMIN_EMAIL.toLowerCase();

  // Ensure profiles record exists
  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email!,
    full_name: isTargetMasterAdmin ? 'Master Super Administrator' : (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Super Administrator'),
    is_active: true,
  }, { onConflict: 'id' });

  // If this is the designated Master Super Admin account, grant Super Admin access unconditionally
  if (isTargetMasterAdmin) {
    await supabase.from('user_roles').delete().eq('user_id', user.id);
    const { error: insertError } = await supabase.from('user_roles').insert({
      user_id: user.id,
      role: 'super_admin',
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.warn('Super admin insert notice:', insertError.message);
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin/dashboard');

    return {
      success: true,
      message: `Master Super Administrator access granted to ${MASTER_SUPER_ADMIN_EMAIL}!`,
      role: 'super_admin',
    };
  }

  // For all other users: Check their assigned role in the database (they cannot self-claim Super Admin)
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (userRole?.role && userRole.role !== 'unauthorized') {
    return {
      success: true,
      message: `Your role is verified as ${userRole.role.replace('_', ' ').toUpperCase()}. Redirecting...`,
      role: userRole.role as AppRole,
    };
  }

  return {
    success: false,
    message: `Your account is pending role assignment. Please contact the Master Administrator (${MASTER_SUPER_ADMIN_EMAIL}) to grant your Judge or Staff role.`,
    role: 'unauthorized',
  };
}

/**
 * Check if the system has any active Super Admin configured
 */
export async function getSuperAdminStatus(): Promise<{ hasSuperAdmin: boolean }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'super_admin')
    .limit(1);

  return { hasSuperAdmin: (data?.length || 0) > 0 };
}

/**
 * Reset Database and preserve only navgirekanta65@gmail.com as Master Super Admin
 */
export async function resetDatabaseAndSetMasterAdmin(): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerSupabaseClient();
  
  try {
    // 1. Clear competition data
    await supabase.from('scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('event_state').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('participants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competition_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Remove all user roles except navgirekanta65@gmail.com
    const { data: masterProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', MASTER_SUPER_ADMIN_EMAIL.toLowerCase())
      .maybeSingle();

    if (masterProfile?.id) {
      await supabase.from('user_roles').delete().neq('user_id', masterProfile.id);
      await supabase.from('user_roles').upsert({
        user_id: masterProfile.id,
        role: 'super_admin',
        updated_at: new Date().toISOString(),
      });
    } else {
      await supabase.from('user_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/users');
    revalidatePath('/live');
    revalidatePath('/admin/staging');

    return {
      success: true,
      message: `Database successfully cleared! navgirekanta65@gmail.com is now designated as the Sole Master Super Administrator.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to reset database',
    };
  }
}
