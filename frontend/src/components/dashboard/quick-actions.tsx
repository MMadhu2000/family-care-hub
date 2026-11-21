import type { JSX } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarPlus,
  ChevronRight,
  FileText,
  ListPlus,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Add Family Member", href: "/dashboard/family", icon: UserPlus },
  { label: "Add Medical Record", href: "/dashboard/medical-records", icon: FileText },
  { label: "Schedule Appointment", href: "/dashboard/appointments", icon: CalendarPlus },
  { label: "Create Task", href: "/dashboard/tasks", icon: ListPlus },
];

export function QuickActions(): JSX.Element {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-teal-700" aria-hidden="true" />
          Quick actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1F3A] text-white">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-slate-900">{action.label}</span>
                  <ChevronRight
                    className="ml-auto h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
