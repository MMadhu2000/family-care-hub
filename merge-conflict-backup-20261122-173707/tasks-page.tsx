<<<<<<< HEAD
﻿export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
      <p className="mt-2 text-slate-600">
        Tasks module is ready for implementation.
      </p>
    </div>
  );
}

=======
"use client";

import type { FormEvent, JSX } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  createTask,
  dashboardKeys,
  deleteTask,
  fetchCareRecipientRecords,
  fetchFamilyMemberOptions,
  fetchTaskRecords,
  updateTask,
} from "@/lib/dashboard/queries";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/dashboard/queries";
import type {
  RecipientOption,
  TaskAssigneeOption,
  TaskRecord,
  TaskRecordPriority,
  TaskRecordStatus,
} from "@/lib/dashboard/types";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const UNASSIGNED_LABEL = "Unassigned";
const UNKNOWN_ASSIGNEE_LABEL = "Family member";
const UNKNOWN_RECIPIENT_LABEL = "Unknown care recipient";
const NO_DUE_DATE_LABEL = "No due date";

const STATUS_OPTIONS: readonly { value: TaskRecordStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTIONS: readonly { value: TaskRecordPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const SELECT_CLASS =
  "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "flex min-h-[4.5rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

interface TaskFormValues {
  title: string;
  description: string;
  careRecipientId: string;
  priority: TaskRecordPriority;
  dueAt: string;
  assignedTo: string;
}

const EMPTY_FORM: TaskFormValues = {
  title: "",
  description: "",
  careRecipientId: "",
  priority: "MEDIUM",
  dueAt: "",
  assignedTo: "",
};

interface UpdateVariables {
  id: string;
  familyId: string;
  input: UpdateTaskInput;
}

interface DeleteVariables {
  id: string;
  familyId: string;
}

function labelOf<T extends string>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function toStatus(value: string): TaskRecordStatus | null {
  return STATUS_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

function toPriority(value: string): TaskRecordPriority | null {
  return PRIORITY_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

function validateForm(values: TaskFormValues): string | null {
  const title = values.title.trim();
  if (title.length === 0) {
    return "Enter a title.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  if (values.description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }
  if (values.careRecipientId === "") {
    return "Choose a care recipient.";
  }
  if (values.dueAt !== "" && Number.isNaN(Date.parse(values.dueAt))) {
    return "Enter a valid due date and time.";
  }
  return null;
}

/** Empty or whitespace-only text is stored as null. */
function toNullableText(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

/** Converts a validated datetime-local value to an ISO 8601 string. */
function toIsoOrNull(value: string): string | null {
  return value === "" ? null : new Date(value).toISOString();
}

/** Formats a stored ISO timestamp for a datetime-local input, in local time. */
function toDateTimeLocal(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDueAt(iso: string | null): string {
  if (!iso) {
    return NO_DUE_DATE_LABEL;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NO_DUE_DATE_LABEL : date.toLocaleString();
}

function toEditValues(task: TaskRecord): TaskFormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    careRecipientId: task.careRecipientId,
    priority: task.priority,
    dueAt: toDateTimeLocal(task.dueAt),
    assignedTo: task.assignedTo ?? "",
  };
}

/** Returns only the fields that differ from the stored task. */
function buildUpdate(task: TaskRecord, values: TaskFormValues): UpdateTaskInput {
  const initial = toEditValues(task);
  const update: UpdateTaskInput = {};
  const title = values.title.trim();
  if (title !== task.title) {
    update.title = title;
  }
  if (toNullableText(values.description) !== toNullableText(initial.description)) {
    update.description = toNullableText(values.description);
  }
  if (values.careRecipientId !== initial.careRecipientId) {
    update.careRecipientId = values.careRecipientId;
  }
  if (values.priority !== initial.priority) {
    update.priority = values.priority;
  }
  if (values.dueAt !== initial.dueAt) {
    update.dueAt = toIsoOrNull(values.dueAt);
  }
  if (values.assignedTo !== initial.assignedTo) {
    update.assignedTo = values.assignedTo === "" ? null : values.assignedTo;
  }
  return update;
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

interface TaskFieldsProps {
  idPrefix: string;
  values: TaskFormValues;
  disabled: boolean;
  recipients: RecipientOption[];
  members: TaskAssigneeOption[];
  onChange: (patch: Partial<TaskFormValues>) => void;
}

function TaskFields({
  idPrefix,
  values,
  disabled,
  recipients,
  members,
  onChange,
}: TaskFieldsProps): JSX.Element {
  const recipientKnown = recipients.some((recipient) => recipient.id === values.careRecipientId);
  const assigneeKnown = members.some((member) => member.userId === values.assignedTo);

  return (
    <>
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
        <Label htmlFor={`${idPrefix}-description`}>Description (optional)</Label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
          disabled={disabled}
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
        <select
          id={`${idPrefix}-priority`}
          name="priority"
          disabled={disabled}
          value={values.priority}
          onChange={(event) => {
            const priority = toPriority(event.target.value);
            if (priority) {
              onChange({ priority });
            }
          }}
          className={SELECT_CLASS}
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-due`}>Due date and time (optional)</Label>
        <Input
          id={`${idPrefix}-due`}
          name="dueAt"
          type="datetime-local"
          disabled={disabled}
          value={values.dueAt}
          onChange={(event) => onChange({ dueAt: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-assignee`}>Assignee (optional)</Label>
        <select
          id={`${idPrefix}-assignee`}
          name="assignedTo"
          disabled={disabled}
          value={values.assignedTo}
          onChange={(event) => onChange({ assignedTo: event.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{UNASSIGNED_LABEL}</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label}
            </option>
          ))}
          {values.assignedTo !== "" && !assigneeKnown ? (
            <option value={values.assignedTo}>{UNKNOWN_ASSIGNEE_LABEL}</option>
          ) : null}
        </select>
      </div>
    </>
  );
}

export default function TasksPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  const [createValues, setCreateValues] = useState<TaskFormValues>(EMPTY_FORM);
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TaskFormValues>(EMPTY_FORM);
  const [editValidation, setEditValidation] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: dashboardKeys.taskRecords(selectedFamilyId),
    queryFn: () => fetchTaskRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipientsQuery = useQuery({
    queryKey: dashboardKeys.recipientRecords(selectedFamilyId),
    queryFn: () => fetchCareRecipientRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const membersQuery = useQuery({
    queryKey: dashboardKeys.memberOptions(selectedFamilyId),
    queryFn: () => fetchFamilyMemberOptions(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipients = useMemo<RecipientOption[]>(
    () => (recipientsQuery.data ?? []).map((record) => ({ id: record.id, fullName: record.fullName })),
    [recipientsQuery.data],
  );
  const members = useMemo<TaskAssigneeOption[]>(() => membersQuery.data ?? [], [membersQuery.data]);
  const recipientNames = useMemo(
    () => new Map<string, string>(recipients.map((recipient): [string, string] => [recipient.id, recipient.fullName])),
    [recipients],
  );
  const memberLabels = useMemo(
    () => new Map<string, string>(members.map((member): [string, string] => [member.userId, member.label])),
    [members],
  );

  function invalidateTaskData(familyId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.taskRecords(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (_task, input) => invalidateTaskData(input.familyId),
  });

  const updateMutation = useMutation({
    mutationFn: (variables: UpdateVariables) => updateTask(variables.id, variables.input),
    onSuccess: (_task, variables) => invalidateTaskData(variables.familyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (variables: DeleteVariables) => deleteTask(variables.id),
    onSuccess: (_result, variables) => invalidateTaskData(variables.familyId),
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
        description: toNullableText(createValues.description),
        priority: createValues.priority,
        assignedTo: createValues.assignedTo === "" ? null : createValues.assignedTo,
        dueAt: toIsoOrNull(createValues.dueAt),
      });
      setCreateValues(EMPTY_FORM);
    } catch {
      // The failure is shown through createMutation.error.
    }
  }

  function startEdit(task: TaskRecord): void {
    setEditingId(task.id);
    setEditValues(toEditValues(task));
    setEditValidation(null);
    setConfirmingDeleteId(null);
    updateMutation.reset();
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditValidation(null);
  }

  async function handleSave(task: TaskRecord, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateForm(editValues);
    setEditValidation(validation);
    if (validation) {
      return;
    }
    const update = buildUpdate(task, editValues);
    if (Object.keys(update).length === 0) {
      setEditingId(null);
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: task.id, familyId: task.familyId, input: update });
      setEditingId(null);
    } catch {
      // The failure is shown in the row through updateMutation.error.
    }
  }

  async function handleStatusChange(task: TaskRecord, status: TaskRecordStatus): Promise<void> {
    try {
      await updateMutation.mutateAsync({ id: task.id, familyId: task.familyId, input: { status } });
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

  async function handleDelete(task: TaskRecord): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ id: task.id, familyId: task.familyId });
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
        Add a care recipient before creating a task.{" "}
        <Link
          href="/dashboard/care-recipients"
          className="font-medium text-teal-800 underline underline-offset-2"
        >
          Go to care recipients
        </Link>
      </p>
    );
  }

  let membersNotice: JSX.Element | null = null;
  if (membersQuery.isError) {
    membersNotice = (
      <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="text-sm text-red-700">
          We couldn&apos;t load family members, so assignees are unavailable.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void membersQuery.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  let tasksContent: JSX.Element;
  if (tasksQuery.isPending) {
    tasksContent = <DashboardSkeleton />;
  } else if (tasksQuery.isError) {
    tasksContent = (
      <ErrorState
        message="We couldn't load tasks. Check your connection and try again."
        onRetry={() => {
          void tasksQuery.refetch();
        }}
      />
    );
  } else if (tasksQuery.data.length === 0) {
    tasksContent = (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Add the first task using the form below."
      />
    );
  } else {
    tasksContent = (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Tasks in this family</CardTitle>
          <CardDescription>
            {tasksQuery.data.length} {tasksQuery.data.length === 1 ? "task" : "tasks"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasksQuery.data.map((task) => {
            const isEditing = editingId === task.id;
            const isConfirming = confirmingDeleteId === task.id;
            const savingThisRow =
              isEditing && updateMutation.isPending && updateMutation.variables?.id === task.id;
            const deletingThisRow =
              isConfirming && deleteMutation.isPending && deleteMutation.variables?.id === task.id;
            const rowUpdateFailed =
              updateMutation.isError && updateMutation.variables?.id === task.id;
            const editError =
              editValidation ?? (isEditing && rowUpdateFailed ? messageOf(updateMutation.error) : null);
            const statusError =
              !isEditing && rowUpdateFailed ? messageOf(updateMutation.error) : null;
            const rowUpdated =
              !isEditing && updateMutation.isSuccess && updateMutation.variables?.id === task.id;
            const deleteError =
              isConfirming && deleteMutation.isError && deleteMutation.variables?.id === task.id
                ? messageOf(deleteMutation.error)
                : null;
            const recipientName = recipientNames.get(task.careRecipientId);
            const assigneeLabel = task.assignedTo
              ? (memberLabels.get(task.assignedTo) ?? UNKNOWN_ASSIGNEE_LABEL)
              : UNASSIGNED_LABEL;

            return (
              <div key={task.id} className="rounded-xl border border-slate-200 p-4">
                {isEditing ? (
                  <form
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      void handleSave(task, event);
                    }}
                  >
                    <TaskFields
                      idPrefix={`edit-${task.id}`}
                      values={editValues}
                      disabled={savingThisRow}
                      recipients={recipients}
                      members={members}
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
                      Delete {task.title}? This cannot be undone.
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
                          void handleDelete(task);
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
                      <h3 className="break-words text-base font-semibold text-slate-900">{task.title}</h3>
                      {task.description ? (
                        <p className="whitespace-pre-line break-words text-sm text-slate-600">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {labelOf(PRIORITY_OPTIONS, task.priority)} priority
                        </span>
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">
                          {labelOf(STATUS_OPTIONS, task.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">Due: {formatDueAt(task.dueAt)}</p>
                      <p className="text-sm text-slate-600">Assignee: {assigneeLabel}</p>
                      {recipientName ? (
                        <p className="text-sm text-slate-600">Care recipient: {recipientName}</p>
                      ) : null}
                      {statusError ? (
                        <p role="alert" className="text-sm text-red-700">
                          {statusError}
                        </p>
                      ) : null}
                      {rowUpdated ? (
                        <p role="status" className="text-sm text-teal-800">
                          Task updated.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <select
                        aria-label={`Status for ${task.title}`}
                        disabled={rowsLocked}
                        value={task.status}
                        onChange={(event) => {
                          const status = toStatus(event.target.value);
                          if (status) {
                            void handleStatusChange(task, status);
                          }
                        }}
                        className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                        aria-label={`Edit ${task.title}`}
                        disabled={rowsLocked}
                        onClick={() => startEdit(task)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Delete ${task.title}`}
                        disabled={rowsLocked}
                        onClick={() => startDelete(task.id)}
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tasks</h1>
        <p className="text-sm text-slate-600">Track and assign care tasks for the {familyName}.</p>
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
          icon={ListTodo}
          title="No family selected"
          description="Create or select a family on the dashboard to manage tasks."
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
          {tasksContent}

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Add a task</CardTitle>
              <CardDescription>
                Choose a care recipient, and optionally set a priority, due date and assignee.
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
                {membersNotice}
                <TaskFields
                  idPrefix="create"
                  values={createValues}
                  disabled={createMutation.isPending}
                  recipients={recipients}
                  members={members}
                  onChange={(patch) => {
                    setCreateValues((current) => ({ ...current, ...patch }));
                    setCreateValidation(null);
                  }}
                />
                {createError ? (
                  <p role="alert" className="text-sm text-red-700">
                    {createError}
                  </p>
                ) : null}
                {createMutation.isSuccess && !createMutation.isPending ? (
                  <p role="status" className="text-sm text-teal-800">
                    Task added.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !canCreate}
                  className="w-fit"
                >
                  {createMutation.isPending ? "Adding…" : "Add task"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
>>>>>>> bb30bd1574a7d28127d9cd835d7b56013e6469dd
