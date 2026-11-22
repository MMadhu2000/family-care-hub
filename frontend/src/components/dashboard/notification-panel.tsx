"use client";

import type { JSX } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { dashboardKeys, fetchNotifications, markNotificationRead } from "@/lib/dashboard/queries";
import { useFamily } from "./family-context";

const MAX_VISIBLE_NOTIFICATIONS = 5;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function pluralise(count: number, unit: string): string {
  return count === 1 ? `${count} ${unit} ago` : `${count} ${unit}s ago`;
}

function formatRelative(iso: string): string {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (diffMinutes < MINUTES_PER_HOUR) return "Just now";
  const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
  if (diffHours < HOURS_PER_DAY) return pluralise(diffHours, "hour");
  return pluralise(Math.floor(diffHours / HOURS_PER_DAY), "day");
}

export function NotificationPanel(): JSX.Element {
  const { selectedFamilyId } = useFamily();
  const queryClient = useQueryClient();
  const queryKey = dashboardKeys.notifications(selectedFamilyId);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => markNotificationRead(id)));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const busy = markReadMutation.isPending || markAllReadMutation.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications, ${unreadCount} unread`} className="relative">
          <Bell aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span aria-hidden="true" className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="px-4 py-3 font-semibold">Notifications</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={unreadCount === 0 || busy}
          onSelect={() => {
            void markAllReadMutation.mutateAsync(notifications.filter((n) => !n.read).map((n) => n.id));
          }}
          className="px-4 text-xs font-medium text-teal-700"
        >
          Mark all as read
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {query.isPending ? (
          <p role="status" className="px-4 py-6 text-sm text-slate-600">Loading…</p>
        ) : query.isError ? (
          <p role="alert" className="px-4 py-6 text-sm text-red-700">Could not load notifications.</p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">You&apos;re all caught up.</p>
        ) : (
          notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS).map((notification) => {
            const unread = !notification.read;
            return (
              <DropdownMenuItem
                key={notification.id}
                disabled={!unread || busy}
                onSelect={() => { void markReadMutation.mutateAsync(notification.id); }}
                className="flex items-start gap-3 whitespace-normal px-4 py-3"
              >
                <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-teal-600" : "bg-transparent"}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={unread ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-900"}>{notification.title}</span>
                  <span className="line-clamp-2 text-xs text-slate-600">{notification.body}</span>
                  <span className="text-xs text-slate-500">{formatRelative(notification.createdAt)}</span>
                </div>
                {unread ? <span className="sr-only"> (unread)</span> : null}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center px-4 py-2.5 text-sm font-medium text-teal-700">
          <Link href="/dashboard/notifications">View all notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
