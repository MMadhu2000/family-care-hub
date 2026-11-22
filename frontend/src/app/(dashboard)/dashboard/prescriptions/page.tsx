"use client";

import type { FormEvent, JSX } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pill } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  createPrescription,
  createRefill,
  dashboardKeys,
  deletePrescription,
  deleteRefill,
  fetchCareRecipientRecords,
  fetchPrescriptionRecords,
  fetchRefillRecords,
  updatePrescription,
  updateRefillStatus,
} from "@/lib/dashboard/queries";
import type { CreatePrescriptionInput, UpdatePrescriptionInput } from "@/lib/dashboard/queries";
import type {
  PrescriptionRecord,
  PrescriptionRefillRecord,
  RecipientOption,
  RefillStatusValue,
} from "@/lib/dashboard/types";

const MAX_MEDICATION_NAME_LENGTH = 200;
const MAX_DOSAGE_LENGTH = 200;
const MAX_INSTRUCTIONS_LENGTH = 5000;
const MAX_PRESCRIBED_BY_LENGTH = 200;
const UNKNOWN_RECIPIENT_LABEL = "Unknown care recipient";
const UNKNOWN_DATE_LABEL = "Date unavailable";

const REFILL_STATUS_OPTIONS: readonly { value: RefillStatusValue; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "SKIPPED", label: "Skipped" },
];

const SELECT_CLASS =
  "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "flex min-h-[4.5rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

interface PrescriptionFormValues {
  careRecipientId: string;
  medicationName: string;
  dosage: string;
  instructions: string;
  prescribedBy: string;
  /** YYYY-MM-DD, or "" when empty. */
  startDate: string;
  /** YYYY-MM-DD, or "" when empty. */
  endDate: string;
  active: boolean;
}

const EMPTY_FORM: PrescriptionFormValues = {
  careRecipientId: "",
  medicationName: "",
  dosage: "",
  instructions: "",
  prescribedBy: "",
  startDate: "",
  endDate: "",
  active: true,
};

interface UpdateVariables {
  id: string;
  familyId: string;
  input: UpdatePrescriptionInput;
}

interface DeleteVariables {
  id: string;
  familyId: string;
}

interface RefillCreateVariables {
  familyId: string;
  prescriptionId: string;
  dueAt: string;
}

interface RefillStatusVariables {
  id: string;
  familyId: string;
  prescriptionId: string;
  status: RefillStatusValue;
}

interface RefillDeleteVariables {
  id: string;
  familyId: string;
  prescriptionId: string;
}

function labelOf<T extends string>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function toRefillStatus(value: string): RefillStatusValue | null {
  return REFILL_STATUS_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

/** Compares YYYY-MM-DD strings; the check applies only when both dates are set. */
function isEndBeforeStart(startDate: string, endDate: string): boolean {
  return startDate !== "" && endDate !== "" && endDate < startDate;
}

function validateForm(values: PrescriptionFormValues): string | null {
  if (values.careRecipientId === "") {
    return "Choose a care recipient.";
  }
  const medicationName = values.medicationName.trim();
  if (medicationName.length === 0) {
    return "Enter a medication name.";
  }
  if (medicationName.length > MAX_MEDICATION_NAME_LENGTH) {
    return `Medication name must be ${MAX_MEDICATION_NAME_LENGTH} characters or fewer.`;
  }
  if (values.dosage.trim().length > MAX_DOSAGE_LENGTH) {
    return `Dosage must be ${MAX_DOSAGE_LENGTH} characters or fewer.`;
  }
  if (values.instructions.trim().length > MAX_INSTRUCTIONS_LENGTH) {
    return `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer.`;
  }
  if (values.prescribedBy.trim().length > MAX_PRESCRIBED_BY_LENGTH) {
    return `Prescribed by must be ${MAX_PRESCRIBED_BY_LENGTH} characters or fewer.`;
  }
  if (isEndBeforeStart(values.startDate, values.endDate)) {
    return "End date cannot be before start date.";
  }
  return null;
}

function validateRefillDueAt(value: string): string | null {
  if (value === "" || Number.isNaN(Date.parse(value))) {
    return "Enter a valid due date and time.";
  }
  return null;
}

/** Blank or whitespace-only text is stored as null; otherwise the trimmed value is used. */
function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNullableDate(value: string): string | null {
  return value === "" ? null : value;
}

/** Converts a validated datetime-local value to an ISO 8601 string. */
function toIsoString(value: string): string {
  return new Date(value).toISOString();
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? UNKNOWN_DATE_LABEL : date.toLocaleString();
}

function toFormValues(prescription: PrescriptionRecord): PrescriptionFormValues {
  return {
    careRecipientId: prescription.careRecipientId,
    medicationName: prescription.medicationName,
    dosage: prescription.dosage ?? "",
    instructions: prescription.instructions ?? "",
    prescribedBy: prescription.prescribedBy ?? "",
    startDate: prescription.startDate ?? "",
    endDate: prescription.endDate ?? "",
    active: prescription.active,
  };
}

/** Returns only the fields that differ from the stored prescription. */
function buildUpdate(prescription: PrescriptionRecord, values: PrescriptionFormValues): UpdatePrescriptionInput {
  const update: UpdatePrescriptionInput = {};
  if (values.careRecipientId !== prescription.careRecipientId) {
    update.careRecipientId = values.careRecipientId;
  }
  const medicationName = values.medicationName.trim();
  if (medicationName !== prescription.medicationName) {
    update.medicationName = medicationName;
  }
  const dosage = toNullableText(values.dosage);
  if (dosage !== prescription.dosage) {
    update.dosage = dosage;
  }
  const instructions = toNullableText(values.instructions);
  if (instructions !== prescription.instructions) {
    update.instructions = instructions;
  }
  const prescribedBy = toNullableText(values.prescribedBy);
  if (prescribedBy !== prescription.prescribedBy) {
    update.prescribedBy = prescribedBy;
  }
  const startDate = toNullableDate(values.startDate);
  if (startDate !== prescription.startDate) {
    update.startDate = startDate;
  }
  const endDate = toNullableDate(values.endDate);
  if (endDate !== prescription.endDate) {
    update.endDate = endDate;
  }
  if (values.active !== prescription.active) {
    update.active = values.active;
  }
  return update;
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

interface PrescriptionFieldsProps {
  idPrefix: string;
  values: PrescriptionFormValues;
  disabled: boolean;
  recipients: RecipientOption[];
  onChange: (patch: Partial<PrescriptionFormValues>) => void;
}

/** Fields shared by the create and edit forms. */
function PrescriptionFields({
  idPrefix,
  values,
  disabled,
  recipients,
  onChange,
}: PrescriptionFieldsProps): JSX.Element {
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
        <Label htmlFor={`${idPrefix}-medication`}>Medication name</Label>
        <Input
          id={`${idPrefix}-medication`}
          name="medicationName"
          autoComplete="off"
          required
          aria-required="true"
          maxLength={MAX_MEDICATION_NAME_LENGTH}
          disabled={disabled}
          value={values.medicationName}
          onChange={(event) => onChange({ medicationName: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-dosage`}>Dosage (optional)</Label>
        <Input
          id={`${idPrefix}-dosage`}
          name="dosage"
          autoComplete="off"
          maxLength={MAX_DOSAGE_LENGTH}
          disabled={disabled}
          value={values.dosage}
          onChange={(event) => onChange({ dosage: event.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-instructions`}>Instructions (optional)</Label>
        <textarea
          id={`${idPrefix}-instructions`}
          name="instructions"
          rows={3}
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          disabled={disabled}
          value={values.instructions}
          onChange={(event) => onChange({ instructions: event.target.value })}
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-prescribed-by`}>Prescribed by (optional)</Label>
        <Input
          id={`${idPrefix}-prescribed-by`}
          name="prescribedBy"
          autoComplete="off"
          maxLength={MAX_PRESCRIBED_BY_LENGTH}
          disabled={disabled}
          value={values.prescribedBy}
          onChange={(event) => onChange({ prescribedBy: event.target.value })}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-start-date`}>Start date (optional)</Label>
          <Input
            id={`${idPrefix}-start-date`}
            name="startDate"
            type="date"
            disabled={disabled}
            value={values.startDate}
            onChange={(event) => onChange({ startDate: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-end-date`}>End date (optional)</Label>
          <Input
            id={`${idPrefix}-end-date`}
            name="endDate"
            type="date"
            disabled={disabled}
            value={values.endDate}
            onChange={(event) => onChange({ endDate: event.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-active`}
          name="active"
          type="checkbox"
          disabled={disabled}
          checked={values.active}
          onChange={(event) => onChange({ active: event.target.checked })}
          className="h-4 w-4 rounded border-input accent-teal-700 focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Label htmlFor={`${idPrefix}-active`}>Active</Label>
      </div>
    </>
  );
}

export default function PrescriptionsPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  const [createValues, setCreateValues] = useState<PrescriptionFormValues>(EMPTY_FORM);
  const [createValidation, setCreateValidation] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<PrescriptionFormValues>(EMPTY_FORM);
  const [editValidation, setEditValidation] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  /** The one prescription whose refill panel is open, or null. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingRefillId, setConfirmingRefillId] = useState<string | null>(null);
  const [refillDueAt, setRefillDueAt] = useState<string>("");
  const [refillValidation, setRefillValidation] = useState<string | null>(null);

  const expandedPrescriptionId = expandedId ?? "";

  const prescriptionsQuery = useQuery({
    queryKey: dashboardKeys.prescriptionRecords(selectedFamilyId),
    queryFn: () => fetchPrescriptionRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipientsQuery = useQuery({
    queryKey: dashboardKeys.recipientRecords(selectedFamilyId),
    queryFn: () => fetchCareRecipientRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const refillsQuery = useQuery({
    queryKey: dashboardKeys.refillRecords(expandedPrescriptionId),
    queryFn: () => fetchRefillRecords(expandedPrescriptionId),
    enabled: expandedId !== null,
  });

  const recipients = useMemo<RecipientOption[]>(
    () => (recipientsQuery.data ?? []).map((record) => ({ id: record.id, fullName: record.fullName })),
    [recipientsQuery.data],
  );
  const recipientNames = useMemo(
    () => new Map<string, string>(recipients.map((recipient): [string, string] => [recipient.id, recipient.fullName])),
    [recipients],
  );

  function invalidatePrescriptionData(familyId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.prescriptionRecords(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  function invalidateRefillData(familyId: string, prescriptionId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.refillRecords(prescriptionId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: (input: CreatePrescriptionInput) => createPrescription(input),
    onSuccess: (_prescription, input) => invalidatePrescriptionData(input.familyId),
  });

  const updateMutation = useMutation({
    mutationFn: (variables: UpdateVariables) => updatePrescription(variables.id, variables.input),
    onSuccess: (_prescription, variables) => invalidatePrescriptionData(variables.familyId),
  });

  const deleteMutation = useMutation({
    mutationFn: (variables: DeleteVariables) => deletePrescription(variables.id),
    onSuccess: (_result, variables) => invalidatePrescriptionData(variables.familyId),
  });

  const refillCreateMutation = useMutation({
    mutationFn: (variables: RefillCreateVariables) =>
      createRefill({ prescriptionId: variables.prescriptionId, dueAt: variables.dueAt }),
    onSuccess: (_refill, variables) => invalidateRefillData(variables.familyId, variables.prescriptionId),
  });

  const refillStatusMutation = useMutation({
    mutationFn: (variables: RefillStatusVariables) => updateRefillStatus(variables.id, variables.status),
    onSuccess: (_refill, variables) => invalidateRefillData(variables.familyId, variables.prescriptionId),
  });

  const refillDeleteMutation = useMutation({
    mutationFn: (variables: RefillDeleteVariables) => deleteRefill(variables.id),
    onSuccess: (_result, variables) => invalidateRefillData(variables.familyId, variables.prescriptionId),
  });

  const rowsLocked = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const refillsLocked =
    refillCreateMutation.isPending || refillStatusMutation.isPending || refillDeleteMutation.isPending;
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
        medicationName: createValues.medicationName.trim(),
        dosage: toNullableText(createValues.dosage),
        instructions: toNullableText(createValues.instructions),
        prescribedBy: toNullableText(createValues.prescribedBy),
        startDate: toNullableDate(createValues.startDate),
        endDate: toNullableDate(createValues.endDate),
        active: createValues.active,
      });
      setCreateValues(EMPTY_FORM);
    } catch {
      // The failure is shown through createMutation.error.
    }
  }

  function startEdit(prescription: PrescriptionRecord): void {
    setEditingId(prescription.id);
    setEditValues(toFormValues(prescription));
    setEditValidation(null);
    setConfirmingDeleteId(null);
    updateMutation.reset();
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditValidation(null);
  }

  async function handleSave(prescription: PrescriptionRecord, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateForm(editValues);
    setEditValidation(validation);
    if (validation) {
      return;
    }
    const update = buildUpdate(prescription, editValues);
    if (Object.keys(update).length === 0) {
      setEditingId(null);
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: prescription.id, familyId: prescription.familyId, input: update });
      setEditingId(null);
    } catch {
      // The failure is shown in the row through updateMutation.error.
    }
  }

  async function handleToggleActive(prescription: PrescriptionRecord): Promise<void> {
    try {
      await updateMutation.mutateAsync({
        id: prescription.id,
        familyId: prescription.familyId,
        input: { active: !prescription.active },
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

  async function handleDelete(prescription: PrescriptionRecord): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ id: prescription.id, familyId: prescription.familyId });
      setConfirmingDeleteId(null);
      if (expandedId === prescription.id) {
        setExpandedId(null);
      }
    } catch {
      // The failure is shown in the row through deleteMutation.error.
    }
  }

  function toggleRefills(id: string): void {
    setExpandedId(expandedId === id ? null : id);
    setConfirmingRefillId(null);
    setRefillDueAt("");
    setRefillValidation(null);
    refillCreateMutation.reset();
    refillStatusMutation.reset();
    refillDeleteMutation.reset();
  }

  async function handleAddRefill(prescription: PrescriptionRecord, event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = validateRefillDueAt(refillDueAt);
    setRefillValidation(validation);
    if (validation) {
      return;
    }
    try {
      await refillCreateMutation.mutateAsync({
        familyId: prescription.familyId,
        prescriptionId: prescription.id,
        dueAt: toIsoString(refillDueAt),
      });
      setRefillDueAt("");
    } catch {
      // The failure is shown through refillCreateMutation.error.
    }
  }

  async function handleRefillStatusChange(
    prescription: PrescriptionRecord,
    refill: PrescriptionRefillRecord,
    status: RefillStatusValue,
  ): Promise<void> {
    try {
      await refillStatusMutation.mutateAsync({
        id: refill.id,
        familyId: prescription.familyId,
        prescriptionId: prescription.id,
        status,
      });
    } catch {
      // The failure is shown in the refill row through refillStatusMutation.error.
    }
  }

  function startRefillDelete(id: string): void {
    setConfirmingRefillId(id);
    refillDeleteMutation.reset();
  }

  async function handleRefillDelete(prescription: PrescriptionRecord, refill: PrescriptionRefillRecord): Promise<void> {
    try {
      await refillDeleteMutation.mutateAsync({
        id: refill.id,
        familyId: prescription.familyId,
        prescriptionId: prescription.id,
      });
      setConfirmingRefillId(null);
    } catch {
      // The failure is shown in the refill row through refillDeleteMutation.error.
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
        Add a care recipient before recording a prescription.{" "}
        <Link
          href="/dashboard/care-recipients"
          className="font-medium text-teal-800 underline underline-offset-2"
        >
          Go to care recipients
        </Link>
      </p>
    );
  }

  function renderRefillItem(prescription: PrescriptionRecord, refill: PrescriptionRefillRecord): JSX.Element {
    const due = formatDateTime(refill.dueAt);
    const isConfirming = confirmingRefillId === refill.id;
    const statusError =
      refillStatusMutation.isError && refillStatusMutation.variables?.id === refill.id
        ? messageOf(refillStatusMutation.error)
        : null;
    const statusUpdated =
      refillStatusMutation.isSuccess &&
      !refillStatusMutation.isPending &&
      refillStatusMutation.variables?.id === refill.id;
    const deleteError =
      isConfirming && refillDeleteMutation.isError && refillDeleteMutation.variables?.id === refill.id
        ? messageOf(refillDeleteMutation.error)
        : null;
    const deletingThisRefill =
      isConfirming && refillDeleteMutation.isPending && refillDeleteMutation.variables?.id === refill.id;

    return (
      <li key={refill.id} className="rounded-lg border border-slate-200 p-3">
        {isConfirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-900">Delete refill due {due}? This cannot be undone.</p>
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
                disabled={deletingThisRefill}
                onClick={() => {
                  void handleRefillDelete(prescription, refill);
                }}
              >
                Confirm delete
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingThisRefill}
                onClick={() => setConfirmingRefillId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-medium text-slate-900">Due: {due}</p>
              <p className="text-slate-600">Status: {labelOf(REFILL_STATUS_OPTIONS, refill.status)}</p>
              {refill.completedAt ? (
                <p className="text-slate-600">Completed: {formatDateTime(refill.completedAt)}</p>
              ) : null}
              {statusError ? (
                <p role="alert" className="text-sm text-red-700">
                  {statusError}
                </p>
              ) : null}
              {statusUpdated ? (
                <p role="status" className="text-sm text-teal-800">
                  Refill status updated.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <select
                aria-label={`Status for refill due ${due}`}
                disabled={refillsLocked}
                value={refill.status}
                onChange={(event) => {
                  const status = toRefillStatus(event.target.value);
                  if (status) {
                    void handleRefillStatusChange(prescription, refill, status);
                  }
                }}
                className={SELECT_CLASS}
              >
                {REFILL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Delete refill due ${due}`}
                disabled={refillsLocked}
                onClick={() => startRefillDelete(refill.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </li>
    );
  }

  function renderRefillPanel(prescription: PrescriptionRecord): JSX.Element {
    let refillContent: JSX.Element;
    if (refillsQuery.isPending) {
      refillContent = <p className="text-sm text-slate-600">Loading refills…</p>;
    } else if (refillsQuery.isError) {
      refillContent = (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-red-700">
            We couldn&apos;t load refills.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refillsQuery.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      );
    } else if (refillsQuery.data.length === 0) {
      refillContent = <p className="text-sm text-slate-600">No refills recorded yet.</p>;
    } else {
      refillContent = (
        <ul className="space-y-3">
          {refillsQuery.data.map((refill) => renderRefillItem(prescription, refill))}
        </ul>
      );
    }

    const refillFormError =
      refillValidation ??
      (refillCreateMutation.isError && refillCreateMutation.variables?.prescriptionId === prescription.id
        ? messageOf(refillCreateMutation.error)
        : null);
    const refillAdded =
      refillCreateMutation.isSuccess &&
      !refillCreateMutation.isPending &&
      refillCreateMutation.variables?.prescriptionId === prescription.id;

    return (
      <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-900">Refills for {prescription.medicationName}</h4>
        {refillContent}
        <form
          noValidate
          className="flex max-w-md flex-col gap-3"
          onSubmit={(event) => {
            void handleAddRefill(prescription, event);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={`refill-due-${prescription.id}`}>Due date and time</Label>
            <Input
              id={`refill-due-${prescription.id}`}
              name="refillDueAt"
              type="datetime-local"
              required
              aria-required="true"
              disabled={refillCreateMutation.isPending}
              value={refillDueAt}
              onChange={(event) => {
                setRefillDueAt(event.target.value);
                setRefillValidation(null);
              }}
            />
          </div>
          {refillFormError ? (
            <p role="alert" className="text-sm text-red-700">
              {refillFormError}
            </p>
          ) : null}
          {refillAdded ? (
            <p role="status" className="text-sm text-teal-800">
              Refill added.
            </p>
          ) : null}
          <Button type="submit" size="sm" disabled={refillCreateMutation.isPending} className="w-fit">
            {refillCreateMutation.isPending ? "Adding…" : "Add refill"}
          </Button>
        </form>
      </div>
    );
  }

  let prescriptionsContent: JSX.Element;
  if (prescriptionsQuery.isPending) {
    prescriptionsContent = <DashboardSkeleton />;
  } else if (prescriptionsQuery.isError) {
    prescriptionsContent = (
      <ErrorState
        message="We couldn't load prescriptions. Check your connection and try again."
        onRetry={() => {
          void prescriptionsQuery.refetch();
        }}
      />
    );
  } else if (prescriptionsQuery.data.length === 0) {
    prescriptionsContent = (
      <EmptyState
        icon={Pill}
        title="No prescriptions yet"
        description="Record the first prescription using the form below."
      />
    );
  } else {
    prescriptionsContent = (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Prescriptions in this family</CardTitle>
          <CardDescription>
            {prescriptionsQuery.data.length}{" "}
            {prescriptionsQuery.data.length === 1 ? "prescription" : "prescriptions"}. Only one
            prescription&apos;s refills are open at a time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {prescriptionsQuery.data.map((prescription) => {
            const name = prescription.medicationName;
            const isEditing = editingId === prescription.id;
            const isConfirming = confirmingDeleteId === prescription.id;
            const isExpanded = expandedId === prescription.id;
            const savingThisRow =
              isEditing && updateMutation.isPending && updateMutation.variables?.id === prescription.id;
            const deletingThisRow =
              isConfirming && deleteMutation.isPending && deleteMutation.variables?.id === prescription.id;
            const rowUpdateFailed =
              updateMutation.isError && updateMutation.variables?.id === prescription.id;
            const editError =
              editValidation ?? (isEditing && rowUpdateFailed ? messageOf(updateMutation.error) : null);
            const rowError = !isEditing && rowUpdateFailed ? messageOf(updateMutation.error) : null;
            const rowUpdated =
              !isEditing && updateMutation.isSuccess && updateMutation.variables?.id === prescription.id;
            const deleteError =
              isConfirming && deleteMutation.isError && deleteMutation.variables?.id === prescription.id
                ? messageOf(deleteMutation.error)
                : null;
            const recipientName = recipientNames.get(prescription.careRecipientId) ?? UNKNOWN_RECIPIENT_LABEL;

            return (
              <div key={prescription.id} className="rounded-xl border border-slate-200 p-4">
                {isEditing ? (
                  <form
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(event) => {
                      void handleSave(prescription, event);
                    }}
                  >
                    <PrescriptionFields
                      idPrefix={`edit-${prescription.id}`}
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
                    <p className="text-sm text-slate-900">Delete {name}? This cannot be undone.</p>
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
                          void handleDelete(prescription);
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
                      <h3 className="break-words text-base font-semibold text-slate-900">{name}</h3>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <span
                          className={
                            prescription.active
                              ? "rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800"
                              : "rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700"
                          }
                        >
                          {prescription.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">Care recipient: {recipientName}</p>
                      {prescription.dosage ? (
                        <p className="break-words text-sm text-slate-600">Dosage: {prescription.dosage}</p>
                      ) : null}
                      {prescription.instructions ? (
                        <p className="break-words text-sm text-slate-600">
                          Instructions: {prescription.instructions}
                        </p>
                      ) : null}
                      {prescription.prescribedBy ? (
                        <p className="break-words text-sm text-slate-600">
                          Prescribed by: {prescription.prescribedBy}
                        </p>
                      ) : null}
                      {prescription.startDate ? (
                        <p className="text-sm text-slate-600">Start: {prescription.startDate}</p>
                      ) : null}
                      {prescription.endDate ? (
                        <p className="text-sm text-slate-600">End: {prescription.endDate}</p>
                      ) : null}
                      {rowError ? (
                        <p role="alert" className="text-sm text-red-700">
                          {rowError}
                        </p>
                      ) : null}
                      {rowUpdated ? (
                        <p role="status" className="text-sm text-teal-800">
                          Prescription updated.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${name}`}
                        disabled={rowsLocked}
                        onClick={() => startEdit(prescription)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${prescription.active ? "Deactivate" : "Activate"} ${name}`}
                        disabled={rowsLocked}
                        onClick={() => {
                          void handleToggleActive(prescription);
                        }}
                      >
                        {prescription.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`${isExpanded ? "Hide" : "View"} refills ${name}`}
                        aria-expanded={isExpanded}
                        onClick={() => toggleRefills(prescription.id)}
                      >
                        {isExpanded ? "Hide refills" : "View refills"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Delete ${name}`}
                        disabled={rowsLocked}
                        onClick={() => startDelete(prescription.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
                {isExpanded ? renderRefillPanel(prescription) : null}
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Prescriptions</h1>
        <p className="text-sm text-slate-600">
          Keep records of prescriptions and refills for the {familyName}.
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
          icon={Pill}
          title="No family selected"
          description="Create or select a family on the dashboard to manage prescriptions."
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
          {prescriptionsContent}

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Record a prescription</CardTitle>
              <CardDescription>
                Choose a care recipient and enter the medication name. The other fields are optional.
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
                <PrescriptionFields
                  idPrefix="create"
                  values={createValues}
                  disabled={createMutation.isPending}
                  recipients={recipients}
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
                    Prescription recorded.
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !canCreate}
                  className="w-fit"
                >
                  {createMutation.isPending ? "Saving…" : "Record prescription"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
