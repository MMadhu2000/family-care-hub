import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  XCircle,
  Flag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppointmentStatus, Priority } from "@/lib/dashboard/types";

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  className: string;
}

interface PriorityConfig {
  label: string;
  className: string;
}

const APPOINTMENT_STATUS_CONFIG: Record<AppointmentStatus, StatusConfig> = {
  scheduled: {
    icon: CalendarClock,
    label: "Scheduled",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  completed: {
    icon: Circle,
    label: "Completed",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    className: "border-red-200 bg-red-50 text-red-800",
  },
};

const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  high: {
    label: "High priority",
    className: "border-red-200 bg-red-50 text-red-800",
  },
  medium: {
    label: "Medium priority",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  low: {
    label: "Low priority",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}): JSX.Element {
  const config = APPOINTMENT_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.className}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }): JSX.Element {
  const config = PRIORITY_CONFIG[priority];
  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.className}`}>
      <Flag aria-hidden="true" className="size-3.5" />
      {config.label}
    </Badge>
  );
}
