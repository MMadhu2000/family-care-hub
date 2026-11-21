import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AppointmentStatusBadge } from "./status-badges";
import { EmptyState } from "./page-states";
import type { Appointment } from "@/lib/dashboard/types";

const APPOINTMENT_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function UpcomingAppointmentsCard({
  appointments,
}: {
  appointments: Appointment[];
}): JSX.Element {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="text-teal-700" aria-hidden="true" />
          Upcoming appointments
        </CardTitle>
        <Link
          href="/dashboard/appointments"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming appointments"
            description="Scheduled visits for your family will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{appointment.careRecipientName}</p>
                  <p className="text-sm text-slate-600">{appointment.title}</p>
                  <p className="text-xs text-slate-500">
                    {`${appointment.provider} · ${appointment.facility}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <time dateTime={appointment.startsAt} className="text-sm text-slate-700">
                    {APPOINTMENT_TIME_FORMAT.format(new Date(appointment.startsAt))}
                  </time>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
