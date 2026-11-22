"use client";

import type { FormEvent, JSX } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  changeFamilyMemberRole,
  createInvitation,
  dashboardKeys,
  fetchFamilyMembersView,
  fetchInvitationRecords,
  removeFamilyMember,
  revokeInvitation,
} from "@/lib/dashboard/queries";
import type { CreateInvitationInput } from "@/lib/dashboard/queries";
import type { FamilyMemberRecord, FamilyRole, InvitationRecord, InvitationRole } from "@/lib/dashboard/types";

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNKNOWN_EXPIRY_LABEL = "Expiry unknown";

const SELECT_CLASS =
  "flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-slate-900 outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const ROLE_LABELS: Record<FamilyRole, string> = {
  ADMIN: "Administrator",
  CAREGIVER: "Caregiver",
  CONTRIBUTOR: "Contributor",
  VIEWER: "Viewer",
};

const ASSIGNABLE_ROLES: readonly FamilyRole[] = ["ADMIN", "CAREGIVER", "CONTRIBUTOR", "VIEWER"];
const INVITATION_ROLES: readonly InvitationRole[] = ["CAREGIVER", "CONTRIBUTOR", "VIEWER"];

type CopyState = "idle" | "copied" | "failed";

interface RoleVariables {
  memberId: string;
  familyId: string;
  role: FamilyRole;
}

interface RemoveVariables {
  memberId: string;
  familyId: string;
  /** True when the signed-in user removes their own membership. */
  leave: boolean;
}

interface RevokeVariables {
  invitationId: string;
  familyId: string;
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

function nameOf(member: FamilyMemberRecord): string {
  const name = member.displayName?.trim();
  return name ? name : "Member";
}

function emailOf(member: FamilyMemberRecord): string {
  const email = member.email?.trim();
  return email ? email : "No email on record";
}

function toFamilyRole(value: string): FamilyRole | null {
  return ASSIGNABLE_ROLES.find((role) => role === value) ?? null;
}

function toInvitationRole(value: string): InvitationRole | null {
  return INVITATION_ROLES.find((role) => role === value) ?? null;
}

function validateInviteEmail(value: string): string | null {
  if (value.length === 0) {
    return "Enter an email address.";
  }
  if (value.length > MAX_EMAIL_LENGTH) {
    return `Email address must be ${MAX_EMAIL_LENGTH} characters or fewer.`;
  }
  if (!EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? UNKNOWN_EXPIRY_LABEL : `Expires ${date.toLocaleDateString()}`;
}

export default function FamilyPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  /** The one row whose confirm panel is open: "remove:<id>", "leave:<id>" or "revoke:<id>". */
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<InvitationRole>("VIEWER");
  const [emailError, setEmailError] = useState<string | null>(null);
  /** The invitation link is held only in component state: never in the query cache or storage. */
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    return () => {
      setInvitationUrl(null);
    };
  }, []);

  const membersQuery = useQuery({
    queryKey: dashboardKeys.familyMembersView(selectedFamilyId),
    queryFn: () => fetchFamilyMembersView(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const view = membersQuery.data;
  const members = view?.members ?? [];
  const currentUserId = view?.currentUser.id ?? null;
  const isAdmin = view?.currentUser.role === "ADMIN";

  const invitationsQuery = useQuery({
    queryKey: dashboardKeys.invitationRecords(selectedFamilyId),
    queryFn: () => fetchInvitationRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId) && isAdmin === true,
  });

  function invalidateMemberData(familyId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.familyMembersView(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  function invalidateInvitationData(familyId: string): Promise<unknown> {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardKeys.invitationRecords(familyId) }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard(familyId) }),
    ]);
  }

  const roleMutation = useMutation({
    mutationFn: (variables: RoleVariables) => changeFamilyMemberRole(variables.memberId, variables.role),
    onSuccess: (_result, variables) => invalidateMemberData(variables.familyId),
  });

  const removeMutation = useMutation({
    mutationFn: (variables: RemoveVariables) => removeFamilyMember(variables.memberId),
    onSuccess: (_result, variables) => {
      setConfirmingKey(null);
      if (variables.leave) {
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.families });
        refetchFamilies();
      }
    },
    onSettled: (_result, _error, variables) => invalidateMemberData(variables.familyId),
  });

  const revokeMutation = useMutation({
    mutationFn: (variables: RevokeVariables) => revokeInvitation(variables.invitationId),
    onSuccess: () => {
      setConfirmingKey(null);
    },
    onSettled: (_result, _error, variables) => invalidateInvitationData(variables.familyId),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateInvitationInput) => createInvitation(input),
    onSuccess: (result, input) => {
      setInvitationUrl(result.invitationUrl);
      setCopyState("idle");
      setInviteEmail("");
      setInviteRole("VIEWER");
      return invalidateInvitationData(input.familyId);
    },
  });

  function startConfirm(key: string): void {
    setConfirmingKey(key);
    removeMutation.reset();
    revokeMutation.reset();
  }

  function cancelConfirm(): void {
    setConfirmingKey(null);
    removeMutation.reset();
    revokeMutation.reset();
  }

  function handleRoleChange(member: FamilyMemberRecord, value: string): void {
    const role = toFamilyRole(value);
    if (role === null) {
      return;
    }
    roleMutation.mutate({ memberId: member.id, familyId: selectedFamilyId, role });
  }

  function handleRemove(member: FamilyMemberRecord, leave: boolean): void {
    removeMutation.mutate({ memberId: member.id, familyId: selectedFamilyId, leave });
  }

  function handleRevoke(invitation: InvitationRecord): void {
    revokeMutation.mutate({ invitationId: invitation.id, familyId: selectedFamilyId });
  }

  function handleInviteSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = inviteEmail.trim();
    const validation = validateInviteEmail(trimmed);
    setEmailError(validation);
    if (validation) {
      return;
    }
    createMutation.mutate({
      familyId: selectedFamilyId,
      email: trimmed.toLowerCase(),
      role: inviteRole,
    });
  }

  function dismissInvitationUrl(): void {
    setInvitationUrl(null);
    setCopyState("idle");
  }

  async function handleCopy(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function renderMemberRow(member: FamilyMemberRecord): JSX.Element {
    const name = nameOf(member);
    const isSelf = member.userId === currentUserId;
    const roleBusy = roleMutation.isPending && roleMutation.variables?.memberId === member.id;
    const removeBusy = removeMutation.isPending && removeMutation.variables?.memberId === member.id;
    const busy = roleBusy || removeBusy;
    const roleError =
      roleMutation.isError && roleMutation.variables?.memberId === member.id
        ? messageOf(roleMutation.error)
        : null;
    const roleUpdated =
      roleMutation.isSuccess && !roleMutation.isPending && roleMutation.variables?.memberId === member.id;
    const removeError =
      removeMutation.isError && removeMutation.variables?.memberId === member.id
        ? messageOf(removeMutation.error)
        : null;

    const removeKey = `remove:${member.id}`;
    const leaveKey = `leave:${member.id}`;
    const confirmingLeave = confirmingKey === leaveKey;
    const confirmingRemove = confirmingKey === removeKey;

    let controls: JSX.Element | null = null;
    if (isSelf) {
      if (confirmingLeave) {
        controls = (
          <div className="flex w-full flex-col gap-3">
            <p className="text-sm text-slate-900">
              Leave {familyName}? You will lose access to its records.
            </p>
            {removeError ? (
              <p role="alert" className="text-sm text-red-700">
                {removeError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => handleRemove(member, true)}
              >
                Confirm leave
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={cancelConfirm}>
                Cancel
              </Button>
            </div>
          </div>
        );
      } else {
        controls = (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || confirmingKey !== null}
              onClick={() => startConfirm(leaveKey)}
            >
              Leave family
            </Button>
            {removeError ? (
              <p role="alert" className="text-sm text-red-700">
                {removeError}
              </p>
            ) : null}
          </div>
        );
      }
    } else if (isAdmin === true) {
      if (confirmingRemove) {
        controls = (
          <div className="flex w-full flex-col gap-3">
            <p className="text-sm text-slate-900">
              Remove {name} from this family? They will lose access to its records.
            </p>
            {removeError ? (
              <p role="alert" className="text-sm text-red-700">
                {removeError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => handleRemove(member, false)}
              >
                Confirm remove
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={cancelConfirm}>
                Cancel
              </Button>
            </div>
          </div>
        );
      } else {
        controls = (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || confirmingKey !== null}
              onClick={() => startConfirm(removeKey)}
            >
              Remove {name}
            </Button>
            {removeError ? (
              <p role="alert" className="text-sm text-red-700">
                {removeError}
              </p>
            ) : null}
          </div>
        );
      }
    }

    return (
      <li key={member.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-medium text-slate-900">
            {name}
            {isSelf ? <span className="font-normal text-slate-600"> (you)</span> : null}
          </p>
          <p className="break-all text-slate-600">{emailOf(member)}</p>
          {isAdmin === true && !isSelf ? null : (
            <p className="text-slate-600">Role: {ROLE_LABELS[member.role]}</p>
          )}
          {roleError ? (
            <p role="alert" className="text-sm text-red-700">
              {roleError}
            </p>
          ) : null}
          {roleUpdated ? (
            <p role="status" className="text-sm text-teal-800">
              Role updated.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {isAdmin === true && !isSelf ? (
            <select
              aria-label={`Role for ${name}`}
              disabled={busy}
              value={member.role}
              onChange={(event) => handleRoleChange(member, event.target.value)}
              className={SELECT_CLASS}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          ) : null}
          {controls}
        </div>
      </li>
    );
  }

  function renderInvitationRow(invitation: InvitationRecord): JSX.Element {
    const confirmKey = `revoke:${invitation.id}`;
    const isConfirming = confirmingKey === confirmKey;
    const busy = revokeMutation.isPending && revokeMutation.variables?.invitationId === invitation.id;
    const error =
      revokeMutation.isError && revokeMutation.variables?.invitationId === invitation.id
        ? messageOf(revokeMutation.error)
        : null;

    return (
      <li key={invitation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1 text-sm">
          <p className="break-all font-medium text-slate-900">{invitation.email}</p>
          <p className="text-slate-600">Role: {ROLE_LABELS[invitation.role]}</p>
          <p className="text-slate-600">{formatExpiry(invitation.expiresAt)}</p>
        </div>
        {isConfirming ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:max-w-xs">
            <p className="text-sm text-slate-900">Revoke the invitation for {invitation.email}?</p>
            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={busy}
                onClick={() => handleRevoke(invitation)}
              >
                Confirm revoke
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={cancelConfirm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || confirmingKey !== null}
              onClick={() => startConfirm(confirmKey)}
            >
              Revoke {invitation.email}
            </Button>
            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </li>
    );
  }

  function renderMembersCard(): JSX.Element {
    return (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            {isAdmin === true
              ? "Change roles, or remove members. Administrators cannot be removed while they are the last administrator."
              : "People who currently have access to this family."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-slate-600">No members found.</p>
          ) : (
            <ul className="divide-y divide-slate-200">{members.map((member) => renderMemberRow(member))}</ul>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderInvitationsList(): JSX.Element {
    let content: JSX.Element;
    if (invitationsQuery.isPending) {
      content = <p className="text-sm text-slate-600">Loading invitations…</p>;
    } else if (invitationsQuery.isError) {
      content = (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-red-700">
            We couldn&apos;t load invitations.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void invitationsQuery.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      );
    } else if (invitationsQuery.data.length === 0) {
      content = <p className="text-sm text-slate-600">No pending invitations.</p>;
    } else {
      content = (
        <ul className="divide-y divide-slate-200">
          {invitationsQuery.data.map((invitation) => renderInvitationRow(invitation))}
        </ul>
      );
    }

    return (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Invitations</CardTitle>
          <CardDescription>Invitations that have been created and not yet accepted or revoked.</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  function renderInviteCard(): JSX.Element {
    const createError =
      emailError ?? (createMutation.isError ? messageOf(createMutation.error) : null);
    const created = createMutation.isSuccess && !createMutation.isPending;

    return (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Invite someone</CardTitle>
          <CardDescription>
            Create an invitation for a person to join this family. No email is sent; share the link yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form noValidate className="flex max-w-xl flex-col gap-4" onSubmit={handleInviteSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                type="email"
                id="invite-email"
                name="email"
                autoComplete="off"
                required
                aria-required="true"
                disabled={createMutation.isPending}
                value={inviteEmail}
                onChange={(event) => {
                  setInviteEmail(event.target.value);
                  setEmailError(null);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
                disabled={createMutation.isPending}
                value={inviteRole}
                onChange={(event) => {
                  const role = toInvitationRole(event.target.value);
                  if (role !== null) {
                    setInviteRole(role);
                  }
                }}
                className={SELECT_CLASS}
              >
                {INVITATION_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            {createError ? (
              <p role="alert" className="text-sm text-red-700">
                {createError}
              </p>
            ) : null}
            {created ? (
              <p role="status" className="text-sm text-teal-800">
                Invitation created.
              </p>
            ) : null}
            <Button type="submit" disabled={createMutation.isPending} className="w-fit">
              {createMutation.isPending ? "Creating…" : "Create invitation"}
            </Button>
          </form>

          {invitationUrl !== null ? (
            <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
              <p className="text-sm text-slate-900">Share this link once. It will not be shown again.</p>
              <Input readOnly id="invite-link" aria-label="Invitation link" value={invitationUrl} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleCopy(invitationUrl);
                  }}
                >
                  Copy link
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={dismissInvitationUrl}>
                  Dismiss
                </Button>
              </div>
              {copyState === "copied" ? (
                <p role="status" className="text-sm text-teal-800">
                  Link copied.
                </p>
              ) : null}
              {copyState === "failed" ? (
                <p role="alert" className="text-sm text-red-700">
                  Copy failed. Select the link and copy it manually.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  let content: JSX.Element;
  if (familiesError) {
    content = (
      <ErrorState
        message="We couldn't load your families. Check your connection and try again."
        onRetry={refetchFamilies}
      />
    );
  } else if (familiesLoading) {
    content = <DashboardSkeleton />;
  } else if (!selectedFamilyId) {
    content = (
      <EmptyState
        icon={Users}
        title="No family selected"
        description="Create or select a family on the dashboard to manage its members."
        action={
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-slate-900 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Go to dashboard
          </Link>
        }
      />
    );
  } else if (membersQuery.isPending) {
    content = <DashboardSkeleton />;
  } else if (membersQuery.isError) {
    content = (
      <ErrorState
        message="We couldn't load family members."
        onRetry={() => {
          void membersQuery.refetch();
        }}
      />
    );
  } else {
    content = (
      <>
        {renderMembersCard()}
        {isAdmin === true ? (
          <>
            {renderInvitationsList()}
            {renderInviteCard()}
          </>
        ) : (
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">Only administrators can manage invitations.</p>
            </CardContent>
          </Card>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Family</h1>
        <p className="text-sm text-slate-600">Manage members and invitations for the {familyName}.</p>
      </section>
      {content}
    </div>
  );
}
