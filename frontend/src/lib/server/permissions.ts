import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import type { FamilyRole } from '@/types/database';

export type FamilyPermission =
  | 'view_family'
  | 'manage_family'
  | 'manage_members'
  | 'manage_records'
  | 'manage_tasks'
  | 'manage_appointments'
  | 'manage_prescriptions';

const ROLE_PERMISSIONS: Record<FamilyRole, readonly FamilyPermission[]> = {
  ADMIN: [
    'view_family',
    'manage_family',
    'manage_members',
    'manage_records',
    'manage_tasks',
    'manage_appointments',
    'manage_prescriptions',
  ],
  CAREGIVER: [
    'view_family',
    'manage_records',
    'manage_tasks',
    'manage_appointments',
    'manage_prescriptions',
  ],
  CONTRIBUTOR: [
    'view_family',
    'manage_records',
    'manage_tasks',
    'manage_appointments',
    'manage_prescriptions',
  ],
  VIEWER: ['view_family'],
};

const VALID_ROLES: readonly string[] = [
  'ADMIN',
  'CAREGIVER',
  'CONTRIBUTOR',
  'VIEWER',
];

export function hasFamilyPermission(
  role: FamilyRole,
  permission: FamilyPermission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export async function getCurrentUserFamilyRole(
  familyId: string,
): Promise<FamilyRole | null> {
  if (!familyId.trim()) {
    throw new ApiError(400, 'INVALID_FAMILY_ID', 'A valid family ID is required.');
  }

  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('family_members')
    .select('role')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new ApiError(
      500,
      'MEMBERSHIP_LOOKUP_FAILED',
      'Unable to verify family membership.',
    );
  }

  if (!data || !VALID_ROLES.includes(String(data.role).toUpperCase())) {
    return null;
  }

  return String(data.role).toUpperCase() as FamilyRole;
}

export async function userHasFamilyPermission(
  familyId: string,
  permission: FamilyPermission,
): Promise<boolean> {
  const role = await getCurrentUserFamilyRole(familyId);

  return role ? hasFamilyPermission(role, permission) : false;
}

export async function requireFamilyPermission(
  familyId: string,
  permission: FamilyPermission,
): Promise<FamilyRole> {
  const role = await getCurrentUserFamilyRole(familyId);

  if (!role) {
    throw new ApiError(
      403,
      'FAMILY_ACCESS_DENIED',
      'You do not have access to this family.',
    );
  }

  if (!hasFamilyPermission(role, permission)) {
    throw new ApiError(
      403,
      'INSUFFICIENT_PERMISSIONS',
      'You do not have permission to perform this action.',
    );
  }

  return role;
}