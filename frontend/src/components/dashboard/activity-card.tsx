import { Activity } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivityItem } from "@/lib/dashboard/types";

import { EmptyState } from "./page-states";

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((part: string): boolean => part.length > 0)
    .slice(0, 2)
    .map((part: string): string => part.charAt(0).toUpperCase())
    .join("");
}

function formatOccurredAt(occurredAt: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(occurredAt));
}

export function RecentActivityCard({
  activity,
}: {
  activity: ActivityItem[];
}): JSX.Element {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-700" aria-hidden="true" />
          Recent family activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            description="Actions taken by family members will show here."
          />
        ) : (
          <ol className="space-y-4">
            {activity.map((item: ActivityItem): JSX.Element => (
              <li key={item.id} className="flex gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                  aria-hidden="true"
                >
                  {getInitials(item.actorName)}
                </div>
                <div className="min-w-0">
                  <p>
                    <span className="font-medium text-slate-900">{item.actorName}</span>{" "}
                    <span className="text-slate-700">{item.action}</span>
                  </p>
                  <time dateTime={item.occurredAt} className="text-xs text-slate-500">
                    {formatOccurredAt(item.occurredAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
