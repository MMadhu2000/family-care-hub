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
  memberId: string;
  fullName: string;
  status: "active" | "inactive";
  primaryFacility: string;
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
  activeCareRecipients: number;
  upcomingAppointments: number;
  pendingTasks: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  appointments: Appointment[];
  tasks: Task[];
  activity: ActivityItem[];
}
