import { describe, it, expect } from 'vitest';
import { AppRole } from '@/types';

function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  const roleHierarchy: Record<AppRole, number> = {
    super_admin: 5,
    admin: 4,
    event_manager: 3,
    event_operator: 2,
    judge: 1,
    public_viewer: 0,
    unauthorized: -1,
  };

  const userLevel = roleHierarchy[userRole] ?? -1;
  const requiredLevel = roleHierarchy[requiredRole] ?? 99;

  return userLevel >= requiredLevel;
}

function getNavigationForRole(role: AppRole): string[] {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return ['/live', '/judge', '/admin/staging', '/admin/control-room', '/admin/import', '/admin/users', '/admin/dashboard'];
    case 'event_manager':
      return ['/live', '/admin/staging', '/admin/import'];
    case 'event_operator':
      return ['/live', '/admin/control-room', '/admin/staging'];
    case 'judge':
      return ['/live', '/judge'];
    case 'public_viewer':
    case 'unauthorized':
    default:
      return ['/live'];
  }
}

describe('Role Authorization & Page Segregation Matrix', () => {
  it('enforces role hierarchy accurately for super_admin and admin', () => {
    expect(hasMinimumRole('super_admin', 'admin')).toBe(true);
    expect(hasMinimumRole('super_admin', 'event_manager')).toBe(true);
    expect(hasMinimumRole('admin', 'super_admin')).toBe(false);
    expect(hasMinimumRole('admin', 'judge')).toBe(true);
    expect(hasMinimumRole('judge', 'admin')).toBe(false);
    expect(hasMinimumRole('unauthorized', 'judge')).toBe(false);
  });

  it('delivers tailored navigation items exclusively per role', () => {
    const superAdminNav = getNavigationForRole('super_admin');
    expect(superAdminNav).toContain('/admin/users');
    expect(superAdminNav).toContain('/admin/dashboard');

    const judgeNav = getNavigationForRole('judge');
    expect(judgeNav).toContain('/judge');
    expect(judgeNav).not.toContain('/admin/dashboard');
    expect(judgeNav).not.toContain('/admin/users');

    const stageManagerNav = getNavigationForRole('event_manager');
    expect(stageManagerNav).toContain('/admin/staging');
    expect(stageManagerNav).toContain('/admin/import');
    expect(stageManagerNav).not.toContain('/admin/users');
    expect(stageManagerNav).not.toContain('/admin/dashboard');

    const controlRoomNav = getNavigationForRole('event_operator');
    expect(controlRoomNav).toContain('/admin/control-room');
    expect(controlRoomNav).not.toContain('/admin/users');
  });
});
