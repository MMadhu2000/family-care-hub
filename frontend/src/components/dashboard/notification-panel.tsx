"use client";

import type { JSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dashboardKeys, fetchNotifications } from "@/lib/dashboard/queries";
import { useFamily } from "./family-context";

const MAX_VISIBLE_NOTIFICATIONS = 5;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function pluralise(count: number, unit: string): string {
  return count === 1 ? `${count} ${unit} ago` : `${count} ${unit}s ago`;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = Date.parse(iso);
  const diffMinutes = Math.max(0, Math.floor((now - then) / 60000));

  if (diffMinutes < MINUTES_PER_HOUR) {
    return "Just now";
  }

  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  if (diffHours < HOURS_PER_DAY) {
    return pluralise(diffHours, "hour");
  }

  return pluralise(Math.floor(diffHours / HOURS_PER_DAY), "day");
}

export function NotificationPanel(): JSX.Element {
  const { selectedFamilyId } = useFamily();

  const query = useQuery({
    queryKey: dashboardKeys.notifications(selectedFamilyId),
    queryFn: () => fetchNotifications(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>(
    {}
  );

  const notifications = query.data ?? [];

  const isRead = (n: (typeof notifications)[number]): boolean =>
    readOverrides[n.id] ?? n.read;

  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications, ${unreadCount} unread`}
          className="relative"
        >
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white"
            >
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="z-[100] w-80 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 opacity-100 shadow-xl backdrop-blur-none">
        <DropdownMenuLabel className="bg-white px-4 py-3 font-semibold text-slate-900">
          Notifications
        </DropdownMenuLabel>

        <DropdownMenuItem
          disabled={unreadCount === 0}
          onSelect={() =>
            setReadOverrides(
              Object.fromEntries(notifications.map((n) => [n.id, true]))
            )
          }
          className="bg-white px-4 text-xs font-medium text-teal-700 focus:bg-slate-100 focus:text-teal-800"
        >
          Mark all as read
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {query.isPending ? (
          <p role="status" className="px-4 py-6 text-sm text-slate-600">
            Loading...
          </p>
        ) : query.isError ? (
          <p role="alert" className="px-4 py-6 text-sm text-red-700">
            Could not load notifications.
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">
            You&apos;re all caught up.
          </p>
        ) : (
          notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS).map((n) => {
            const unread = !isRead(n);
            return (
              <DropdownMenuItem
                key={n.id}
                onSelect={() =>
                  setReadOverrides((prev) => ({ ...prev, [n.id]: true }))
                }
                className="flex items-start gap-3 whitespace-normal bg-white px-4 py-3 text-slate-900 focus:bg-slate-100 focus:text-slate-900"
              >
                {unread ? (
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-600"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={
                      unread
                        ? "text-sm font-semibold text-slate-900"
                        : "text-sm text-slate-900"
                    }
                  >
                    {n.title}
                  </span>
                  <span className="line-clamp-2 text-xs text-slate-600">
                    {n.body}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatRelative(n.createdAt)}
                  </span>
                </div>
                {unread ? <span className="sr-only"> (unread)</span> : null}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          asChild
          className="justify-center bg-white px-4 py-2.5 text-sm font-medium text-teal-700 focus:bg-slate-100 focus:text-teal-800"
        >
          <Link href="/dashboard/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


