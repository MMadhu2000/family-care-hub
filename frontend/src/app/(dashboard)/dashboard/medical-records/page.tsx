"use client";

import type { FormEvent, JSX } from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  createMedicalRecord,
  dashboardKeys,
  deleteMedicalRecord,
  fetchCareRecipientRecords,
  fetchMedicalRecordRecords,
  getMedicalRecordSignedUrl,
  MEDICAL_DOCUMENT_MAX_BYTES,
  MEDICAL_DOCUMENT_MIME_TYPES,
  uploadMedicalDocument,
} from "@/lib/dashboard/queries";
import type {
  MedicalRecordMimeType,
  MedicalRecordRecord,
  MedicalRecordType,
  RecipientOption,
} from "@/lib/dashboard/types";

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 5000;
const MAX_FILE_NAME_LENGTH = 255;
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const UNKNOWN_RECIPIENT_LABEL = "Unknown care recipient";
const UNKNOWN_DATE_LABEL = "Date unavailable";
const SAVE_AFTER_UPLOAD_MESSAGE = "The file was uploaded but the record could not be saved. Try again.";
const ACCEPT_ATTRIBUTE = MEDICAL_DOCUMENT_MIME_TYPES.join(",");

const RECORD_TYPE_OPTIONS: readonly { value: MedicalRecordType; label: string }[] = [
  { value: "LAB_REPORT", label: "Lab report" },
  { value: "PRESCRIPTION", label: "Prescription document" },
  { value: "DISCHARGE_SUMMARY", label: "Discharge summary" },
  { value: "IMAGING", label: "Imaging" },
  { value: "OTHER", label: "Other" },
];

const SELECT_CLASS =
  "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTAREA_CLASS =
  "flex min-h-[4.5rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const FILE_INPUT_CLASS =
  "block w-full min-w-0 text-sm text-slate-900 file:mr-3 file:rounded-lg file:border file:border-input file:bg-transparent file:px-2.5 file:py-1 file:text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

interface UploadFormValues {
  careRecipientId: string;
  title: string;
  recordType: MedicalRecordType;
  notes: string;
}

const EMPTY_FORM: UploadFormValues = {
  careRecipientId: "",
  title: "",
  recordType: "OTHER",
  notes: "",
};

interface UploadVariables {
  familyId: string;
  careRecipientId: string;
  title: string;
  recordType: MedicalRecordType;
  notes: string;
  file: File;
  fileName: string | null;
  mimeType: MedicalRecordMimeType;
}

function labelOf<T extends string>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function isAllowedMimeType(value: string | undefined): value is MedicalRecordMimeType {
  return value !== undefined && (MEDICAL_DOCUMENT_MIME_TYPES as readonly string[]).includes(value);
}

function validateUpload(values: UploadFormValues, file: File | null): string | null {
  if (values.careRecipientId === "") {
    return "Choose a care recipient.";
  }
  const title = values.title.trim();
  if (title.length === 0) {
    return "Enter a title.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  if (values.notes.length > MAX_NOTES_LENGTH) {
    return `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  }
  if (file === null) {
    return "Choose a file to upload.";
  }
  if (!isAllowedMimeType(file.type)) {
    return "Only PDF, JPEG, PNG or WebP files can be uploaded.";
  }
  if (file.size > MEDICAL_DOCUMENT_MAX_BYTES) {
    return "The file must be 10 MB or smaller.";
  }
  if (file.size === 0) {
    return "The file is empty.";
  }
  return null;
}

/** Keeps the original name for display: trimmed, and capped at the API limit. */
function toDisplayFileName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_FILE_NAME_LENGTH);
}

function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? UNKNOWN_DATE_LABEL : date.toLocaleString();
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

/** Opens a signed URL in a new tab. The URL is used once and not kept anywhere. */
function openSignedUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function MedicalRecordsPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  const [uploadValues, setUploadValues] = useState<UploadFormValues>(EMPTY_FORM);
  const [uploadValidation, setUploadValidation] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const recordsQuery = useQuery({
    queryKey: dashboardKeys.medicalRecordRecords(selectedFamilyId),
    queryFn: () => fetchMedicalRecordRecords(selectedFamilyId),
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

  const uploadMutation = useMutation({
    mutationFn: async (variables: UploadVariables): Promise<void> => {
      // Stage 1: the file goes to private storage. Its error message is already generic.
      const filePath = await uploadMedicalDocument(
        variables.familyId,
        variables.careRecipientId,
        variables.file,
      );
      // Stage 2: the record row. A failure here means the file exists without a record.
      try {
        await createMedicalRecord({
          familyId: variables.familyId,
          careRecipientId: variables.careRecipientId,
          title: variables.title,
          recordType: variables.recordType,
          filePath,
          fileName: variables.fileName,
          mimeType: variables.mimeType,
          fileSizeBytes: variables.file.size,
          notes: variables.notes,
        });
      } catch {
        throw new Error(SAVE_AFTER_UPLOAD_MESSAGE);
      }
    },
    onSuccess: (_result, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardKeys.medicalRecordRecords(variables.familyId) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(variables.familyId) }),
      ]),
  });

  // The mutation returns nothing, so the signed URL is never held in mutation state or the query cache.
  const openMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: "view" | "download" }): Promise<void> => {
      const url = await getMedicalRecordSignedUrl(id, mode);
      openSignedUrl(url);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, familyId }: { id: string; familyId: string }): Promise<void> =>
      deleteMedicalRecord(id, familyId),
    // Refresh on failure too, so a partly completed delete (row removed, file left) is visible.
    onSettled: (_result, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dashboardKeys.medicalRecordRecords(variables.familyId) }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(variables.familyId) }),
      ]),
  });

  const rowBusy = openMutation.isPending || deleteMutation.isPending;
  const deleteSucceeded = deleteMutation.isSuccess;

  function handleOpen(id: string, mode: "view" | "download"): void {
    openMutation.mutate({ id, mode });
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ id, familyId: selectedFamilyId });
      setConfirmingDeleteId(null);
    } catch {
      // The failure is shown in the row through deleteMutation.error.
    }
  }

  const locked = uploadMutation.isPending;
  const canUpload = recipientsQuery.isSuccess && recipients.length > 0;

  async function handleUpload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0] ?? null;
    const validation = validateUpload(uploadValues, file);
    setUploadValidation(validation);
    const mimeType = file?.type;
    if (validation !== null || file === null || !isAllowedMimeType(mimeType)) {
      return;
    }
    try {
      await uploadMutation.mutateAsync({
        familyId: selectedFamilyId,
        careRecipientId: uploadValues.careRecipientId,
        title: uploadValues.title.trim(),
        recordType: uploadValues.recordType,
        notes: uploadValues.notes,
        file,
        fileName: toDisplayFileName(file.name),
        mimeType,
      });
      setUploadValues(EMPTY_FORM);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      // The failure is shown through uploadMutation.error.
    }
  }

  const uploadFormError =
    uploadValidation ?? (uploadMutation.isError ? messageOf(uploadMutation.error) : null);
  const uploadSaved = uploadMutation.isSuccess && !uploadMutation.isPending && uploadValidation === null;

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
        Add a care recipient before uploading a document.{" "}
        <Link href="/dashboard/care-recipients" className="font-medium text-teal-800 underline underline-offset-2">
          Go to care recipients
        </Link>
      </p>
    );
  }

  const records: MedicalRecordRecord[] = recordsQuery.data ?? [];

  let recordsContent: JSX.Element;
  if (recordsQuery.isPending) {
    recordsContent = <DashboardSkeleton />;
  } else if (recordsQuery.isError) {
    recordsContent = (
      <ErrorState
        message="We couldn't load medical records. Check your connection and try again."
        onRetry={() => {
          void recordsQuery.refetch();
        }}
      />
    );
  } else if (records.length === 0) {
    recordsContent = (
      <EmptyState
        icon={FileText}
        title="No medical records yet"
        description="Upload a document below to keep it with this family's records."
      />
    );
  } else {
    recordsContent = (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Records in this family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {records.map((record) => {
              const recipientName = recipientNames.get(record.careRecipientId) ?? UNKNOWN_RECIPIENT_LABEL;
              const isOpening = openMutation.isPending && openMutation.variables?.id === record.id;
              const openingMode = isOpening ? openMutation.variables?.mode : undefined;
              const openedHere = openMutation.isSuccess && openMutation.variables?.id === record.id;
              const openFailed = openMutation.isError && openMutation.variables?.id === record.id;
              const isConfirming = confirmingDeleteId === record.id;
              const isDeleting = deleteMutation.isPending && deleteMutation.variables?.id === record.id;
              const deleteFailed = deleteMutation.isError && deleteMutation.variables?.id === record.id;
              return (
                <li key={record.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <div className="min-w-0 space-y-1 text-sm">
                    <h3 className="font-medium text-slate-900">{record.title}</h3>
                    <p className="text-slate-600">Type: {labelOf(RECORD_TYPE_OPTIONS, record.recordType)}</p>
                    <p className="text-slate-600">Care recipient: {recipientName}</p>
                    {record.fileName ? (
                      <p className="break-all text-slate-600">File: {record.fileName}</p>
                    ) : null}
                    {record.fileSizeBytes !== null ? (
                      <p className="text-slate-600">File size: {formatFileSize(record.fileSizeBytes)}</p>
                    ) : null}
                    <p className="text-slate-600">Added: {formatDateTime(record.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`View ${record.title}`}
                      disabled={rowBusy}
                      onClick={() => handleOpen(record.id, "view")}
                    >
                      {isOpening && openingMode === "view" ? "Opening…" : "View"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Download ${record.title}`}
                      disabled={rowBusy}
                      onClick={() => handleOpen(record.id, "download")}
                    >
                      {isOpening && openingMode === "download" ? "Opening…" : "Download"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Delete ${record.title}`}
                      disabled={rowBusy}
                      onClick={() => {
                        deleteMutation.reset();
                        setConfirmingDeleteId(record.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  {openedHere ? (
                    <p role="status" className="text-sm text-teal-800">
                      Document opened in a new tab.
                    </p>
                  ) : null}
                  {openFailed ? (
                    <p role="alert" className="text-sm text-red-700">
                      {messageOf(openMutation.error) ?? "Unable to open this document."}
                    </p>
                  ) : null}
                  {isConfirming ? (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-slate-900">
                        {`Delete ${record.title}? This removes the record and its file. This cannot be undone.`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() => {
                            void handleDelete(record.id);
                          }}
                        >
                          {isDeleting ? "Deleting…" : "Confirm delete"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() => setConfirmingDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {deleteFailed ? (
                    <p role="alert" className="text-sm text-red-700">
                      {messageOf(deleteMutation.error) ?? "Unable to delete this record."}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Medical records</h1>
        <p className="text-sm text-slate-600">
          Store and organise medical documents for the {familyName}. Documents are private to your family.
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
          icon={FileText}
          title="No family selected"
          description="Create or select a family on the dashboard to manage medical records."
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
          {deleteSucceeded ? (
            <p role="status" className="text-sm text-teal-800">
              Document deleted.
            </p>
          ) : null}
          {recordsContent}

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Upload a document</CardTitle>
              <CardDescription>
                Choose a care recipient, enter a title and select a file. The file is stored privately for your
                family.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                className="flex max-w-xl flex-col gap-4"
                onSubmit={(event) => {
                  void handleUpload(event);
                }}
              >
                {recipientNotice}
                <div className="grid gap-2">
                  <Label htmlFor="upload-recipient">Care recipient</Label>
                  <select
                    id="upload-recipient"
                    name="careRecipientId"
                    required
                    aria-required="true"
                    disabled={locked || recipients.length === 0}
                    value={uploadValues.careRecipientId}
                    onChange={(event) => {
                      setUploadValues((current) => ({ ...current, careRecipientId: event.target.value }));
                      setUploadValidation(null);
                    }}
                    className={SELECT_CLASS}
                  >
                    <option value="">Select a care recipient</option>
                    {recipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-title">Title</Label>
                  <Input
                    id="upload-title"
                    name="title"
                    autoComplete="off"
                    required
                    aria-required="true"
                    maxLength={MAX_TITLE_LENGTH}
                    disabled={locked}
                    value={uploadValues.title}
                    onChange={(event) => {
                      setUploadValues((current) => ({ ...current, title: event.target.value }));
                      setUploadValidation(null);
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-record-type">Record type</Label>
                  <select
                    id="upload-record-type"
                    name="recordType"
                    disabled={locked}
                    value={uploadValues.recordType}
                    onChange={(event) => {
                      const option = RECORD_TYPE_OPTIONS.find((item) => item.value === event.target.value);
                      if (option) {
                        setUploadValues((current) => ({ ...current, recordType: option.value }));
                      }
                    }}
                    className={SELECT_CLASS}
                  >
                    {RECORD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-file">Document file</Label>
                  <input
                    id="upload-file"
                    name="file"
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    required
                    aria-required="true"
                    aria-describedby="upload-file-help"
                    disabled={locked}
                    ref={fileInputRef}
                    onChange={() => setUploadValidation(null)}
                    className={FILE_INPUT_CLASS}
                  />
                  <p id="upload-file-help" className="text-xs text-slate-600">
                    PDF, JPEG, PNG or WebP, up to 10 MB.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-notes">Notes (optional)</Label>
                  <textarea
                    id="upload-notes"
                    name="notes"
                    rows={3}
                    maxLength={MAX_NOTES_LENGTH}
                    disabled={locked}
                    value={uploadValues.notes}
                    onChange={(event) => {
                      setUploadValues((current) => ({ ...current, notes: event.target.value }));
                      setUploadValidation(null);
                    }}
                    className={TEXTAREA_CLASS}
                  />
                </div>
                {uploadFormError ? (
                  <p role="alert" className="text-sm text-red-700">
                    {uploadFormError}
                  </p>
                ) : null}
                {uploadSaved ? (
                  <p role="status" className="text-sm text-teal-800">
                    Document saved.
                  </p>
                ) : null}
                <div>
                  <Button type="submit" disabled={locked || !canUpload}>
                    {locked ? "Uploading…" : "Upload document"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
