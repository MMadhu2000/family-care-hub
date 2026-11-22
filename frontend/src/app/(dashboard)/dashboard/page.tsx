"use client";

import type { JSX } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, HeartHandshake, Info, Users } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { UpcomingAppointmentsCard } from "@/components/dashboard/appointments-card";
import { PendingTasksCard } from "@/components/dashboard/tasks-card";
import { RecentActivityCard } from "@/components/dashboard/activity-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { CreateFamilyCard } from "@/components/dashboard/create-family-card";
import { DashboardSkeleton, ErrorState } from "@/components/dashboard/page-states";
import { useFamily } from "@/components/dashboard/family-context";
import { dashboardKeys, fetchDashboardData } from "@/lib/dashboard/queries";

export default function DashboardPage(): JSX.Element {
  const {
    families,
    selectedFamily,
    selectedFamilyId,
    isLoading: familiesLoading,
    error: familiesError,
    refetchFamilies,
  } = useFamily();

  const query = useQuery({
    queryKey: dashboardKeys.dashboard(selectedFamilyId),
    queryFn: () => fetchDashboardData(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const familyName = selectedFamily?.name ?? "your family";

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-600">Here is the care overview for the {familyName}.</p>
      </section>

      <div className="flex gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal-700" />
        <p>
          This dashboard organises care information only and does not provide medical advice.
        </p>
      </div>

      {familiesError ? (
        <ErrorState
          message="We couldn't load your families. Check your connection and try again."
          onRetry={refetchFamilies}
        />
      ) : familiesLoading ? (
        <DashboardSkeleton />
      ) : families.length === 0 ? (
        <CreateFamilyCard />
      ) : query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState
          message="We couldn't load your dashboard. Check your connection and try again."
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : !selectedFamilyId || !query.data ? (
        <ErrorState message="No family is available to show." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Family members"
              value={query.data.summary.totalFamilyMembers}
              hint="In this household"
              icon={Users}
            />
            <StatCard
              label="Care recipients"
              value={query.data.summary.careRecipients}
              hint="Registered in this family"
              icon={HeartHandshake}
            />
            <StatCard
              label="Upcoming appointments"
              value={query.data.summary.upcomingAppointments}
              hint="Scheduled"
              icon={CalendarDays}
            />
            <StatCard
              label="Pending tasks"
              value={query.data.summary.pendingTasks}
              hint="Not yet completed"
              icon={ClipboardList}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <UpcomingAppointmentsCard appointments={query.data.appointments} />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <PendingTasksCard tasks={query.data.tasks} />
            </div>
            <div>
              <RecentActivityCard activity={query.data.activity} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
