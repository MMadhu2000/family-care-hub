export type Priority = "high" | "medium" | "low";
export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

export interface Family {
  id: string;
  name: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  fullName: string;
  relationship: string;
  isCareRecipient: boolean;
}

export interface CareRecipient {
  id: string;
  familyId: string;
  fullName: string;
}

export interface CareRecipientRecord {
  id: string;
  familyId: string;
  fullName: string;
  dateOfBirth: string | null;
  notes: string | null;
}

export interface Appointment {
  id: string;
  familyId: string;
  careRecipientName: string;
  title: string;
  provider: string;
  facility: string;
  startsAt: string;
  status: AppointmentStatus;
}

export interface Task {
  id: string;
  familyId: string;
  title: string;
  assigneeName: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
}

export type TaskRecordStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskRecordPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** A task as stored by the tasks API (camelCase). `assignedTo` is an auth user id. */
export interface TaskRecord {
  id: string;
  familyId: string;
  careRecipientId: string;
  title: string;
  description: string | null;
  status: TaskRecordStatus;
  priority: TaskRecordPriority;
  assignedTo: string | null;
  dueAt: string | null;
}

/** A family member that can be picked as a task assignee. `userId` is the auth user id. */
export interface TaskAssigneeOption {
  userId: string;
  label: string;
}

export interface RecipientOption {
  id: string;
  fullName: string;
}

export interface ActivityItem {
  id: string;
  familyId: string;
  actorName: string;
  action: string;
  occurredAt: string;
}

export interface AppNotification {
  id: string;
  familyId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface DashboardSummary {
  totalFamilyMembers: number;
  careRecipients: number;
  upcomingAppointments: number;
  pendingTasks: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  appointments: Appointment[];
  tasks: Task[];
  activity: ActivityItem[];
}

/** Status values accepted by the appointments API. */
export type AppointmentStatusValue = "SCHEDULED" | "COMPLETED" | "CANCELLED";

/**
 * An appointment as stored by the appointments API (camelCase). The list API does not
 * return notes, so this record has no notes field.
 */
export interface AppointmentRecord {
  id: string;
  familyId: string;
  careRecipientId: string;
  title: string;
  providerName: string | null;
  location: string | null;
  scheduledAt: string;
  status: AppointmentStatusValue;
}

/** Status values accepted by the medicine refills API. */
export type RefillStatusValue = "PENDING" | "COMPLETED" | "SKIPPED";

/**
 * A prescription as stored by the prescriptions API (camelCase). Record-keeping only:
 * the fields are stored as entered and carry no clinical interpretation.
 */
export interface PrescriptionRecord {
  id: string;
  familyId: string;
  careRecipientId: string;
  medicationName: string;
  dosage: string | null;
  instructions: string | null;
  prescribedBy: string | null;
  /** YYYY-MM-DD, or null when not set. */
  startDate: string | null;
  /** YYYY-MM-DD, or null when not set. */
  endDate: string | null;
  active: boolean;
}

/** A refill entry for a prescription, as stored by the medicine refills API (camelCase). */
export interface PrescriptionRefillRecord {
  id: string;
  prescriptionId: string;
  dueAt: string;
  completedAt: string | null;
  status: RefillStatusValue;
}

/** Record types accepted by the medical records API. */
export type MedicalRecordType = "LAB_REPORT" | "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "IMAGING" | "OTHER";

/** File types accepted for medical record uploads. */
export type MedicalRecordMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/** A medical record as stored by the medical records API (camelCase). The file path is never exposed. */
export interface MedicalRecordRecord {
  id: string;
  familyId: string;
  careRecipientId: string;
  uploadedBy: string;
  title: string;
  recordType: MedicalRecordType;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}


/** Roles stored on family memberships by the family-members API. */
export type FamilyRole = "ADMIN" | "CAREGIVER" | "CONTRIBUTOR" | "VIEWER";

/** A family membership as returned by the family-members API (camelCase). */
export interface FamilyMemberRecord {
  id: string;
  familyId: string;
  /** Auth user id of the member. */
  userId: string;
  role: FamilyRole;
  createdAt: string;
  displayName: string | null;
  email: string | null;
}

/** The signed-in user's own id and role within the family. */
export interface FamilyCurrentUser {
  id: string;
  role: FamilyRole;
}

/** Roles that can be granted through an invitation. */
export type InvitationRole = "CAREGIVER" | "CONTRIBUTOR" | "VIEWER";

/** A pending invitation as returned by the invitations API (camelCase). The token and URL are never listed. */
export interface InvitationRecord {
  id: string;
  familyId: string;
  email: string;
  role: InvitationRole;
  expiresAt: string;
  createdAt: string;
}

/** A recorded family care event as the timeline API sends it, mapped to camelCase. Recorded events only. */
export interface TimelineEventRecord {
  id: string;
  familyId: string;
  careRecipientId: string | null;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
}


