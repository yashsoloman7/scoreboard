// src/lib/auth/roles.ts - Granular Role-Based Access Control and Permission Predicates

import { AppRole } from '@/types';

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 100,
  admin: 80,
  event_operator: 50,
  judge: 30,
  unauthorized: 0,
};

export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

export const Permissions = {
  canManageUsers: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canAuthorizeJudges: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canManageCompetitions: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canManageCategoriesAndCriteria: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canImportParticipants: (role: AppRole) => ['super_admin', 'admin', 'event_operator'].includes(role),
  canControlLiveTimer: (role: AppRole) => ['super_admin', 'admin', 'event_operator'].includes(role),
  canAdvancePerformances: (role: AppRole) => ['super_admin', 'admin', 'event_operator'].includes(role),
  canScoreCategory: (role: AppRole) => ['judge', 'super_admin', 'admin'].includes(role),
  canReopenScores: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canViewUnmaskedScores: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canCalculateResults: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canApproveAndPublishResults: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canOverrideAwards: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canManageBackups: (role: AppRole) => ['super_admin', 'admin'].includes(role),
  canAccessPracticeMode: (role: AppRole) => ['super_admin', 'admin', 'event_operator', 'judge'].includes(role),
};
