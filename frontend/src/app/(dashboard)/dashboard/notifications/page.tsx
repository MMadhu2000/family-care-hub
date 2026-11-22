"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import { dashboardKeys, fetchNotifications, markNotificationRead } from "@/lib/dashboard/queries";

/** Locale date and time for a stored ISO timestamp, or "" when it cannot be parsed. */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

export default function NotificationsPage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const queryClient = useQueryClient();
  const familyName = selectedFamily?.name ?? "your family";

  const notificationsQuery = useQuery({
    queryKey: dashboardKeys.notifications(selectedFamilyId),
    queryFn: () => fetchNotifications(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardKeys.notifications(selectedFamilyId) }),
  });

  let notificationsContent: JSX.Element;
  if (notificationsQuery.isPending) {
    notificationsContent = <DashboardSkeleton />;
  } else if (notificationsQuery.isError) {
    notificationsContent = (
      <ErrorState
        message="We couldn't load notifications. Check your connection and try again."
        onRetry={() => {
          void notificationsQuery.refetch();
        }}
      />
    );
  } else if (notificationsQuery.data.length === 0) {
    notificationsContent = (
      <EmptyState
        icon={Bell}
        title="No notifications yet."
        description="Notifications for your family will appear here."
      />
    );
  } else {
    notificationsContent = (
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Your notifications</CardTitle>
          <CardDescription>
            {notificationsQuery.data.length}{" "}
            {notificationsQuery.data.length === 1 ? "notification" : "notifications"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {markReadMutation.isError ? (
            <p role="alert" className="text-sm text-red-700">
              We couldn&apos;t update the notification.
            </p>
          ) : null}
          {notificationsQuery.data.map((notification) => {
            const savingThisRow =
              markReadMutation.isPending && markReadMutation.variables === notification.id;
            return (
              <div
                key={notification.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <h3 className="break-words text-base font-semibold text-slate-900">
                    {notification.title}
                    {notification.read ? null : (
                      <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
                        Unread
                      </span>
                    )}
                  </h3>
                  <p className="whitespace-pre-line break-words text-sm text-slate-600">
                    {notification.body}
                  </p>
                  <p className="text-xs text-slate-500">{formatCreatedAt(notification.createdAt)}</p>
                </div>
                {notification.read ? null : (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Mark ${notification.title} as read`}
                      disabled={markReadMutation.isPending}
                      onClick={() => {
                        void markReadMutation.mutateAsync(notification.id).catch(() => undefined);
                      }}
                    >
                      {savingThisRow ? "Savingâ€¦" : "Mark as read"}
                    </Button>
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-600">Updates for the {familyName}.</p>
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
          icon={Bell}
          title="No family selected"
          description="Create or select a family on the dashboard to see notifications."
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
        notificationsContent
      )}
    </div>
  );
}
