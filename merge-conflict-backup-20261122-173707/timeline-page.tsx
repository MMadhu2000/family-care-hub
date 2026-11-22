<<<<<<< HEAD
﻿export default function Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Timeline</h1>
      <p className="mt-2 text-slate-600">
        Timeline module is ready for implementation.
      </p>
    </div>
  );
}

=======
"use client";

import type { JSX } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton, EmptyState, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import {
  dashboardKeys,
  fetchCareRecipientRecords,
  fetchTimelineEventRecords,
} from "@/lib/dashboard/queries";
import type { TimelineEventRecord } from "@/lib/dashboard/types";

const UNKNOWN_RECIPIENT_LABEL = "Unknown care recipient";
const UNKNOWN_DATE_LABEL = "Date unavailable";
const RECORDED_ONLY_NOTE = "Recorded events only. This list may not show every change.";

/** Turns a stored event type such as "medication_given" into a plain label such as "Medication Given". */
function formatEventType(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? UNKNOWN_DATE_LABEL : date.toLocaleString();
}

export default function TimelinePage(): JSX.Element {
  const {
    selectedFamilyId,
    selectedFamily,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();
  const familyName = selectedFamily?.name ?? "family";

  const eventsQuery = useQuery({
    queryKey: dashboardKeys.timelineEvents(selectedFamilyId),
    queryFn: () => fetchTimelineEventRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipientsQuery = useQuery({
    queryKey: dashboardKeys.recipientRecords(selectedFamilyId),
    queryFn: () => fetchCareRecipientRecords(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const recipientNames = useMemo(
    () =>
      new Map<string, string>(
        (recipientsQuery.data ?? []).map((record): [string, string] => [record.id, record.fullName]),
      ),
    [recipientsQuery.data],
  );

  function renderEvent(event: TimelineEventRecord): JSX.Element {
    let recipientLabel: string | null = null;
    if (event.careRecipientId !== null) {
      recipientLabel = recipientNames.get(event.careRecipientId) ?? UNKNOWN_RECIPIENT_LABEL;
    }

    return (
      <li key={event.id} className="rounded-lg border border-slate-200 p-4">
        <h3 className="text-base font-semibold text-slate-900">{event.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{formatEventType(event.eventType)}</p>
        {event.description ? <p className="mt-2 text-sm text-slate-700">{event.description}</p> : null}
        {recipientLabel !== null ? (
          <p className="mt-1 text-sm text-slate-600">Care recipient: {recipientLabel}</p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">
          <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
        </p>
      </li>
    );
  }

  let content: JSX.Element;
  if (familiesError) {
    content = (
      <ErrorState
        message="We couldn't load your families."
        onRetry={() => {
          void refetchFamilies();
        }}
      />
    );
  } else if (familiesLoading) {
    content = <DashboardSkeleton />;
  } else if (!selectedFamilyId) {
    content = (
      <EmptyState
        icon={History}
        title="No family selected"
        description="Choose a family on the dashboard to see its timeline."
        action={
          <Link href="/dashboard" className="text-sm font-medium text-teal-800 underline underline-offset-2">
            Go to dashboard
          </Link>
        }
      />
    );
  } else if (eventsQuery.isPending) {
    content = <DashboardSkeleton />;
  } else if (eventsQuery.isError) {
    content = (
      <ErrorState
        message="We couldn't load the timeline."
        onRetry={() => {
          void eventsQuery.refetch();
        }}
      />
    );
  } else if (eventsQuery.data.length === 0) {
    content = (
      <EmptyState
        icon={History}
        title="No events recorded yet"
        description="Events will appear here as care is recorded."
      />
    );
  } else {
    const events = eventsQuery.data;
    const countLine = events.length === 1 ? "1 event" : `${events.length} events`;
    content = (
      <Card>
        <CardHeader>
          <CardTitle>Recorded events</CardTitle>
          <CardDescription>{countLine}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">{RECORDED_ONLY_NOTE}</p>
          {recipientsQuery.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-red-700">
                Care recipient names could not be loaded.
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
          ) : null}
          <ol className="space-y-3">{events.map((event) => renderEvent(event))}</ol>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Timeline</h1>
        <p className="mt-1 text-sm text-slate-600">Recent recorded care events for the {familyName}.</p>
      </div>
      {content}
    </div>
  );
}
>>>>>>> bb30bd1574a7d28127d9cd835d7b56013e6469dd
