<<<<<<< HEAD
﻿export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Care Recipients</h1>
      <p className="mt-2 text-slate-600">
        Care Recipients module is ready for implementation.
      </p>
    </div>
  );
}

=======
"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  createCareRecipient,
  dashboardKeys,
  deleteCareRecipient,
  fetchCareRecipientRecords,
  updateCareRecipient,
} from "@/lib/dashboard/queries";
import type { CareRecipientRecord } from "@/lib/dashboard/types";

const MAX_NAME_LENGTH = 160;
const MAX_NOTES_LENGTH = 5000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface RecordFormValues {
  fullName: string;
  dateOfBirth: string;
  notes: string;
}

interface CreateInput {
  familyId: string;
  fullName: string;
  dateOfBirth: string | null;
  notes: string | null;
}

interface UpdateInput {
  fullName?: string;
  dateOfBirth?: string | null;
  notes?: string | null;
}

interface UpdateVariables {
  id: string;
  familyId: string;
  input: UpdateInput;
}

interface DeleteVariables {
  id: string;
  familyId: string;
}

const EMPTY_VALUES: RecordFormValues = { fullName: "", dateOfBirth: "", notes: "" };

function validateForm(values: RecordFormValues): string | null {
  const name = values.fullName.trim();
  if (name.length === 0) {
    return "Enter a full name.";
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Full name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }
  if (values.dateOfBirth !== "" && !DATE_PATTERN.test(values.dateOfBirth)) {
    return "Enter a valid date of birth.";
  }
  if (values.notes.length > MAX_NOTES_LENGTH) {
    return `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  }
  return null;
}

function toDateOrNull(value: string): string | null {
  return value === "" ? null : value;
}

function toNotesOrNull(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

function toFormValues(record: CareRecipientRecord): RecordFormValues {
  return {
    fullName: record.fullName,
    dateOfBirth: record.dateOfBirth ?? "",
    notes: record.notes ?? "",
  };
}

/** Returns only the fields whose trimmed/normalised value differs from the stored record. */
function buildUpdate(record: CareRecipientRecord, values: RecordFormValues): UpdateInput {
  const update: UpdateInput = {};
  const name = values.fullName.trim();
  if (name !== record.fullName) {
    update.fullName = name;
  }
  const dateOfBirth = toDateOrNull(values.dateOfBirth);
  if (dateOfBirth !== record.dateOfBirth) {
    update.dateOfBirth = dateOfBirth;
  }
  const notes = toNotesOrNull(values.notes);
  if (notes !== toNotesOrNull(record.notes ?? "")) {
    update.notes = notes;
  }
  return update;
}

/** Formats a stored YYYY-MM-DD as a local date, avoiding the UTC shift of `new Date(string)`. */
function formatDateOfBirth(value: string | null): string {
  if (!value || !DATE_PATTERN.test(value)) {
    return "Not recorded";
  }
  const date = new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
  return date.toLocaleDateString();
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

interface RecordFieldsProps {
  idPrefix: string;
  values: RecordFormValues;
  disabled: boolean;
  onChange: (field: keyof RecordFormValues, value: string) => void;
}

function RecordFields({ idPrefix, values, disabled, onChange }: RecordFieldsProps): JSX.Element {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Full name</Label>
        <Input
          id={`${idPrefix}-name`}
          name="fullName"
          autoComplete="off"
          required
          aria-required="true"
          disabled={disabled}
          value={values.fullName}
          onChange={(event) => onChange("fullName", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-dob`}>Date of birth (optional)</Label>
        <Input
          id={`${idPrefix}-dob`}
          name="dateOfBirth"
          type="date"
          disabled={disabled}
          value={values.dateOfBirth}
          onChange={(event) => onChange("dateOfBirth", event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
        <textarea
          id={`${idPrefix}-notes`}
          name="notes"
          maxLength={MAX_NOTES_LENGTH}
          rows={3}
          disabled={disabled}
          value={values.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className="flex min-h-[4.5rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </>
  );
}

export default function CareRecipientsPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  const [createValues, setCreateValues] = useState<RecordFormValues>(EMPTY_VALUES);
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<RecordFormValues>(EMPTY_VALUES);
  const [editValidation, setEditValidation] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const recordsQuery = useQuery({
    queryKey: dashboardKeys.recipientRecords(selectedFamilyId),
    queryFn: () => fetchCareRecipientRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  function invalidateRecipientData(familyId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recipientRecords(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recipients(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateInput) => createCareRecipient(input),
    onSuccess: (_record, input) => invalidateRecipientData(input.familyId),
  });

  const updateMutation = useMutation({
    mutationFn: (variables: UpdateVariables) => updateCareRecipient(variables.id, variables.input),
    onSuccess: (_record, variables) => invalidateRecipientData(variables.familyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (variables: DeleteVariables) => deleteCareRecipient(variables.id),
    onSuccess: (_result, variables) => invalidateRecipientData(variables.familyId),
  });

  const rowsLocked = updateMutation.isPending || deleteMutation.isPending;

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
        fullName: createValues.fullName.trim(),
        dateOfBirth: toDateOrNull(createValues.dateOfBirth),
        notes: toNotesOrNull(createValues.notes),
      });
      setCreateValues(EMPTY_VALUES);
    } catch {
      // The failure is shown through createMutation.error.
    }
  }

  function startEdit(record: CareRecipientRecord): void {
    setEditingId(record.id);
    setEditValues(toFormValues(record));
    setEditValidation(null);
    setConfirmingDeleteId(null);
    updateMutation.reset();
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditValidation(null);
  }

  async function handleSave(record: CareRecipientRecord, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateForm(editValues);
    setEditValidation(validation);
    if (validation) {
      return;
    }
    const update = buildUpdate(record, editValues);
    if (Object.keys(update).length === 0) {
      setEditingId(null);
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: record.id, familyId: record.familyId, input: update });
      setEditingId(null);
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

  async function handleDelete(record: CareRecipientRecord): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ id: record.id, familyId: record.familyId });
      setConfirmingDeleteId(null);
    } catch {
      // The failure is shown in the row through deleteMutation.error.
    }
  }

  const createError = createValidation ?? (createMutation.isError ? messageOf(createMutation.error) : null);

  let recordsContent: JSX.Element;
  if (recordsQuery.isPending) {
    recordsContent = <DashboardSkeleton />;
  } else if (recordsQuery.isError) {
    recordsContent = (
      <ErrorState
        message="We couldn't load care recipients. Check your connection and try again."
        onRetry={() => {
          void recordsQuery.refetch();
        }}
      />
    );
  } else if (recordsQuery.data.length === 0) {
    recordsContent = (
      <EmptyState
        icon={HeartHandshake}
        title="No care recipients yet"
        description="Add the first care recipient using the form below."
      />
    );
  } else {
    recordsContent = (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Care recipients in this family</CardTitle>
          <CardDescription>
            {recordsQuery.data.length} {recordsQuery.data.length === 1 ? "record" : "records"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recordsQuery.data.map((record) => {
            const isEditing = editingId === record.id;
            const isConfirming = confirmingDeleteId === record.id;
            const savingThisRow = isEditing && updateMutation.isPending;
            const deletingThisRow = isConfirming && deleteMutation.isPending;
            const editError =
              editValidation ??
              (isEditing && updateMutation.isError ? messageOf(updateMutation.error) : null);
            const deleteError =
              isConfirming && deleteMutation.isError ? messageOf(deleteMutation.error) : null;

            return (
              <div key={record.id} className="rounded-xl border border-slate-200 p-4">
                {isEditing ? (
                  <form
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      void handleSave(record, event);
                    }}
                  >
                    <RecordFields
                      idPrefix={`edit-${record.id}`}
                      values={editValues}
                      disabled={savingThisRow}
                      onChange={(field, value) => {
                        setEditValues((current) => ({ ...current, [field]: value }));
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
                      Delete {record.fullName}? This cannot be undone.
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
                          void handleDelete(record);
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
                      <h3 className="text-base font-semibold text-slate-900">{record.fullName}</h3>
                      <p className="text-sm text-slate-600">
                        Date of birth: {formatDateOfBirth(record.dateOfBirth)}
                      </p>
                      <p className="whitespace-pre-line break-words text-sm text-slate-600">
                        {record.notes?.trim() ? record.notes : "No notes"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${record.fullName}`}
                        disabled={rowsLocked}
                        onClick={() => startEdit(record)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Delete ${record.fullName}`}
                        disabled={rowsLocked}
                        onClick={() => startDelete(record.id)}
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Care recipients</h1>
        <p className="text-sm text-slate-600">
          Manage the people receiving care in the {familyName}.
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
          icon={HeartHandshake}
          title="No family selected"
          description="Create or select a family on the dashboard to manage care recipients."
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
          {recordsContent}

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Add a care recipient</CardTitle>
              <CardDescription>Record the name, and optionally a date of birth and notes.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                className="flex max-w-xl flex-col gap-4"
                onSubmit={(event) => {
                  void handleCreate(event);
                }}
              >
                <RecordFields
                  idPrefix="create"
                  values={createValues}
                  disabled={createMutation.isPending}
                  onChange={(field, value) => {
                    setCreateValues((current) => ({ ...current, [field]: value }));
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
                    Care recipient added.
                  </p>
                ) : null}
                <Button type="submit" disabled={createMutation.isPending} className="w-fit">
                  {createMutation.isPending ? "Adding…" : "Add care recipient"}
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
