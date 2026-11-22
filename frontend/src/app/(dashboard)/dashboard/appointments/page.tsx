"use client";

import type { FormEvent, JSX } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  createAppointment,
  dashboardKeys,
  deleteAppointment,
  fetchAppointmentRecords,
  fetchCareRecipientRecords,
  updateAppointment,
} from "@/lib/dashboard/queries";
import type { CreateAppointmentInput, UpdateAppointmentInput } from "@/lib/dashboard/queries";
import type {
  AppointmentRecord,
  AppointmentStatusValue,
  RecipientOption,
} from "@/lib/dashboard/types";

const MAX_TITLE_LENGTH = 200;
const MAX_PROVIDER_LENGTH = 200;
const MAX_LOCATION_LENGTH = 500;
const MAX_NOTES_LENGTH = 5000;
const UNKNOWN_RECIPIENT_LABEL = "Unknown care recipient";
const UNKNOWN_DATE_LABEL = "Date unavailable";

const STATUS_OPTIONS: readonly { value: AppointmentStatusValue; label: string }[] = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SELECT_CLASS =
  "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "flex min-h-[4.5rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

interface AppointmentFormValues {
  careRecipientId: string;
  title: string;
  providerName: string;
  location: string;
  /** datetime-local value (local time), or "" when empty. */
  scheduledAt: string;
  /** Create form only. */
  status: AppointmentStatusValue;
  /** Create form only; the list API does not return notes, so edit never pre-fills them. */
  notes: string;
}

const EMPTY_FORM: AppointmentFormValues = {
  careRecipientId: "",
  title: "",
  providerName: "",
  location: "",
  scheduledAt: "",
  status: "SCHEDULED",
  notes: "",
};

interface UpdateVariables {
  id: string;
  familyId: string;
  input: UpdateAppointmentInput;
}

interface DeleteVariables {
  id: string;
  familyId: string;
}

function labelOf<T extends string>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function toStatus(value: string): AppointmentStatusValue | null {
  return STATUS_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

function validateForm(values: AppointmentFormValues): string | null {
  const title = values.title.trim();
  if (title.length === 0) {
    return "Enter a title.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  if (values.careRecipientId === "") {
    return "Choose a care recipient.";
  }
  if (values.providerName.length > MAX_PROVIDER_LENGTH) {
    return `Provider name must be ${MAX_PROVIDER_LENGTH} characters or fewer.`;
  }
  if (values.location.length > MAX_LOCATION_LENGTH) {
    return `Location must be ${MAX_LOCATION_LENGTH} characters or fewer.`;
  }
  if (values.scheduledAt === "") {
    return "Enter a date and time.";
  }
  if (Number.isNaN(Date.parse(values.scheduledAt))) {
    return "Enter a valid date and time.";
  }
  if (values.notes.length > MAX_NOTES_LENGTH) {
    return `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Empty or whitespace-only text is stored as null. */
function toNullableText(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

/** Converts a validated datetime-local value to an ISO 8601 string. */
function toIsoString(value: string): string {
  return new Date(value).toISOString();
}

/** Formats a stored ISO timestamp for a datetime-local input, in local time. */
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatScheduledAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? UNKNOWN_DATE_LABEL : date.toLocaleString();
}

function toEditValues(appointment: AppointmentRecord): AppointmentFormValues {
  return {
    careRecipientId: appointment.careRecipientId,
    title: appointment.title,
    providerName: appointment.providerName ?? "",
    location: appointment.location ?? "",
    scheduledAt: toDateTimeLocal(appointment.scheduledAt),
    status: appointment.status,
    notes: "",
  };
}

/** Returns only the fields that differ from the stored appointment. Status and notes are not edited here. */
function buildUpdate(appointment: AppointmentRecord, values: AppointmentFormValues): UpdateAppointmentInput {
  const update: UpdateAppointmentInput = {};
  if (values.careRecipientId !== appointment.careRecipientId) {
    update.careRecipientId = values.careRecipientId;
  }
  const title = values.title.trim();
  if (title !== appointment.title) {
    update.title = title;
  }
  const providerName = toNullableText(values.providerName);
  if (providerName !== appointment.providerName) {
    update.providerName = providerName;
  }
  const location = toNullableText(values.location);
  if (location !== appointment.location) {
    update.location = location;
  }
  if (values.scheduledAt !== toDateTimeLocal(appointment.scheduledAt)) {
    update.scheduledAt = toIsoString(values.scheduledAt);
  }
  return update;
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

interface AppointmentFieldsProps {
  idPrefix: string;
  values: AppointmentFormValues;
  disabled: boolean;
  recipients: RecipientOption[];
  onChange: (patch: Partial<AppointmentFormValues>) => void;
}

/** Fields shared by the create and edit forms. Status and notes are rendered by the create form only. */
function AppointmentFields({
  idPrefix,
  values,
  disabled,
  recipients,
  onChange,
}: AppointmentFieldsProps): JSX.Element {
  const recipientKnown = recipients.some((recipient) => recipient.id === values.careRecipientId);

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-recipient`}>Care recipient</Label>
        <select
          id={`${idPrefix}-recipient`}
          name="careRecipientId"
          required
          aria-required="true"
          disabled={disabled}
          value={values.careRecipientId}
          onChange={(event) => onChange({ careRecipientId: event.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Select a care recipient</option>
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.fullName}
            </option>
          ))}
          {values.careRecipientId !== "" && !recipientKnown ? (
            <option value={values.careRecipientId}>{UNKNOWN_RECIPIENT_LABEL}</option>
          ) : null}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          autoComplete="off"
          required
          aria-required="true"
          disabled={disabled}
          value={values.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-provider`}>Provider name (optional)</Label>
        <Input
          id={`${idPrefix}-provider`}
          name="providerName"
          autoComplete="off"
          maxLength={MAX_PROVIDER_LENGTH}
          disabled={disabled}
          value={values.providerName}
          onChange={(event) => onChange({ providerName: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-location`}>Location (optional)</Label>
        <Input
          id={`${idPrefix}-location`}
          name="location"
          autoComplete="off"
          maxLength={MAX_LOCATION_LENGTH}
          disabled={disabled}
          value={values.location}
          onChange={(event) => onChange({ location: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-scheduled`}>Scheduled date and time</Label>
        <Input
          id={`${idPrefix}-scheduled`}
          name="scheduledAt"
          type="datetime-local"
          required
          aria-required="true"
          disabled={disabled}
          value={values.scheduledAt}
          onChange={(event) => onChange({ scheduledAt: event.target.value })}
        />
      </div>
    </>
  );
}

export default function AppointmentsPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  const [createValues, setCreateValues] = useState<AppointmentFormValues>(EMPTY_FORM);
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<AppointmentFormValues>(EMPTY_FORM);
  const [editValidation, setEditValidation] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const appointmentsQuery = useQuery({
    queryKey: dashboardKeys.appointmentRecords(selectedFamilyId),
    queryFn: () => fetchAppointmentRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipientsQuery = useQuery({
    queryKey: dashboardKeys.recipientRecords(selectedFamilyId),
    queryFn: () => fetchCareRecipientRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipients = useMemo<RecipientOption[]>(
    () => (recipientsQuery.data ?? []).map((record) => ({ id: record.id, fullName: record.fullName })),
    [recipientsQuery.data],
  );
  const recipientNames = useMemo(
    () => new Map<string, string>(recipients.map((recipient): [string, string] => [recipient.id, recipient.fullName])),
    [recipients],
  );

  function invalidateAppointmentData(familyId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.appointmentRecords(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => createAppointment(input),
    onSuccess: (_appointment, input) => invalidateAppointmentData(input.familyId),
  });

  const updateMutation = useMutation({
    mutationFn: (variables: UpdateVariables) => updateAppointment(variables.id, variables.input),
    onSuccess: (_appointment, variables) => invalidateAppointmentData(variables.familyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (variables: DeleteVariables) => deleteAppointment(variables.id),
    onSuccess: (_result, variables) => invalidateAppointmentData(variables.familyId),
  });

  const rowsLocked = updateMutation.isPending || deleteMutation.isPending;
  const canCreate = recipientsQuery.isSuccess && recipients.length > 0;

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateForm(createValues);
    setCreateValidation(validation);
    if (validation) {
      return;
    }
    try {
      await createMutation.mutateAsync({
        familyId: selectedFamilyId,
        careRecipientId: createValues.careRecipientId,
        title: createValues.title.trim(),
        providerName: toNullableText(createValues.providerName),
        location: toNullableText(createValues.location),
        scheduledAt: toIsoString(createValues.scheduledAt),
        status: createValues.status,
        notes: toNullableText(createValues.notes),
      });
      setCreateValues(EMPTY_FORM);
    } catch {
      // The failure is shown through createMutation.error.
    }
  }

  function startEdit(appointment: AppointmentRecord): void {
    setEditingId(appointment.id);
    setEditValues(toEditValues(appointment));
    setEditValidation(null);
    setConfirmingDeleteId(null);
    updateMutation.reset();
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditValidation(null);
  }

  async function handleSave(appointment: AppointmentRecord, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateForm(editValues);
    setEditValidation(validation);
    if (validation) {
      return;
    }
    const update = buildUpdate(appointment, editValues);
    if (Object.keys(update).length === 0) {
      setEditingId(null);
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: appointment.id, familyId: appointment.familyId, input: update });
      setEditingId(null);
    } catch {
      // The failure is shown in the row through updateMutation.error.
    }
  }

  async function handleStatusChange(appointment: AppointmentRecord, status: AppointmentStatusValue): Promise<void> {
    try {
      await updateMutation.mutateAsync({
        id: appointment.id,
        familyId: appointment.familyId,
        input: { status },
      });
    } catch {
      // The failure is shown in the row through updateMutation.error.
    }
  }

  function startDelete(id: string): void {
    setConfirmingDeleteId(id);
    setEditingId(null);
    deleteMutation.reset();
  }

  function cancelDelete(): void {
    setConfirmingDeleteId(null);
  }

  async function handleDelete(appointment: AppointmentRecord): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ id: appointment.id, familyId: appointment.familyId });
      setConfirmingDeleteId(null);
    } catch {
      // The failure is shown in the row through deleteMutation.error.
    }
  }

  const createError =
    createValidation ?? (createMutation.isError ? messageOf(createMutation.error) : null);

  let recipientNotice: JSX.Element | null = null;
  if (recipientsQuery.isError) {
    recipientNotice = (
      <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t load care recipients.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void recipientsQuery.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else if (recipientsQuery.isSuccess && recipients.length === 0) {
    recipientNotice = (
      <p className="text-sm text-slate-700">
        Add a care recipient before scheduling an appointment.{" "}
        <Link
          href="/dashboard/care-recipients"
          className="font-medium text-teal-800 underline underline-offset-2"
        >
          Go to care recipients
        </Link>
      </p>
    );
  }

  let appointmentsContent: JSX.Element;
  if (appointmentsQuery.isPending) {
    appointmentsContent = <DashboardSkeleton />;
  } else if (appointmentsQuery.isError) {
    appointmentsContent = (
      <ErrorState
        message="We couldn't load appointments. Check your connection and try again."
        onRetry={() => {
          void appointmentsQuery.refetch();
        }}
      />
    );
  } else if (appointmentsQuery.data.length === 0) {
    appointmentsContent = (
      <EmptyState
        icon={CalendarDays}
        title="No appointments yet"
        description="Schedule the first appointment using the form below."
      />
    );
  } else {
    appointmentsContent = (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Appointments in this family</CardTitle>
          <CardDescription>
            {appointmentsQuery.data.length}{" "}
            {appointmentsQuery.data.length === 1 ? "appointment" : "appointments"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointmentsQuery.data.map((appointment) => {
            const isEditing = editingId === appointment.id;
            const isConfirming = confirmingDeleteId === appointment.id;
            const savingThisRow =
              isEditing && updateMutation.isPending && updateMutation.variables?.id === appointment.id;
            const deletingThisRow =
              isConfirming && deleteMutation.isPending && deleteMutation.variables?.id === appointment.id;
            const rowUpdateFailed =
              updateMutation.isError && updateMutation.variables?.id === appointment.id;
            const editError =
              editValidation ?? (isEditing && rowUpdateFailed ? messageOf(updateMutation.error) : null);
            const statusError =
              !isEditing && rowUpdateFailed ? messageOf(updateMutation.error) : null;
            const rowUpdated =
              !isEditing && updateMutation.isSuccess && updateMutation.variables?.id === appointment.id;
            const deleteError =
              isConfirming && deleteMutation.isError && deleteMutation.variables?.id === appointment.id
                ? messageOf(deleteMutation.error)
                : null;
            const recipientName =
              recipientNames.get(appointment.careRecipientId) ?? UNKNOWN_RECIPIENT_LABEL;

            return (
              <div key={appointment.id} className="rounded-xl border border-slate-200 p-4">
                {isEditing ? (
                  <form
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      void handleSave(appointment, event);
                    }}
                  >
                    <AppointmentFields
                      idPrefix={`edit-${appointment.id}`}
                      values={editValues}
                      disabled={savingThisRow}
                      recipients={recipients}
                      onChange={(patch) => {
                        setEditValues((current) => ({ ...current, ...patch }));
                        setEditValidation(null);
                      }}
                    />
                    {editError ? (
                      <p role="alert" className="text-sm text-red-700">
                        {editError}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={savingThisRow}>
                        {savingThisRow ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingThisRow}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : isConfirming ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-slate-900">
                      Delete {appointment.title}? This cannot be undone.
                    </p>
                    {deleteError ? (
                      <p role="alert" className="text-sm text-red-700">
                        {deleteError}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deletingThisRow}
                        onClick={() => {
                          void handleDelete(appointment);
                        }}
                      >
                        Confirm delete
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingThisRow}
                        onClick={cancelDelete}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <h3 className="break-words text-base font-semibold text-slate-900">
                        {appointment.title}
                      </h3>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">
                          {labelOf(STATUS_OPTIONS, appointment.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">Care recipient: {recipientName}</p>
                      {appointment.providerName ? (
                        <p className="break-words text-sm text-slate-600">
                          Provider: {appointment.providerName}
                        </p>
                      ) : null}
                      {appointment.location ? (
                        <p className="break-words text-sm text-slate-600">
                          Location: {appointment.location}
                        </p>
                      ) : null}
                      <p className="text-sm text-slate-600">
                        When: {formatScheduledAt(appointment.scheduledAt)}
                      </p>
                      {statusError ? (
                        <p role="alert" className="text-sm text-red-700">
                          {statusError}
                        </p>
                      ) : null}
                      {rowUpdated ? (
                        <p role="status" className="text-sm text-teal-800">
                          Appointment updated.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <select
                        aria-label={`Status for ${appointment.title}`}
                        disabled={rowsLocked}
                        value={appointment.status}
                        onChange={(event) => {
                          const status = toStatus(event.target.value);
                          if (status) {
                            void handleStatusChange(appointment, status);
                          }
                        }}
                        className={SELECT_CLASS}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${appointment.title}`}
                        disabled={rowsLocked}
                        onClick={() => startEdit(appointment)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Delete ${appointment.title}`}
                        disabled={rowsLocked}
                        onClick={() => startDelete(appointment.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Appointments</h1>
        <p className="text-sm text-slate-600">
          Schedule and track care appointments for the {familyName}.
        </p>
      </section>

      {familiesError ? (
        <ErrorState
          message="We couldn't load your families. Check your connection and try again."
          onRetry={refetchFamilies}
        />
      ) : familiesLoading ? (
        <DashboardSkeleton />
      ) : !selectedFamilyId ? (
        <EmptyState
          icon={CalendarDays}
          title="No family selected"
          description="Create or select a family on the dashboard to manage appointments."
          action={
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-slate-900 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Go to dashboard
            </Link>
          }
        />
      ) : (
        <>
          {appointmentsContent}

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Schedule an appointment</CardTitle>
              <CardDescription>
                Choose a care recipient, a date and time, and optionally a provider and location. Notes
                are saved with the appointment but are not shown in this list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                className="flex max-w-xl flex-col gap-4"
                onSubmit={(event) => {
                  void handleCreate(event);
                }}
              >
                {recipientNotice}
                <AppointmentFields
                  idPrefix="create"
                  values={createValues}
                  disabled={createMutation.isPending}
                  recipients={recipients}
                  onChange={(patch) => {
                    setCreateValues((current) => ({ ...current, ...patch }));
                    setCreateValidation(null);
                  }}
                />
                <div className="grid gap-2">
                  <Label htmlFor="create-status">Status</Label>
                  <select
                    id="create-status"
                    name="status"
                    disabled={createMutation.isPending}
                    value={createValues.status}
                    onChange={(event) => {
                      const status = toStatus(event.target.value);
                      if (status) {
                        setCreateValues((current) => ({ ...current, status }));
                      }
                    }}
                    className={SELECT_CLASS}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-notes">Notes (optional)</Label>
                  <textarea
                    id="create-notes"
                    name="notes"
                    maxLength={MAX_NOTES_LENGTH}
                    rows={3}
                    disabled={createMutation.isPending}
                    value={createValues.notes}
                    onChange={(event) => {
                      const notes = event.target.value;
                      setCreateValues((current) => ({ ...current, notes }));
                      setCreateValidation(null);
                    }}
                    className={TEXTAREA_CLASS}
                  />
                </div>
                {createError ? (
                  <p role="alert" className="text-sm text-red-700">
                    {createError}
                  </p>
                ) : null}
                {createMutation.isSuccess && !createMutation.isPending ? (
                  <p role="status" className="text-sm text-teal-800">
                    Appointment scheduled.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !canCreate}
                  className="w-fit"
                >
                  {createMutation.isPending ? "Scheduling…" : "Schedule appointment"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
