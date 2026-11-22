import type { ActivityItem, AppNotification, Appointment, CareRecipient, Family, FamilyMember, Task } from "./types";

// SYNTHETIC DEMO DATA. All people, facilities, providers and records are fictional.
// Not real patient information. Remove when backend APIs are connected.

export const FAMILIES: Family[] = [
  { id: "fam-harper", name: "Harper Household" },
  { id: "fam-lindqvist", name: "Lindqvist Household" },
];

export const FAMILY_MEMBERS: FamilyMember[] = [
  { id: "m-alex", familyId: "fam-harper", fullName: "Alex Harper", relationship: "Parent / caregiver", isCareRecipient: false },
  { id: "m-jordan", familyId: "fam-harper", fullName: "Jordan Harper", relationship: "Adult child / caregiver", isCareRecipient: false },
  { id: "m-margaret", familyId: "fam-harper", fullName: "Margaret Harper", relationship: "Grandparent", isCareRecipient: true },
  { id: "m-sam", familyId: "fam-harper", fullName: "Sam Harper", relationship: "Teen", isCareRecipient: false },
  { id: "m-erik", familyId: "fam-lindqvist", fullName: "Erik Lindqvist", relationship: "Parent / caregiver", isCareRecipient: false },
  { id: "m-lena", familyId: "fam-lindqvist", fullName: "Lena Lindqvist", relationship: "Sibling", isCareRecipient: false },
  { id: "m-peter", familyId: "fam-lindqvist", fullName: "Peter Lindqvist", relationship: "Grandparent", isCareRecipient: true },
];

export const CARE_RECIPIENTS: CareRecipient[] = [
  { id: "cr-margaret", familyId: "fam-harper", fullName: "Margaret Harper" },
  { id: "cr-peter", familyId: "fam-lindqvist", fullName: "Peter Lindqvist" },
];

export const APPOINTMENTS: Appointment[] = [
  { id: "ap-1", familyId: "fam-harper", careRecipientName: "Margaret Harper", title: "Routine mobility review", provider: "Dr. Helen Park (GP)", facility: "Northgate Family Practice", startsAt: "2026-11-23T10:30:00+00:00", status: "confirmed" },
  { id: "ap-2", familyId: "fam-harper", careRecipientName: "Margaret Harper", title: "Physiotherapy follow-up", provider: "Tom Briggs (Physiotherapist)", facility: "Oakwood Rehabilitation Centre", startsAt: "2026-11-26T14:00:00+00:00", status: "scheduled" },
  { id: "ap-3", familyId: "fam-harper", careRecipientName: "Margaret Harper", title: "Dental check-up", provider: "Dr. Omar Reyes (Dentist)", facility: "Northgate Dental", startsAt: "2026-12-04T08:45:00+00:00", status: "confirmed" },
  { id: "ap-4", familyId: "fam-lindqvist", careRecipientName: "Peter Lindqvist", title: "Annual health check", provider: "Dr. Amira Sol (GP)", facility: "Riverside Community Clinic", startsAt: "2026-11-24T09:15:00+00:00", status: "scheduled" },
  { id: "ap-5", familyId: "fam-lindqvist", careRecipientName: "Peter Lindqvist", title: "Eye clinic review", provider: "Dr. Ruth Keane (Optometrist)", facility: "Lakeside Vision Centre", startsAt: "2026-11-18T11:00:00+00:00", status: "completed" },
  { id: "ap-6", familyId: "fam-harper", careRecipientName: "Margaret Harper", title: "Pharmacy consultation", provider: "Priya Shah (Pharmacist)", facility: "Northgate Pharmacy", startsAt: "2026-11-20T16:00:00+00:00", status: "cancelled" },
];

export const TASKS: Task[] = [
  { id: "t-1", familyId: "fam-harper", title: "Book transport for physiotherapy visit", assigneeName: "Jordan Harper", dueDate: "2026-11-24", priority: "high", completed: false },
  { id: "t-2", familyId: "fam-harper", title: "Update emergency contact sheet", assigneeName: "Alex Harper", dueDate: "2026-11-22", priority: "medium", completed: false },
  { id: "t-3", familyId: "fam-harper", title: "Collect insurance claim form", assigneeName: "Alex Harper", dueDate: "2026-11-28", priority: "low", completed: false },
  { id: "t-4", familyId: "fam-harper", title: "Confirm dental appointment reminder", assigneeName: "Sam Harper", dueDate: "2026-12-01", priority: "low", completed: true },
  { id: "t-5", familyId: "fam-lindqvist", title: "Pack documents for annual health check", assigneeName: "Lena Lindqvist", dueDate: "2026-11-23", priority: "high", completed: false },
  { id: "t-6", familyId: "fam-lindqvist", title: "Arrange weekly grocery delivery", assigneeName: "Erik Lindqvist", dueDate: "2026-11-25", priority: "medium", completed: false },
  { id: "t-7", familyId: "fam-lindqvist", title: "Return library books", assigneeName: "Lena Lindqvist", dueDate: "2026-11-19", priority: "low", completed: true },
];

export const ACTIVITY: ActivityItem[] = [
  { id: "a-1", familyId: "fam-harper", actorName: "Jordan Harper", action: "uploaded a transport confirmation", occurredAt: "2026-11-21T08:40:00+00:00" },
  { id: "a-2", familyId: "fam-harper", actorName: "Alex Harper", action: "confirmed the Monday mobility review", occurredAt: "2026-11-21T07:15:00+00:00" },
  { id: "a-3", familyId: "fam-harper", actorName: "Sam Harper", action: "completed task 'Confirm dental appointment reminder'", occurredAt: "2026-11-20T18:05:00+00:00" },
  { id: "a-4", familyId: "fam-harper", actorName: "Alex Harper", action: "updated the emergency contact sheet", occurredAt: "2026-11-20T12:30:00+00:00" },
  { id: "a-5", familyId: "fam-lindqvist", actorName: "Erik Lindqvist", action: "added a note to the eye clinic visit", occurredAt: "2026-11-21T06:50:00+00:00" },
  { id: "a-6", familyId: "fam-lindqvist", actorName: "Lena Lindqvist", action: "completed task 'Return library books'", occurredAt: "2026-11-19T17:20:00+00:00" },
  { id: "a-7", familyId: "fam-lindqvist", actorName: "Erik Lindqvist", action: "uploaded the annual health check letter", occurredAt: "2026-11-20T09:10:00+00:00" },
  { id: "a-8", familyId: "fam-harper", actorName: "Jordan Harper", action: "invited Sam Harper to the family calendar", occurredAt: "2026-11-18T19:45:00+00:00" },
];

export const NOTIFICATIONS: AppNotification[] = [
  { id: "n-1", familyId: "fam-harper", title: "Transport task due soon", body: "Book transport for the physiotherapy visit is due on 24 Nov.", createdAt: "2026-11-21T08:00:00+00:00", read: false },
  { id: "n-2", familyId: "fam-harper", title: "Appointment confirmed", body: "Routine mobility review on 23 Nov is confirmed.", createdAt: "2026-11-20T15:00:00+00:00", read: true },
  { id: "n-3", familyId: "fam-harper", title: "New document added", body: "Jordan Harper uploaded a transport confirmation.", createdAt: "2026-11-21T08:41:00+00:00", read: false },
  { id: "n-4", familyId: "fam-lindqvist", title: "Health check soon", body: "Annual health check at Riverside Community Clinic on 24 Nov.", createdAt: "2026-11-21T07:30:00+00:00", read: false },
  { id: "n-5", familyId: "fam-lindqvist", title: "Task completed", body: "Lena Lindqvist completed 'Return library books'.", createdAt: "2026-11-19T17:21:00+00:00", read: true },
];
