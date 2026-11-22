/**
 * Query layer for the dashboard. Every read calls the authenticated /api routes and throws when a
 * request fails. This file never falls back to mock data.
 */

import type {
  ActivityItem,
  Appointment,
  AppointmentRecord,
  AppointmentStatus,
  AppointmentStatusValue,
  AppNotification,
  CareRecipient,
  CareRecipientRecord,
  DashboardData,
  DashboardSummary,
  Family,
  FamilyCurrentUser,
  FamilyMember,
  FamilyMemberRecord,
  FamilyRole,
  InvitationRecord,
  InvitationRole,
  MedicalRecordMimeType,
  MedicalRecordRecord,
  MedicalRecordType,
  PrescriptionRecord,
  PrescriptionRefillRecord,
  Priority,
  RefillStatusValue,
  Task,
  TaskAssigneeOption,
  TaskRecord,
  TaskRecordPriority,
  TaskRecordStatus,
  TimelineEventRecord,
} from "./types";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<FamilyRole, string> = {
  ADMIN: "Administrator",
  CAREGIVER: "Caregiver",
  CONTRIBUTOR: "Contributor",
  VIEWER: "Viewer",
};

const APPOINTMENT_STATUS_MAP: Record<AppointmentStatusValue, AppointmentStatus> = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const TASK_PRIORITY_MAP: Record<TaskRecordPriority, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "high",
};

const DASHBOARD_ACTIVITY_LIMIT = 6;

export async function fetchFamilies(): Promise<Family[]> {
  const rows = await fetchAllPages<{ id: string; name: string }>(
    "/api/families?",
    "We couldn't load your families.",
  );
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function loadMembers(familyId: string): Promise<FamilyMemberRecord[]> {
  const view = await fetchFamilyMembersView(familyId);
  return view.members;
}

async function loadRecipients(familyId: string): Promise<CareRecipientRecord[]> {
  return listForFamily<CareRecipientRecord>("/api/care-recipients", familyId, "We couldn't load care recipients.");
}

async function loadAppointmentRows(familyId: string): Promise<AppointmentRecord[]> {
  return listForFamily<AppointmentRecord>("/api/appointments", familyId, "We couldn't load appointments.");
}

async function loadTaskRows(familyId: string): Promise<TaskRecord[]> {
  return listForFamily<TaskRecord>("/api/tasks", familyId, "We couldn't load tasks.");
}

async function loadTimelineRows(familyId: string): Promise<TimelineEventRow[]> {
  return listForFamily<TimelineEventRow>("/api/timeline", familyId, "We couldn't load the timeline.");
}

/** Display name for a user id. Falls back to the generic label when no member matches. */
function memberLabel(members: FamilyMemberRecord[], userId: string): string {
  const member = members.find((candidate) => candidate.userId === userId);
  return member ? (member.displayName ?? member.email ?? DEFAULT_MEMBER_LABEL) : DEFAULT_MEMBER_LABEL;
}

/** YYYY-MM-DD for an ISO timestamp, or "" when there is no due date. */
function toDateOnly(timestamp: string | null): string {
  if (timestamp === null) {
    return "";
  }
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function mapAppointmentRows(rows: AppointmentRecord[], recipients: CareRecipientRecord[]): Appointment[] {
  const recipientNames = new Map(recipients.map((recipient) => [recipient.id, recipient.fullName] as const));
  return rows
    .map((row) => ({
      id: row.id,
      familyId: row.familyId,
      careRecipientName: recipientNames.get(row.careRecipientId) ?? "Care recipient",
      title: row.title,
      provider: row.providerName ?? "",
      facility: row.location ?? "",
      startsAt: row.scheduledAt,
      status: APPOINTMENT_STATUS_MAP[row.status],
    }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Open tasks first; within each group, earliest due date first, with undated tasks last. Cancelled tasks are excluded. */
function mapTaskRows(rows: TaskRecord[], members: FamilyMemberRecord[]): Task[] {
  return rows
    .filter((row) => row.status !== "CANCELLED")
    .map((row) => ({
      id: row.id,
      familyId: row.familyId,
      title: row.title,
      assigneeName: row.assignedTo === null ? "Unassigned" : memberLabel(members, row.assignedTo),
      dueDate: toDateOnly(row.dueAt),
      priority: TASK_PRIORITY_MAP[row.priority],
      completed: row.status === "COMPLETED",
    }))
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.dueDate === b.dueDate) {
        return 0;
      }
      if (a.dueDate === "") {
        return 1;
      }
      if (b.dueDate === "") {
        return -1;
      }
      return a.dueDate < b.dueDate ? -1 : 1;
    });
}

/** Newest first. */
function mapActivityRows(rows: TimelineEventRow[], members: FamilyMemberRecord[]): ActivityItem[] {
  return rows
    .map((row) => ({
      id: row.id,
      familyId: row.family_id,
      actorName: memberLabel(members, row.created_by),
      action: row.description ? `${row.title} \u2014 ${row.description}` : row.title,
      occurredAt: row.occurred_at,
    }))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const members = await loadMembers(familyId);
  return members.map((member) => ({
    id: member.id,
    familyId: member.familyId,
    fullName: member.displayName ?? member.email ?? DEFAULT_MEMBER_LABEL,
    relationship: ROLE_LABELS[member.role],
    // No link between family members and care recipients exists yet.
    isCareRecipient: false,
  }));
}

export async function fetchCareRecipients(familyId: string): Promise<CareRecipient[]> {
  const rows = await loadRecipients(familyId);
  return rows.map((row) => ({ id: row.id, familyId: row.familyId, fullName: row.fullName }));
}

export async function fetchAppointments(familyId: string): Promise<Appointment[]> {
  const [recipients, rows] = await Promise.all([loadRecipients(familyId), loadAppointmentRows(familyId)]);
  return mapAppointmentRows(rows, recipients);
}

export async function fetchTasks(familyId: string): Promise<Task[]> {
  const [members, rows] = await Promise.all([loadMembers(familyId), loadTaskRows(familyId)]);
  return mapTaskRows(rows, members);
}

export async function fetchActivity(familyId: string): Promise<ActivityItem[]> {
  const [members, rows] = await Promise.all([loadMembers(familyId), loadTimelineRows(familyId)]);
  return mapActivityRows(rows, members);
}

/** A notification row as the notifications table returns it (snake_case). */
interface NotificationRow {
  id: string;
  family_id: string;
  title: string;
  message: string;
  status: "UNREAD" | "READ";
  created_at: string;
}

const NOTIFICATION_LIMIT = 100;

/**
 * The signed-in user's notifications for a family, newest first. Row-level security on the
 * notifications table limits the rows to the current user's own notifications.
 */
export async function fetchNotifications(familyId: string): Promise<AppNotification[]> {
  const { data, error } = await createClient()
    .from("notifications")
    .select("id, family_id, title, message, status, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_LIMIT);
  if (error) {
    throw new Error("We couldn't load notifications.");
  }
  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    body: row.message,
    createdAt: row.created_at,
    read: row.status === "READ",
  }));
}

/** Marks one of the signed-in user's notifications as read. RLS allows the update only on the user's own rows. */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await createClient()
    .from("notifications")
    .update({ status: "READ", read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    throw new Error("We couldn't update the notification.");
  }
}

export async function fetchDashboardData(familyId: string): Promise<DashboardData> {
  const [members, recipients, appointmentRows, taskRows, timelineRows] = await Promise.all([
    loadMembers(familyId),
    loadRecipients(familyId),
    loadAppointmentRows(familyId),
    loadTaskRows(familyId),
    loadTimelineRows(familyId),
  ]);

  const now = Date.now();
  const upcomingRows = appointmentRows.filter(
    (row) => row.status === "SCHEDULED" && Date.parse(row.scheduledAt) >= now,
  );
  const appointments = mapAppointmentRows(upcomingRows, recipients);
  const tasks = mapTaskRows(taskRows, members).filter((task) => !task.completed);
  const activity = mapActivityRows(timelineRows, members).slice(0, DASHBOARD_ACTIVITY_LIMIT);

  const summary: DashboardSummary = {
    totalFamilyMembers: members.length,
    careRecipients: recipients.length,
    upcomingAppointments: appointments.length,
    pendingTasks: tasks.length,
  };

  return { summary, appointments, tasks, activity };
}


export const dashboardKeys = {
  families: ["families"] as const,
  dashboard: (familyId: string) => ["dashboard", familyId] as const,
  members: (familyId: string) => ["members", familyId] as const,
  recipients: (familyId: string) => ["recipients", familyId] as const,
  appointments: (familyId: string) => ["appointments", familyId] as const,
  tasks: (familyId: string) => ["tasks", familyId] as const,
  activity: (familyId: string) => ["activity", familyId] as const,
  notifications: (familyId: string) => ["notifications", familyId] as const,
  appointmentRecords: (familyId: string) => ["appointment-records", familyId] as const,
  recipientRecords: (familyId: string) => ["recipient-records", familyId] as const,
  medicalRecordRecords: (familyId: string) => ["medical-record-records", familyId] as const,
  prescriptionRecords: (familyId: string) => ["prescription-records", familyId] as const,
  refillRecords: (prescriptionId: string) => ["refill-records", prescriptionId] as const,
  taskRecords: (familyId: string) => ["task-records", familyId] as const,
  memberOptions: (familyId: string) => ["member-options", familyId] as const,
  familyMembersView: (familyId: string) => ["family-members-view", familyId] as const,
  invitationRecords: (familyId: string) => ["invitation-records", familyId] as const,
  timelineEvents: (familyId: string) => ["timeline-events", familyId] as const,
};

// ---------------------------------------------------------------------------
// API access. Family-scoped reads carry family_id; PATCH and DELETE address a record by id.
// Error messages are fixed here, so no raw database or server text reaches the UI.
// ---------------------------------------------------------------------------

const JSON_ACCEPT_HEADERS: Record<string, string> = { Accept: "application/json" };
const DEFAULT_MEMBER_LABEL = "Family member";
const MEDICAL_DOCUMENT_UPLOAD_PATH = "/api/medical-records/upload";

export const MEDICAL_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const MEDICAL_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** A paginated list response: the pagination fields are not used here. */
interface ListPayload<T> {
  items: T[];
}

const PAGE_SIZE = 100;
const MAX_LIST_PAGES = 50;

export interface CreateAppointmentInput {
  familyId: string;
  careRecipientId: string;
  title: string;
  providerName: string | null;
  location: string | null;
  scheduledAt: string;
  status: AppointmentStatusValue;
  notes: string | null;
}

export interface UpdateAppointmentInput {
  careRecipientId?: string;
  title?: string;
  providerName?: string | null;
  location?: string | null;
  scheduledAt?: string;
  status?: AppointmentStatusValue;
  notes?: string | null;
}

export interface CreateCareRecipientInput {
  familyId: string;
  fullName: string;
  dateOfBirth: string | null;
  notes: string | null;
}

export interface UpdateCareRecipientInput {
  fullName?: string;
  dateOfBirth?: string | null;
  notes?: string | null;
}

export interface CreateMedicalRecordInput {
  familyId: string;
  careRecipientId: string;
  title: string;
  recordType: MedicalRecordType;
  filePath: string;
  fileName: string | null;
  mimeType: MedicalRecordMimeType;
  fileSizeBytes: number;
  notes: string;
}

export interface CreatePrescriptionInput {
  familyId: string;
  careRecipientId: string;
  medicationName: string;
  dosage: string | null;
  instructions: string | null;
  prescribedBy: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

export interface UpdatePrescriptionInput {
  careRecipientId?: string;
  medicationName?: string;
  dosage?: string | null;
  instructions?: string | null;
  prescribedBy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
}

export interface CreateRefillInput {
  prescriptionId: string;
  /** ISO 8601 timestamp. */
  dueAt: string;
}

export interface CreateTaskInput {
  familyId: string;
  careRecipientId: string;
  title: string;
  description: string | null;
  priority: TaskRecordPriority;
  assignedTo: string | null;
  /** ISO 8601 timestamp, or null when no due date is set. */
  dueAt: string | null;
}

export interface UpdateTaskInput {
  careRecipientId?: string;
  title?: string;
  description?: string | null;
  status?: TaskRecordStatus;
  priority?: TaskRecordPriority;
  assignedTo?: string | null;
  dueAt?: string | null;
}

/** Members of a family plus the signed-in user's own id and role. */
export interface FamilyMembersView {
  members: FamilyMemberRecord[];
  currentUser: FamilyCurrentUser;
}

export interface CreateInvitationInput {
  familyId: string;
  email: string;
  role: InvitationRole;
}

export interface CreateInvitationResult {
  invitation: InvitationRecord;
  invitationUrl: string;
}

/** A family member as the family-members API sends it (snake_case, as the route selects it). */
interface FamilyMemberWire {
  id: string;
  user_id: string;
  role: FamilyRole;
  created_at: string;
  display_name: string | null;
  email: string | null;
}

interface FamilyMembersWire {
  members: FamilyMemberWire[];
  currentUser: FamilyCurrentUser;
}

/** Reads `data` from a successful response. Any other response becomes the fixed fallback message. */
async function readData<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(fallback);
  }
  let body: { data?: T };
  try {
    body = (await response.json()) as { data?: T };
  } catch {
    throw new Error(fallback);
  }
  if (body.data === undefined) {
    throw new Error(fallback);
  }
  return body.data;
}

async function apiGet<T>(path: string, fallback: string): Promise<T> {
  const response = await fetch(path, { method: "GET", headers: JSON_ACCEPT_HEADERS, cache: "no-store" });
  return readData<T>(response, fallback);
}

async function sendJson<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  fallback: string,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { ...JSON_ACCEPT_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return readData<T>(response, fallback);
}

async function sendDelete(path: string, fallback: string): Promise<void> {
  const response = await fetch(path, { method: "DELETE", headers: JSON_ACCEPT_HEADERS, cache: "no-store" });
  if (!response.ok) {
    throw new Error(fallback);
  }
}

async function listItems<T>(path: string, fallback: string): Promise<T[]> {
  const payload = await apiGet<ListPayload<T>>(path, fallback);
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error(fallback);
  }
  return payload.items;
}

/** Reads every page of a paginated list, in page order, one request at a time. Throws instead of returning a partial list. basePath must already contain a query string, e.g. "/api/tasks?family_id=...". */
async function fetchAllPages<T>(basePath: string, fallback: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const payload = await apiGet<PagedPayload<T>>(`${basePath}&page=${page}&pageSize=${PAGE_SIZE}`, fallback);
    if (!payload || !Array.isArray(payload.items) || typeof payload.totalPages !== "number") {
      throw new Error(fallback);
    }
    items.push(...payload.items);
    if (page >= payload.totalPages) {
      return items;
    }
  }
  throw new Error(fallback);
}

function listForFamily<T>(path: string, familyId: string, fallback: string): Promise<T[]> {
  return fetchAllPages<T>(`${path}?family_id=${encodeURIComponent(familyId)}`, fallback);
}

export async function fetchAppointmentRecords(familyId: string): Promise<AppointmentRecord[]> {
  return listForFamily<AppointmentRecord>("/api/appointments", familyId, "We couldn't load appointments.");
}

export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord> {
  return sendJson<AppointmentRecord>("POST", "/api/appointments", input, "We couldn't save the appointment.");
}

export async function updateAppointment(id: string, input: UpdateAppointmentInput): Promise<AppointmentRecord> {
  return sendJson<AppointmentRecord>(
    "PATCH",
    `/api/appointments/${encodeURIComponent(id)}`,
    input,
    "We couldn't update the appointment.",
  );
}

export async function deleteAppointment(id: string): Promise<void> {
  await sendDelete(`/api/appointments/${encodeURIComponent(id)}`, "We couldn't delete the appointment.");
}

export async function fetchCareRecipientRecords(familyId: string): Promise<CareRecipientRecord[]> {
  return listForFamily<CareRecipientRecord>(
    "/api/care-recipients",
    familyId,
    "We couldn't load care recipients.",
  );
}

export async function createCareRecipient(input: CreateCareRecipientInput): Promise<CareRecipientRecord> {
  return sendJson<CareRecipientRecord>(
    "POST",
    "/api/care-recipients",
    input,
    "We couldn't save the care recipient.",
  );
}

export async function updateCareRecipient(
  id: string,
  input: UpdateCareRecipientInput,
): Promise<CareRecipientRecord> {
  return sendJson<CareRecipientRecord>(
    "PATCH",
    `/api/care-recipients/${encodeURIComponent(id)}`,
    input,
    "We couldn't update the care recipient.",
  );
}

export async function deleteCareRecipient(id: string): Promise<void> {
  await sendDelete(
    `/api/care-recipients/${encodeURIComponent(id)}`,
    "We couldn't delete the care recipient.",
  );
}

export async function fetchMedicalRecordRecords(familyId: string): Promise<MedicalRecordRecord[]> {
  return listForFamily<MedicalRecordRecord>(
    "/api/medical-records",
    familyId,
    "We couldn't load medical records.",
  );
}

/**
 * Sends the file to private storage and returns the stored path. The path is passed on to
 * createMedicalRecord and is never shown to the user.
 */
export async function uploadMedicalDocument(
  familyId: string,
  careRecipientId: string,
  file: File,
): Promise<string> {
  const form = new FormData();
  form.append("family_id", familyId);
  form.append("care_recipient_id", careRecipientId);
  form.append("file", file);
  const response = await fetch(MEDICAL_DOCUMENT_UPLOAD_PATH, { method: "POST", body: form, cache: "no-store" });
  const payload = await readData<{ filePath: string }>(response, "We couldn't upload the file.");
  if (!payload || typeof payload.filePath !== "string") {
    throw new Error("We couldn't upload the file.");
  }
  return payload.filePath;
}

export async function createMedicalRecord(input: CreateMedicalRecordInput): Promise<MedicalRecordRecord> {
  return sendJson<MedicalRecordRecord>(
    "POST",
    "/api/medical-records",
    input,
    "We couldn't save the medical record.",
  );
}

/** Returns a short-lived signed URL for viewing or downloading a record's file. */
export async function getMedicalRecordSignedUrl(id: string, mode: "view" | "download"): Promise<string> {
  const payload = await apiGet<{ url: string }>(
    `/api/medical-records/${encodeURIComponent(id)}/signed-url?mode=${mode}`,
    "We couldn't open this document.",
  );
  if (!payload || typeof payload.url !== "string") {
    throw new Error("We couldn't open this document.");
  }
  return payload.url;
}

/** Family-scoped delete: the record is removed only when it belongs to the given family. */
export async function deleteMedicalRecord(id: string, familyId: string): Promise<void> {
  await sendDelete(
    `/api/medical-records/${encodeURIComponent(id)}?family_id=${encodeURIComponent(familyId)}`,
    "We couldn't delete the medical record.",
  );
}

export async function fetchPrescriptionRecords(familyId: string): Promise<PrescriptionRecord[]> {
  return listForFamily<PrescriptionRecord>("/api/prescriptions", familyId, "We couldn't load prescriptions.");
}

export async function createPrescription(input: CreatePrescriptionInput): Promise<PrescriptionRecord> {
  return sendJson<PrescriptionRecord>(
    "POST",
    "/api/prescriptions",
    input,
    "We couldn't save the prescription.",
  );
}

export async function updatePrescription(
  id: string,
  input: UpdatePrescriptionInput,
): Promise<PrescriptionRecord> {
  return sendJson<PrescriptionRecord>(
    "PATCH",
    `/api/prescriptions/${encodeURIComponent(id)}`,
    input,
    "We couldn't update the prescription.",
  );
}

export async function deletePrescription(id: string): Promise<void> {
  await sendDelete(`/api/prescriptions/${encodeURIComponent(id)}`, "We couldn't delete the prescription.");
}

export async function fetchRefillRecords(prescriptionId: string): Promise<PrescriptionRefillRecord[]> {
  return fetchAllPages<PrescriptionRefillRecord>(
    `/api/medicine-refills?prescription_id=${encodeURIComponent(prescriptionId)}`,
    "We couldn't load refills.",
  );
}

export async function createRefill(input: CreateRefillInput): Promise<PrescriptionRefillRecord> {
  return sendJson<PrescriptionRefillRecord>("POST", "/api/medicine-refills", input, "We couldn't save the refill.");
}

export async function updateRefillStatus(id: string, status: RefillStatusValue): Promise<PrescriptionRefillRecord> {
  return sendJson<PrescriptionRefillRecord>(
    "PATCH",
    `/api/medicine-refills/${encodeURIComponent(id)}`,
    { status },
    "We couldn't update the refill.",
  );
}

export async function deleteRefill(id: string): Promise<void> {
  await sendDelete(`/api/medicine-refills/${encodeURIComponent(id)}`, "We couldn't delete the refill.");
}

export async function fetchTaskRecords(familyId: string): Promise<TaskRecord[]> {
  return listForFamily<TaskRecord>("/api/tasks", familyId, "We couldn't load tasks.");
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  return sendJson<TaskRecord>("POST", "/api/tasks", input, "We couldn't save the task.");
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskRecord> {
  return sendJson<TaskRecord>("PATCH", `/api/tasks/${encodeURIComponent(id)}`, input, "We couldn't update the task.");
}

export async function deleteTask(id: string): Promise<void> {
  await sendDelete(`/api/tasks/${encodeURIComponent(id)}`, "We couldn't delete the task.");
}

export async function createFamily(name: string): Promise<Family> {
  return sendJson<Family>("POST", "/api/families", { name }, "We couldn't create the family.");
}

export async function fetchFamilyMembersView(familyId: string): Promise<FamilyMembersView> {
  const fallback = "We couldn't load family members.";
  const payload = await apiGet<FamilyMembersWire>(
    `/api/family-members?family_id=${encodeURIComponent(familyId)}`,
    fallback,
  );
  if (!payload || !Array.isArray(payload.members) || !payload.currentUser) {
    throw new Error(fallback);
  }
  return {
    members: payload.members.map((member) => ({
      id: member.id,
      familyId,
      userId: member.user_id,
      role: member.role,
      createdAt: member.created_at,
      displayName: member.display_name,
      email: member.email,
    })),
    currentUser: { id: payload.currentUser.id, role: payload.currentUser.role },
  };
}

/** Family members as task assignee choices. Each option uses the auth user id. */
export async function fetchFamilyMemberOptions(familyId: string): Promise<TaskAssigneeOption[]> {
  const view = await fetchFamilyMembersView(familyId);
  return view.members.map((member) => ({
    userId: member.userId,
    label: member.displayName ?? member.email ?? DEFAULT_MEMBER_LABEL,
  }));
}

export async function changeFamilyMemberRole(memberId: string, role: FamilyRole): Promise<void> {
  await sendJson<unknown>(
    "PATCH",
    `/api/family-members/${encodeURIComponent(memberId)}`,
    { role },
    "We couldn't change this member's role.",
  );
}

export async function removeFamilyMember(memberId: string): Promise<void> {
  await sendDelete(
    `/api/family-members/${encodeURIComponent(memberId)}`,
    "We couldn't remove this family member.",
  );
}

export async function fetchInvitationRecords(familyId: string): Promise<InvitationRecord[]> {
  return listItems<InvitationRecord>(
    `/api/invitations?family_id=${encodeURIComponent(familyId)}`,
    "We couldn't load invitations.",
  );
}

export async function createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  return sendJson<CreateInvitationResult>(
    "POST",
    "/api/invitations",
    { family_id: input.familyId, email: input.email, role: input.role },
    "We couldn't create the invitation.",
  );
}

export async function revokeInvitation(id: string): Promise<void> {
  await sendDelete(`/api/invitations/${encodeURIComponent(id)}`, "We couldn't revoke the invitation.");
}

// ---------------------------------------------------------------------------
// Timeline (read-only). The API returns pages; every page is read so the list is complete.
// ---------------------------------------------------------------------------


/** A timeline event as the timeline API sends it (snake_case). */
interface TimelineEventRow {
  id: string;
  family_id: string;
  care_recipient_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string;
  created_by: string;
  created_at: string;
}

/** One page of a paginated list response. */
interface PagedPayload<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function toTimelineEventRecord(row: TimelineEventRow): TimelineEventRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    careRecipientId: row.care_recipient_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    occurredAt: row.occurred_at,
  };
}


/** Recorded care events for a family, in the order the server returns them (newest first). */
export async function fetchTimelineEventRecords(familyId: string): Promise<TimelineEventRecord[]> {
  const rows = await fetchAllPages<TimelineEventRow>(
    `/api/timeline?family_id=${encodeURIComponent(familyId)}`,
    "We couldn't load the timeline.",
  );
  return rows.map(toTimelineEventRecord);
}
