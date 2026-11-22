/**
 * Query layer for the dashboard. Currently returns synthetic data after a simulated delay.
 * Replace the bodies with agreed API calls when Person A's endpoints are ready; keep the exported names.
 */

import type {
  ActivityItem,
  Appointment,
  AppNotification,
  CareRecipient,
  DashboardData,
  DashboardSummary,
  Family,
  FamilyMember,
  Task,
} from "./types";
import {
  ACTIVITY,
  APPOINTMENTS,
  CARE_RECIPIENTS,
  FAMILIES,
  FAMILY_MEMBERS,
  NOTIFICATIONS,
  TASKS,
} from "./mock-data";

const SIMULATED_LATENCY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const REFERENCE_NOW = "2026-11-21T09:00:00+00:00";

function assertKnownFamily(familyId: string): void {
  const known = FAMILIES.some((family) => family.id === familyId);
  if (!known) {
    throw new Error("Unknown family");
  }
}

export async function fetchFamilies(): Promise<Family[]> {
  await delay(SIMULATED_LATENCY_MS);
  return FAMILIES;
}

export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);
  return FAMILY_MEMBERS.filter((member) => member.familyId === familyId);
}

export async function fetchCareRecipients(familyId: string): Promise<CareRecipient[]> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);
  return CARE_RECIPIENTS.filter((recipient) => recipient.familyId === familyId);
}

export async function fetchAppointments(familyId: string): Promise<Appointment[]> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);
  return APPOINTMENTS.filter((appointment) => appointment.familyId === familyId).sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );
}

export async function fetchTasks(familyId: string): Promise<Task[]> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);
  return TASKS.filter((task) => task.familyId === familyId).sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
  });
}

export async function fetchActivity(familyId: string): Promise<ActivityItem[]> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);
  return ACTIVITY.filter((item) => item.familyId === familyId).sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );
}

export async function fetchNotifications(familyId: string): Promise<AppNotification[]> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);
  return NOTIFICATIONS.filter((notification) => notification.familyId === familyId).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export async function fetchDashboardData(familyId: string): Promise<DashboardData> {
  assertKnownFamily(familyId);
  await delay(SIMULATED_LATENCY_MS);

  const members: FamilyMember[] = FAMILY_MEMBERS.filter((member) => member.familyId === familyId);
  const recipients: CareRecipient[] = CARE_RECIPIENTS.filter(
    (recipient) => recipient.familyId === familyId,
  );

  const now = Date.parse(REFERENCE_NOW);
  const appointments: Appointment[] = APPOINTMENTS.filter(
    (appointment) =>
      appointment.familyId === familyId &&
      (appointment.status === "scheduled" || appointment.status === "confirmed") &&
      Date.parse(appointment.startsAt) >= now,
  ).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const tasks: Task[] = TASKS.filter(
    (task) => task.familyId === familyId && task.completed === false,
  ).sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const activity: ActivityItem[] = ACTIVITY.filter((item) => item.familyId === familyId)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 6);

  const summary: DashboardSummary = {
    totalFamilyMembers: members.length,
    activeCareRecipients: recipients.filter((r) => r.status === "active").length,
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
};
