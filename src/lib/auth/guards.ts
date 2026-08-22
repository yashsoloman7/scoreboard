// src/lib/auth/guards.ts - Server-side security and authorization guards

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AppRole, UserProfile } from '@/types';
import { Permissions, hasMinimumRole } from './roles';
import { MASTER_SUPER_ADMIN_EMAIL } from '@/lib/constants';

export class AuthorizationError extends Error {
  constructor(message = 'Access Denied: Insufficient Permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication Required: Please sign in') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Retrieves current authenticated user profile and active role from Supabase
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Fetch profile and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone_number, avatar_url, is_active')
    .eq('id', user.id)
    .maybeSingle();

  let activeProfile = profile;

  // Ensure a profiles row exists to satisfy foreign key constraints
  if (!activeProfile && user.id) {
    try {
      const { data: createdProfile } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || 'Admin User',
          is_active: true,
        }, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (createdProfile) {
        activeProfile = createdProfile;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  const userEmail = (user.email || activeProfile?.email || '').toLowerCase().trim();
  const isMasterAdmin = userEmail === MASTER_SUPER_ADMIN_EMAIL.toLowerCase();

  const { data: userRoleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const role: AppRole =
    isMasterAdmin
      ? 'super_admin'
      : (userRoleData?.role as AppRole) ||
        (user.app_metadata?.role as AppRole) ||
        (user.user_metadata?.role as AppRole) ||
        'unauthorized';

  return {
    id: user.id,
    email: user.email || activeProfile?.email || '',
    fullName: isMasterAdmin ? 'Master Super Administrator' : (activeProfile?.full_name || user.user_metadata?.full_name || 'User'),
    phoneNumber: activeProfile?.phone_number || null,
    avatarUrl: activeProfile?.avatar_url || user.user_metadata?.avatar_url || null,
    isActive: activeProfile?.is_active ?? true,
    role,
    createdAt: user.created_at,
    updatedAt: user.updated_at || user.created_at,
  };
}

/**
 * Asserts the caller is authenticated; throws AuthenticationError if not
 */
export async function requireAuth(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    throw new AuthenticationError();
  }
  return user;
}

/**
 * Asserts the caller has at least the required role
 */
export async function requireRole(requiredRole: AppRole): Promise<UserProfile> {
  const user = await requireAuth();
  if (!hasMinimumRole(user.role, requiredRole)) {
    throw new AuthorizationError(`Role '${requiredRole}' or higher is required.`);
  }
  return user;
}

/**
 * Asserts the caller has a specific permission
 */
export async function requirePermission(
  permissionCheck: (role: AppRole) => boolean,
  errorMessage = 'Unauthorized action'
): Promise<UserProfile> {
  const user = await requireAuth();
  if (!permissionCheck(user.role)) {
    throw new AuthorizationError(errorMessage);
  }
  return user;
}

/**
 * Verifies if the judge is assigned to the specified category
 */
export async function verifyJudgeAssignment(judgeId: string, categoryId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('judge_assignments')
    .select('id')
    .eq('judge_id', judgeId)
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .single();

  return !!data;
}
