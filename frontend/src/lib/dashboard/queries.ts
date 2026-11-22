/**
 * Query layer for the dashboard. Every read goes through the authenticated /api routes.
 * Nothing here falls back to mock data: a failed request throws and the UI shows an error.
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
  Priority,
  PrescriptionRecord,
  PrescriptionRefillRecord,
  RefillStatusValue,
  Task,
  TaskAssigneeOption,
  TaskRecord,
  TaskRecordPriority,
  TaskRecordStatus,
} from "./types";
import { createClient } from "@/lib/supabase/client";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const ACTIVITY_LIMIT = 6;
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_ERROR_MESSAGE = "Could not reach the server. Check your connection and try again.";
const UNKNOWN_MEMBER_NAME = "Family member";
const UNKNOWN_RECIPIENT_NAME = "Care recipient";
const UNASSIGNED_NAME = "Unassigned";

// Rows as returned by the /api routes (snake_case).
interface FamilyRow {
  id: string;
  name: string;
}

interface FamilyMemberRow {
  id: string;
  family_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  email: string | null;
}

interface CareRecipientRow {
  id: string;
  family_id: string;
  full_name: string;
}

interface CareRecipientRecordRow {
  id: string;
  family_id: string;
  full_name: string;
  date_of_birth: string | null;
  notes: string | null;
}

interface AppointmentRow {
  id: string;
  family_id: string;
  care_recipient_id: string;
  title: string;
  provider_name: string | null;
  location: string | null;
  scheduled_at: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

interface TaskRow {
  id: string;
  family_id: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigned_to: string | null;
  due_at: string | null;
}

interface TaskRecordRow {
  id: string;
  family_id: string;
  care_recipient_id: string;
  title: string;
  description: string | null;
  status: TaskRecordStatus;
  priority: TaskRecordPriority;
  assigned_to: string | null;
  due_at: string | null;
}

interface TimelineRow {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  occurred_at: string;
  created_by: string;
}

interface PrescriptionRow {
  id: string;
  family_id: string;
  care_recipient_id: string;
  medication_name: string;
  dosage: string | null;
  instructions: string | null;
  prescribed_by: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
}

interface RefillRow {
  id: string;
  prescription_id: string;
  due_at: string;
  completed_at: string | null;
  status: RefillStatusValue;
}

interface MedicalRecordRow {
  id: string;
  family_id: string;
  care_recipient_id: string;
  uploaded_by: string;
  title: string;
  record_type: MedicalRecordType;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface Paginated<T> {
  items: T[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

interface FamilyMembersPayload {
  members: FamilyMemberRow[];
}

/** A membership row as returned by GET /api/family-members (snake_case). */
interface FamilyMemberApiRow {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  created_at: string;
  display_name: string | null;
  email: string | null;
}

/** An invitation row as returned by GET and POST /api/invitations (snake_case). */
interface InvitationApiRow {
  id: string;
  family_id: string;
  email: string;
  role: InvitationRole;
  expires_at: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string | undefined> = {
  ADMIN: "Administrator",
  CAREGIVER: "Caregiver",
  CONTRIBUTOR: "Contributor",
  VIEWER: "Viewer",
};

const APPOINTMENT_STATUS: Record<AppointmentRow["status"], AppointmentStatus> = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const PRIORITY: Record<TaskRow["priority"], Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "high",
};

function errorMessageOf(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return undefined;
  }
  const error = (body as { error?: { message?: unknown } | null }).error;
  const message = error?.message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

async function readData<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessageOf(body) ?? GENERIC_ERROR_MESSAGE);
  }
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: T }).data;
  }
  throw new Error(GENERIC_ERROR_MESSAGE);
}

async function apiGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin" });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
  return readData<T>(response);
}

/**
 * Reads every page of a paginated list, one request at a time. `basePath` must already
 * contain the query string (e.g. `...?family_id=...`), since `&page=` is appended to it.
 * Throws if the list exceeds MAX_PAGES or any page fails; never returns partial data.
 */
async function fetchAllPages<T>(basePath: string): Promise<T[]> {
  const items: T[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    const data = await apiGet<Paginated<T>>(`${basePath}&page=${page}&pageSize=${PAGE_SIZE}`);
    items.push(...data.items);
    totalPages =
      typeof data.totalPages === "number" && Number.isFinite(data.totalPages) ? data.totalPages : 1;
    if (totalPages > MAX_PAGES) {
      throw new Error("Too many records to display; the list is incomplete.");
    }
  }
  return items;
}

async function listForFamily<T>(resource: string, familyId: string): Promise<T[]> {
  return fetchAllPages<T>(`/api/${resource}?family_id=${encodeURIComponent(familyId)}`);
}

async function loadMemberRows(familyId: string): Promise<FamilyMemberRow[]> {
  // The family-members API does not paginate; it returns { members, currentUser } in one response.
  const payload = await apiGet<FamilyMembersPayload>(
    `/api/family-members?family_id=${encodeURIComponent(familyId)}`,
  );
  return payload.members;
}

function displayNameOf(row: FamilyMemberRow): string {
  return row.display_name || row.email || UNKNOWN_MEMBER_NAME;
}

/** Maps auth user id to display name, using the family membership list. */
function memberNameLookup(rows: FamilyMemberRow[]): Map<string, string> {
  return new Map(rows.map((row): [string, string] => [row.user_id, displayNameOf(row)]));
}

function recipientNameLookup(rows: CareRecipientRow[]): Map<string, string> {
  return new Map(rows.map((row): [string, string] => [row.id, row.full_name]));
}

/** Returns YYYY-MM-DD in UTC, or an empty string when there is no usable date. */
function toDateOnly(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10);
}

function toFamilyMember(row: FamilyMemberRow): FamilyMember {
  return {
    id: row.id,
    familyId: row.family_id,
    fullName: displayNameOf(row),
    relationship: ROLE_LABELS[row.role] ?? row.role,
    isCareRecipient: false,
  };
}

function toCareRecipient(row: CareRecipientRow): CareRecipient {
  return { id: row.id, familyId: row.family_id, fullName: row.full_name };
}

function mapAppointments(
  rows: AppointmentRow[],
  recipientNames: Map<string, string>,
): Appointment[] {
  return rows
    .map(
      (row): Appointment => ({
        id: row.id,
        familyId: row.family_id,
        careRecipientName: recipientNames.get(row.care_recipient_id) ?? UNKNOWN_RECIPIENT_NAME,
        title: row.title,
        provider: row.provider_name ?? "",
        facility: row.location ?? "",
        startsAt: row.scheduled_at,
        status: APPOINTMENT_STATUS[row.status],
      }),
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Open tasks first, then by due date; tasks without a due date sort last. */
function compareTasks(a: Task, b: Task): number {
  if (a.completed !== b.completed) {
    return a.completed ? 1 : -1;
  }
  if (a.dueDate === b.dueDate) {
    return 0;
  }
  if (!a.dueDate) {
    return 1;
  }
  if (!b.dueDate) {
    return -1;
  }
  return a.dueDate < b.dueDate ? -1 : 1;
}

function mapTasks(rows: TaskRow[], memberNames: Map<string, string>): Task[] {
  return rows
    .filter((row) => row.status !== "CANCELLED")
    .map((row): Task => {
      const assignee = row.assigned_to ? memberNames.get(row.assigned_to) : undefined;
      return {
        id: row.id,
        familyId: row.family_id,
        title: row.title,
        assigneeName: assignee ?? UNASSIGNED_NAME,
        dueDate: toDateOnly(row.due_at),
        priority: PRIORITY[row.priority],
        completed: row.status === "COMPLETED",
      };
    })
    .sort(compareTasks);
}

function mapActivity(rows: TimelineRow[], memberNames: Map<string, string>): ActivityItem[] {
  return rows
    .map(
      (row): ActivityItem => ({
        id: row.id,
        familyId: row.family_id,
        actorName: memberNames.get(row.created_by) ?? UNKNOWN_MEMBER_NAME,
        action: row.description ? `${row.title} — ${row.description}` : row.title,
        occurredAt: row.occurred_at,
      }),
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export async function fetchFamilies(): Promise<Family[]> {
  const rows = await fetchAllPages<FamilyRow>("/api/families?");
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function createFamily(name: string): Promise<Family> {
  let response: Response;
  try {
    response = await fetch("/api/families", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
  const row = await readData<FamilyRow>(response);
  return { id: row.id, name: row.name };
}

export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const rows = await loadMemberRows(familyId);
  return rows.map(toFamilyMember);
}

/** Members with role and user id, plus the signed-in user's own role. Not paginated. */
export interface FamilyMembersView {
  members: FamilyMemberRecord[];
  currentUser: FamilyCurrentUser;
}

function toFamilyMemberRecord(row: FamilyMemberApiRow): FamilyMemberRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
  };
}

function toInvitationRecord(row: InvitationApiRow): InvitationRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function fetchFamilyMembersView(familyId: string): Promise<FamilyMembersView> {
  const payload = await apiGet<{ members: FamilyMemberApiRow[]; currentUser: FamilyCurrentUser }>(
    `/api/family-members?family_id=${encodeURIComponent(familyId)}`,
  );
  return {
    members: payload.members.map(toFamilyMemberRecord),
    currentUser: { id: payload.currentUser.id, role: payload.currentUser.role },
  };
}

/** Changes a membership role. Only the member id is sent; the server enforces ADMIN and last-admin rules. */
export async function changeFamilyMemberRole(memberId: string, role: FamilyRole): Promise<void> {
  await sendJson<unknown>("PATCH", `/api/family-members/${encodeURIComponent(memberId)}`, { role });
}

/** Removes a membership (self-leave or ADMIN removal). The server enforces the rules. */
export async function removeFamilyMember(memberId: string): Promise<void> {
  await sendJson<unknown>("DELETE", `/api/family-members/${encodeURIComponent(memberId)}`);
}

/** Pending, unexpired invitations for a family. ADMIN only on the server. */
export async function fetchInvitationRecords(familyId: string): Promise<InvitationRecord[]> {
  const payload = await apiGet<{ items: InvitationApiRow[] }>(
    `/api/invitations?family_id=${encodeURIComponent(familyId)}`,
  );
  return payload.items.map(toInvitationRecord);
}

export interface CreateInvitationResult {
  invitation: InvitationRecord;
  /** Shown once by the server; it is not returned again. */
  invitationUrl: string;
}

export async function createInvitation(input: {
  familyId: string;
  email: string;
  role: InvitationRole;
}): Promise<CreateInvitationResult> {
  const payload = await sendJson<{ invitation: InvitationApiRow; invitationUrl: string }>(
    "POST",
    "/api/invitations",
    {
      family_id: input.familyId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
    },
  );
  return {
    invitation: toInvitationRecord(payload.invitation),
    invitationUrl: payload.invitationUrl,
  };
}

export async function revokeInvitation(id: string): Promise<void> {
  await sendJson<unknown>("DELETE", `/api/invitations/${encodeURIComponent(id)}`);
}

export async function fetchCareRecipients(familyId: string): Promise<CareRecipient[]> {
  const rows = await listForFamily<CareRecipientRow>("care-recipients", familyId);
  return rows.map(toCareRecipient);
}

function toCareRecipientRecord(row: CareRecipientRecordRow): CareRecipientRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    notes: row.notes,
  };
}

/** Sends a JSON mutation and reads the { data } envelope; server error messages are surfaced, others are generic. */
async function sendJson<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
  return readData<T>(response);
}

/** Full records (including date of birth and notes) for every care recipient in a family. */
export async function fetchCareRecipientRecords(familyId: string): Promise<CareRecipientRecord[]> {
  const rows = await listForFamily<CareRecipientRecordRow>("care-recipients", familyId);
  return rows.map(toCareRecipientRecord);
}

export async function createCareRecipient(input: {
  familyId: string;
  fullName: string;
  dateOfBirth: string | null;
  notes: string | null;
}): Promise<CareRecipientRecord> {
  const row = await sendJson<CareRecipientRecordRow>("POST", "/api/care-recipients", {
    family_id: input.familyId,
    full_name: input.fullName,
    date_of_birth: input.dateOfBirth,
    notes: input.notes,
  });
  return toCareRecipientRecord(row);
}

/** Sends only the keys the caller provided; the API rejects an empty body. */
export async function updateCareRecipient(
  id: string,
  input: { fullName?: string; dateOfBirth?: string | null; notes?: string | null },
): Promise<CareRecipientRecord> {
  const body: Record<string, string | null> = {};
  if (input.fullName !== undefined) {
    body.full_name = input.fullName;
  }
  if (input.dateOfBirth !== undefined) {
    body.date_of_birth = input.dateOfBirth;
  }
  if (input.notes !== undefined) {
    body.notes = input.notes;
  }
  const row = await sendJson<CareRecipientRecordRow>(
    "PATCH",
    `/api/care-recipients/${encodeURIComponent(id)}`,
    body,
  );
  return toCareRecipientRecord(row);
}

export async function deleteCareRecipient(id: string): Promise<void> {
  await sendJson<{ deleted: boolean }>("DELETE", `/api/care-recipients/${encodeURIComponent(id)}`);
}

function toAppointmentRecord(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    careRecipientId: row.care_recipient_id,
    title: row.title,
    providerName: row.provider_name,
    location: row.location,
    scheduledAt: row.scheduled_at,
    status: row.status,
  };
}

function toTaskRecord(row: TaskRecordRow): TaskRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    careRecipientId: row.care_recipient_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    dueAt: row.due_at,
  };
}

/** Every task record in a family (not filtered by status). */
export async function fetchTaskRecords(familyId: string): Promise<TaskRecord[]> {
  const rows = await listForFamily<TaskRecordRow>("tasks", familyId);
  return rows.map(toTaskRecord);
}

/** Assignable family members. `userId` is the auth user id that the tasks API expects in `assigned_to`. */
export async function fetchFamilyMemberOptions(familyId: string): Promise<TaskAssigneeOption[]> {
  const rows = await loadMemberRows(familyId);
  return rows.map((row) => ({ userId: row.user_id, label: displayNameOf(row) }));
}

export interface CreateTaskInput {
  familyId: string;
  careRecipientId: string;
  title: string;
  description: string | null;
  priority: TaskRecordPriority;
  assignedTo: string | null;
  dueAt: string | null;
}

/** Only the keys the caller provides are sent; the API rejects an empty body. */
export interface UpdateTaskInput {
  careRecipientId?: string;
  title?: string;
  description?: string | null;
  status?: TaskRecordStatus;
  priority?: TaskRecordPriority;
  assignedTo?: string | null;
  dueAt?: string | null;
}

/** Status is not sent: the API defaults new tasks to PENDING. */
export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const row = await sendJson<TaskRecordRow>("POST", "/api/tasks", {
    family_id: input.familyId,
    care_recipient_id: input.careRecipientId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    assigned_to: input.assignedTo,
    due_at: input.dueAt,
  });
  return toTaskRecord(row);
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskRecord> {
  const body: Record<string, string | null> = {};
  if (input.careRecipientId !== undefined) {
    body.care_recipient_id = input.careRecipientId;
  }
  if (input.title !== undefined) {
    body.title = input.title;
  }
  if (input.description !== undefined) {
    body.description = input.description;
  }
  if (input.status !== undefined) {
    body.status = input.status;
  }
  if (input.priority !== undefined) {
    body.priority = input.priority;
  }
  if (input.assignedTo !== undefined) {
    body.assigned_to = input.assignedTo;
  }
  if (input.dueAt !== undefined) {
    body.due_at = input.dueAt;
  }
  const row = await sendJson<TaskRecordRow>("PATCH", `/api/tasks/${encodeURIComponent(id)}`, body);
  return toTaskRecord(row);
}

export async function deleteTask(id: string): Promise<void> {
  await sendJson<{ deleted: boolean }>("DELETE", `/api/tasks/${encodeURIComponent(id)}`);
}

export async function fetchAppointments(familyId: string): Promise<Appointment[]> {
  const [recipientRows, appointmentRows] = await Promise.all([
    listForFamily<CareRecipientRow>("care-recipients", familyId),
    listForFamily<AppointmentRow>("appointments", familyId),
  ]);
  return mapAppointments(appointmentRows, recipientNameLookup(recipientRows));
}

export async function fetchTasks(familyId: string): Promise<Task[]> {
  const [memberRows, taskRows] = await Promise.all([
    loadMemberRows(familyId),
    listForFamily<TaskRow>("tasks", familyId),
  ]);
  return mapTasks(taskRows, memberNameLookup(memberRows));
}

/** Timeline events are used as the activity feed. There is no separate audit trail API. */
export async function fetchActivity(familyId: string): Promise<ActivityItem[]> {
  const [memberRows, timelineRows] = await Promise.all([
    loadMemberRows(familyId),
    listForFamily<TimelineRow>("timeline", familyId),
  ]);
  return mapActivity(timelineRows, memberNameLookup(memberRows));
}

/** No notifications API exists yet, so this always returns an empty list. */
export async function fetchNotifications(familyId?: string): Promise<AppNotification[]> {
  void familyId; // no notifications API exists yet; the family argument is accepted for callers
  return [];
}

export async function fetchDashboardData(familyId: string): Promise<DashboardData> {
  const [memberRows, recipientRows, appointmentRows, taskRows, timelineRows] = await Promise.all([
    loadMemberRows(familyId),
    listForFamily<CareRecipientRow>("care-recipients", familyId),
    listForFamily<AppointmentRow>("appointments", familyId),
    listForFamily<TaskRow>("tasks", familyId),
    listForFamily<TimelineRow>("timeline", familyId),
  ]);

  const memberNames = memberNameLookup(memberRows);
  const now = Date.now();

  const upcomingRows = appointmentRows.filter(
    (row) => row.status === "SCHEDULED" && Date.parse(row.scheduled_at) >= now,
  );
  const appointments = mapAppointments(upcomingRows, recipientNameLookup(recipientRows));

  const openTasks = mapTasks(taskRows, memberNames).filter((task) => !task.completed);

  const activity = mapActivity(timelineRows, memberNames).slice(0, ACTIVITY_LIMIT);

  const summary: DashboardSummary = {
    totalFamilyMembers: memberRows.length,
    careRecipients: recipientRows.length,
    upcomingAppointments: appointments.length,
    pendingTasks: openTasks.length,
  };

  return { summary, appointments, tasks: openTasks, activity };
}

/** Every appointment record in a family, soonest first. The list API does not return notes. */
export async function fetchAppointmentRecords(familyId: string): Promise<AppointmentRecord[]> {
  const rows = await listForFamily<AppointmentRow>("appointments", familyId);
  return rows
    .map(toAppointmentRecord)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
}

export interface CreateAppointmentInput {
  familyId: string;
  careRecipientId: string;
  title: string;
  providerName: string | null;
  location: string | null;
  scheduledAt: string;
  status?: AppointmentStatusValue;
  notes: string | null;
}

/** `status` is sent only when provided; the API defaults new appointments to SCHEDULED. */
export async function createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecord> {
  const body: Record<string, string | null> = {
    family_id: input.familyId,
    care_recipient_id: input.careRecipientId,
    title: input.title,
    provider_name: input.providerName,
    location: input.location,
    scheduled_at: input.scheduledAt,
    notes: input.notes,
  };
  if (input.status !== undefined) {
    body.status = input.status;
  }
  const row = await sendJson<AppointmentRow>("POST", "/api/appointments", body);
  return toAppointmentRecord(row);
}

/**
 * Only the keys the caller provides are sent; the API rejects an empty body. `notes` is not
 * updatable here because the appointments list does not return it to pre-fill an edit form.
 * `scheduledAt` and `careRecipientId` are not nullable on the API, so they are never sent as null.
 */
export interface UpdateAppointmentInput {
  careRecipientId?: string;
  title?: string;
  providerName?: string | null;
  location?: string | null;
  scheduledAt?: string;
  status?: AppointmentStatusValue;
}

export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentRecord> {
  const body: Record<string, string | null> = {};
  if (input.careRecipientId !== undefined) {
    body.care_recipient_id = input.careRecipientId;
  }
  if (input.title !== undefined) {
    body.title = input.title;
  }
  if (input.providerName !== undefined) {
    body.provider_name = input.providerName;
  }
  if (input.location !== undefined) {
    body.location = input.location;
  }
  if (input.scheduledAt !== undefined) {
    body.scheduled_at = input.scheduledAt;
  }
  if (input.status !== undefined) {
    body.status = input.status;
  }
  const row = await sendJson<AppointmentRow>(
    "PATCH",
    `/api/appointments/${encodeURIComponent(id)}`,
    body,
  );
  return toAppointmentRecord(row);
}

export async function deleteAppointment(id: string): Promise<void> {
  await sendJson<{ deleted: boolean }>("DELETE", `/api/appointments/${encodeURIComponent(id)}`);
}

function toPrescriptionRecord(row: PrescriptionRow): PrescriptionRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    careRecipientId: row.care_recipient_id,
    medicationName: row.medication_name,
    dosage: row.dosage,
    instructions: row.instructions,
    prescribedBy: row.prescribed_by,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
  };
}

function toRefillRecord(row: RefillRow): PrescriptionRefillRecord {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    status: row.status,
  };
}

/** Blank or whitespace-only optional text is sent as null. */
function nullIfBlank(value: string | null): string | null {
  return value === null || value.trim().length === 0 ? null : value;
}

/** Every prescription in a family, sorted by medication name. */
export async function fetchPrescriptionRecords(familyId: string): Promise<PrescriptionRecord[]> {
  const rows = await listForFamily<PrescriptionRow>("prescriptions", familyId);
  return rows
    .map(toPrescriptionRecord)
    .sort((a, b) => a.medicationName.localeCompare(b.medicationName));
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

/** `created_by` is set by the server from the signed-in user, so it is not sent. */
export async function createPrescription(input: CreatePrescriptionInput): Promise<PrescriptionRecord> {
  const row = await sendJson<PrescriptionRow>("POST", "/api/prescriptions", {
    family_id: input.familyId,
    care_recipient_id: input.careRecipientId,
    medication_name: input.medicationName.trim(),
    dosage: nullIfBlank(input.dosage),
    instructions: nullIfBlank(input.instructions),
    prescribed_by: nullIfBlank(input.prescribedBy),
    start_date: nullIfBlank(input.startDate),
    end_date: nullIfBlank(input.endDate),
    active: input.active,
  });
  return toPrescriptionRecord(row);
}

/**
 * Only the keys the caller provides are sent; the API rejects an empty body.
 * `careRecipientId` and `medicationName` are not nullable on the API, so they are never sent as null.
 */
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

export async function updatePrescription(
  id: string,
  input: UpdatePrescriptionInput,
): Promise<PrescriptionRecord> {
  const body: Record<string, string | boolean | null> = {};
  if (input.careRecipientId !== undefined) {
    body.care_recipient_id = input.careRecipientId;
  }
  if (input.medicationName !== undefined) {
    body.medication_name = input.medicationName.trim();
  }
  if (input.dosage !== undefined) {
    body.dosage = nullIfBlank(input.dosage);
  }
  if (input.instructions !== undefined) {
    body.instructions = nullIfBlank(input.instructions);
  }
  if (input.prescribedBy !== undefined) {
    body.prescribed_by = nullIfBlank(input.prescribedBy);
  }
  if (input.startDate !== undefined) {
    body.start_date = nullIfBlank(input.startDate);
  }
  if (input.endDate !== undefined) {
    body.end_date = nullIfBlank(input.endDate);
  }
  if (input.active !== undefined) {
    body.active = input.active;
  }
  const row = await sendJson<PrescriptionRow>(
    "PATCH",
    `/api/prescriptions/${encodeURIComponent(id)}`,
    body,
  );
  return toPrescriptionRecord(row);
}

export async function deletePrescription(id: string): Promise<void> {
  await sendJson<{ deleted: boolean }>("DELETE", `/api/prescriptions/${encodeURIComponent(id)}`);
}

/** Every refill for one prescription. The API orders them by due date. */
export async function fetchRefillRecords(prescriptionId: string): Promise<PrescriptionRefillRecord[]> {
  const rows = await fetchAllPages<RefillRow>(
    `/api/medicine-refills?prescription_id=${encodeURIComponent(prescriptionId)}`,
  );
  return rows.map(toRefillRecord);
}

export interface CreateRefillInput {
  prescriptionId: string;
  /** ISO 8601 date-time string. */
  dueAt: string;
}

/** Only `prescription_id` and `due_at` are sent. Status and completion time are not set by the client. */
export async function createRefill(input: CreateRefillInput): Promise<PrescriptionRefillRecord> {
  const row = await sendJson<RefillRow>("POST", "/api/medicine-refills", {
    prescription_id: input.prescriptionId,
    due_at: input.dueAt,
  });
  return toRefillRecord(row);
}

/** Only `status` is sent. The API sets `completed_at` itself when the status is COMPLETED. */
export async function updateRefillStatus(
  id: string,
  status: RefillStatusValue,
): Promise<PrescriptionRefillRecord> {
  const row = await sendJson<RefillRow>(
    "PATCH",
    `/api/medicine-refills/${encodeURIComponent(id)}`,
    { status },
  );
  return toRefillRecord(row);
}

export async function deleteRefill(id: string): Promise<void> {
  await sendJson<{ deleted: boolean }>("DELETE", `/api/medicine-refills/${encodeURIComponent(id)}`);
}

export const MEDICAL_DOCUMENT_MAX_BYTES = 10485760;

export const MEDICAL_DOCUMENT_MIME_TYPES: readonly MedicalRecordMimeType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MEDICAL_DOCUMENT_BUCKET = "medical-records";
const MAX_STORED_FILE_NAME_LENGTH = 120;
const UPLOAD_ERROR_MESSAGE = "Unable to upload the document. Please try again.";

function toMedicalRecordRecord(row: MedicalRecordRow): MedicalRecordRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    careRecipientId: row.care_recipient_id,
    uploadedBy: row.uploaded_by,
    title: row.title,
    recordType: row.record_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
  };
}

/** Every medical record in a family, newest first. The file path is not returned by the API. */
export async function fetchMedicalRecordRecords(familyId: string): Promise<MedicalRecordRecord[]> {
  const rows = await listForFamily<MedicalRecordRow>("medical-records", familyId);
  return rows
    .map(toMedicalRecordRecord)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface CreateMedicalRecordInput {
  familyId: string;
  careRecipientId: string;
  title: string;
  recordType: MedicalRecordType;
  /** Storage path returned by uploadMedicalDocument. */
  filePath: string;
  fileName: string | null;
  mimeType: MedicalRecordMimeType;
  fileSizeBytes: number;
  notes: string | null;
}

/** `uploaded_by` is set by the server from the signed-in user, so it is not sent. */
export async function createMedicalRecord(input: CreateMedicalRecordInput): Promise<MedicalRecordRecord> {
  const row = await sendJson<MedicalRecordRow>("POST", "/api/medical-records", {
    family_id: input.familyId,
    care_recipient_id: input.careRecipientId,
    title: input.title.trim(),
    record_type: input.recordType,
    file_path: input.filePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    file_size_bytes: input.fileSizeBytes,
    notes: nullIfBlank(input.notes),
  });
  return toMedicalRecordRecord(row);
}

/**
 * Replaces every character outside [A-Za-z0-9._-] with "_", collapses runs of dots so the
 * name never contains "..", and caps the length. The unique prefix keeps paths distinct.
 */
function toStoredFileName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, MAX_STORED_FILE_NAME_LENGTH);
}

/**
 * Uploads a document to the private medical-records bucket with the signed-in user's session
 * and returns the storage path. The error message is generic; storage details are not exposed.
 */
export async function uploadMedicalDocument(
  familyId: string,
  careRecipientId: string,
  file: File,
): Promise<string> {
  const path = `${familyId}/${careRecipientId}/${crypto.randomUUID()}-${toStoredFileName(file.name)}`;
  let failed = false;
  try {
    const { error } = await createClient()
      .storage.from(MEDICAL_DOCUMENT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) {
    throw new Error(UPLOAD_ERROR_MESSAGE);
  }
  return path;
}

/**
 * Returns a short-lived signed URL for one record. The caller opens it straight away; it is
 * not cached or stored anywhere.
 */
export async function getMedicalRecordSignedUrl(id: string, mode: "view" | "download"): Promise<string> {
  const data = await apiGet<{ url: string; expiresInSeconds: number }>(
    `/api/medical-records/${encodeURIComponent(id)}/signed-url?mode=${mode}`,
  );
  return data.url;
}

export async function deleteMedicalRecord(id: string, familyId: string): Promise<void> {
  await sendJson<{ deleted: boolean }>(
    "DELETE",
    `/api/medical-records/${encodeURIComponent(id)}?family_id=${encodeURIComponent(familyId)}`,
  );
}

export const dashboardKeys = {
  families: ["families"] as const,
  dashboard: (familyId: string) => ["dashboard", familyId] as const,
  members: (familyId: string) => ["members", familyId] as const,
  recipients: (familyId: string) => ["recipients", familyId] as const,
  recipientRecords: (familyId: string) => ["recipient-records", familyId] as const,
  appointments: (familyId: string) => ["appointments", familyId] as const,
  appointmentRecords: (familyId: string) => ["appointment-records", familyId] as const,
  tasks: (familyId: string) => ["tasks", familyId] as const,
  activity: (familyId: string) => ["activity", familyId] as const,
  notifications: (familyId: string) => ["notifications", familyId] as const,
  taskRecords: (familyId: string) => ["task-records", familyId] as const,
  memberOptions: (familyId: string) => ["member-options", familyId] as const,
  prescriptionRecords: (familyId: string) => ["prescription-records", familyId] as const,
  refillRecords: (prescriptionId: string) => ["refill-records", prescriptionId] as const,
  medicalRecordRecords: (familyId: string) => ["medical-record-records", familyId] as const,
  familyMembersView: (familyId: string) => ["family-members-view", familyId] as const,
  invitationRecords: (familyId: string) => ["invitation-records", familyId] as const,
};
