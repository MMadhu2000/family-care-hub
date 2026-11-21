// PROVISIONAL APPLICATION TYPES.
// These are not generated Supabase database types. Reconcile them with Batch 3 migrations.

export type FamilyRole = 'ADMIN' | 'CAREGIVER' | 'CONTRIBUTOR' | 'VIEWER';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type MedicalRecordType =
  | 'LAB_REPORT'
  | 'PRESCRIPTION'
  | 'DISCHARGE_SUMMARY'
  | 'IMAGING'
  | 'OTHER';
export type NotificationStatus = 'UNREAD' | 'READ';

export interface Family {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  created_at?: string;
}

export interface CareRecipient {
  id: string;
  family_id: string;
  full_name: string;
  date_of_birth?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MedicalRecord {
  id: string;
  family_id: string;
  care_recipient_id: string;
  uploaded_by: string;
  title: string;
  record_type: MedicalRecordType;
  file_path: string;
  file_name?: string;
  mime_type?: string;
  notes?: string | null;
  created_at: string;
}

export interface CareTask {
  id: string;
  family_id: string;
  care_recipient_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: string | null;
  due_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface Appointment {
  id: string;
  family_id: string;
  care_recipient_id: string;
  title: string;
  provider_name?: string | null;
  location?: string | null;
  scheduled_at: string;
  status: AppointmentStatus;
  notes?: string | null;
  created_at: string;
}

export interface Prescription {
  id: string;
  family_id: string;
  care_recipient_id: string;
  medication_name: string;
  dosage?: string | null;
  instructions?: string | null;
  prescribed_by?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
  created_at: string;
}

export interface MedicineRefill {
  id: string;
  prescription_id: string;
  due_at: string;
  completed_at?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
}

export interface Notification {
  id: string;
  family_id: string;
  user_id: string;
  title: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
  read_at?: string | null;
}

export interface TimelineEvent {
  id: string;
  family_id: string;
  care_recipient_id?: string | null;
  event_type: string;
  title: string;
  description?: string | null;
  occurred_at: string;
  created_by?: string | null;
}

export interface ActivityLog {
  id: string;
  family_id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  created_at: string;
}