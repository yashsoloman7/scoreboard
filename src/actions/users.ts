'use server';

// src/actions/users.ts - Super Admin & Admin User Role Management
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { AppRole, UserProfile } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getUsersWithRoles(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  
  const [{ data: profiles, error: pError }, { data: roles, error: rError }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name', { ascending: true }),
    supabase.from('user_roles').select('*'),
  ]);

  if (pError || !profiles) {
    console.error('Error fetching profiles:', pError);
    return [];
  }

  const roleMap = new Map<string, AppRole>();
  (roles || []).forEach((r: any) => {
    roleMap.set(r.user_id, r.role as AppRole);
  });

  return profiles.map((p: any) => ({
    id: p.id,
    email: p.email,
    fullName: p.full_name || 'Staff User',
    phoneNumber: p.phone_number || null,
    avatarUrl: p.avatar_url || null,
    isActive: p.is_active ?? true,
    role: roleMap.get(p.id) || 'unauthorized',
    createdAt: p.created_at,
    updatedAt: p.updated_at || p.created_at,
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

/**
 * Master Super Admin Bootstrap:
 * Allows the initial system administrator / creator to claim the primary Super Admin role
 * if no Super Admin is currently registered in the database, or automatically checks and elevates.
 */
export async function claimInitialSuperAdmin(): Promise<{ success: boolean; message: string; role?: AppRole }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Authentication required. Please sign in to claim Super Admin access.');
  }

  // Check if any active super_admin exists in the system
  const { data: existingSuperAdmins } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'super_admin');

  const count = existingSuperAdmins?.length || 0;

  // Ensure profiles record exists
  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email!,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Super Administrator',
    is_active: true,
  }, { onConflict: 'id' });

  if (count === 0) {
    // Grant primary super_admin role to the first administrator claiming it
    await supabase.from('user_roles').delete().eq('user_id', user.id);
    const { error: insertError } = await supabase.from('user_roles').insert({
      user_id: user.id,
      role: 'super_admin',
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      throw new Error(`Failed to initialize Super Admin role: ${insertError.message}`);
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin/dashboard');

    return {
      success: true,
      message: 'Master Super Administrator access granted! You now have full administrative control.',
      role: 'super_admin',
    };
  }

  // If a Super Admin already exists, check if the current user is that Super Admin
  const isAlreadySuperAdmin = existingSuperAdmins?.some((sa) => sa.user_id === user.id);
  if (isAlreadySuperAdmin) {
    return {
      success: true,
      message: 'You are verified as a Super Administrator.',
      role: 'super_admin',
    };
  }

  // If other Super Admins exist and current user is not one, check their assigned role
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (userRole?.role && userRole.role !== 'unauthorized') {
    return {
      success: true,
      message: `Your role is verified as ${userRole.role.replace('_', ' ').toUpperCase()}.`,
      role: userRole.role as AppRole,
    };
  }

  return {
    success: false,
    message: 'A Super Administrator is already registered. Please request role assignment from your Master Admin.',
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

