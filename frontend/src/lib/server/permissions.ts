@'
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { ApiError } from '@/lib/server/errors';
import type { FamilyRole } from '@/types/database';

export type FamilyPermission =
  | 'view_family'
  | 'manage_family'
  | 'manage_members'
  | 'manage_records'
  | 'delete_records'
  | 'manage_tasks'
  | 'delete_tasks'
  | 'manage_appointments'
  | 'delete_appointments'
  | 'manage_care_recipients'
  | 'delete_care_recipients'
  | 'manage_prescriptions'
  | 'delete_prescriptions';

const ROLE_PERMISSIONS: Record<FamilyRole, readonly FamilyPermission[]> = {
  ADMIN: [
    'view_family', 'manage_family', 'manage_members',
    'manage_records', 'delete_records',
    'manage_tasks', 'delete_tasks',
    'manage_appointments', 'delete_appointments',
    'manage_care_recipients', 'delete_care_recipients',
    'manage_prescriptions', 'delete_prescriptions',
  ],
  CAREGIVER: [
    'view_family', 'manage_records', 'delete_records',
    'manage_tasks', 'delete_tasks',
    'manage_appointments', 'delete_appointments',
    'manage_care_recipients', 'delete_care_recipients',
    'manage_prescriptions',
  ],
  CONTRIBUTOR: [
    'view_family', 'manage_records',
    'manage_tasks', 'manage_appointments',
    'manage_care_recipients',
  ],
  VIEWER: ['view_family'],
};

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
    console.error('[PERMISSIONS] Membership lookup failed:', error);
    throw new ApiError(
      500,
      'MEMBERSHIP_LOOKUP_FAILED',
      'Unable to verify family membership.',
    );
  }

  if (!data || !['ADMIN', 'CAREGIVER', 'CONTRIBUTOR', 'VIEWER'].includes(String(data.role))) {
    return null;
  }

  return data.role as FamilyRole;
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
    throw new ApiError(403, 'FAMILY_ACCESS_DENIED', 'You do not have access to this family.');
  }

  if (!hasFamilyPermission(role, permission)) {
    throw new ApiError(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to perform this action.');
  }

  return role;
}

export async function assertCareRecipientInFamily(
  familyId: string,
  recipientId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('care_recipients')
    .select('id')
    .eq('id', recipientId)
    .eq('family_id', familyId)
    .maybeSingle();

  if (error) {
    console.error('[PERMISSIONS] Care recipient lookup failed:', error);
    throw new ApiError(500, 'RECIPIENT_LOOKUP_FAILED', 'Unable to verify care recipient.');
  }

  if (!data) {
    throw new ApiError(400, 'INVALID_CARE_RECIPIENT', 'Care recipient does not belong to this family.');
  }
}

export async function assertAssigneeInFamily(
  familyId: string,
  assigneeId: string | null,
): Promise<void> {
  if (!assigneeId) return;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('family_members')
    .select('user_id')
    .eq('family_id', familyId)
    .eq('user_id', assigneeId)
    .maybeSingle();

  if (error) {
    console.error('[PERMISSIONS] Assignee lookup failed:', error);
    throw new ApiError(500, 'ASSIGNEE_LOOKUP_FAILED', 'Unable to verify task assignee.');
  }

  if (!data) {
    throw new ApiError(400, 'INVALID_ASSIGNEE', 'Assignee must be a member of this family.');
  }
}
'@ | Set-Content ".\frontend\src\lib\server\permissions.ts" -Encoding utf8