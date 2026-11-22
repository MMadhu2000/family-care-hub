import type { JSX } from "react";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ClipboardList, Circle } from "lucide-react";
import { PriorityBadge } from "./status-badges";
import { EmptyState } from "./page-states";
import type { Task } from "@/lib/dashboard/types";

const DUE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function PendingTasksCard({ tasks }: { tasks: Task[] }): JSX.Element {
  const open: Task[] = tasks.filter((task) => !task.completed).slice(0, 5);

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="text-teal-700" aria-hidden="true" />
          Pending tasks
        </CardTitle>
        <Link href="/dashboard/tasks" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No pending tasks"
            description="You are all caught up for now."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {open.map((task) => (
              <li
                key={task.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{task.title}</p>
                  <p className="text-xs text-slate-500">{`Assigned to ${task.assigneeName}`}</p>
                </div>
                <div className="flex items-center gap-3">
                  {task.dueDate ? (
                    <time dateTime={task.dueDate} className="text-sm text-slate-700">
                      {`Due ${DUE_DATE_FORMAT.format(new Date(`${task.dueDate}T00:00:00Z`))}`}
                    </time>
                  ) : (
                    <span className="text-sm text-slate-500">No due date</span>
                  )}
                  <PriorityBadge priority={task.priority} />
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <Circle size={14} aria-hidden="true" />
                    Open
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
