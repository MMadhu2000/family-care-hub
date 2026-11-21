import { Activity, CalendarDays, ClipboardList, MapPin, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Synthetic demo data only. Replace with live data from the backend.
const FAMILY_MEMBERS = [
  { id: "m1", name: "Demo Parent", relation: "Primary caregiver", initials: "DP" },
  { id: "m2", name: "Demo Child", relation: "Dependent", initials: "DC" },
  { id: "m3", name: "Demo Grandparent", relation: "Care recipient", initials: "DG" },
  { id: "m4", name: "Demo Sibling", relation: "Support contact", initials: "DS" },
] as const

type TaskStatus = "Due today" | "Overdue" | "Upcoming"

const PENDING_TASKS: ReadonlyArray<{ id: string; title: string; due: string; status: TaskStatus }> = [
  { id: "t1", title: "Refill prescription (Demo Grandparent)", due: "Due today, 5:00 PM", status: "Due today" },
  { id: "t2", title: "Submit school form (Demo Child)", due: "Was due yesterday", status: "Overdue" },
  { id: "t3", title: "Book dental check-up", due: "Due Friday", status: "Upcoming" },
]

const APPOINTMENTS = [
  { id: "a1", title: "GP review (Demo Grandparent)", when: "Tue, 10:30 AM", location: "Demo Medical Centre" },
  { id: "a2", title: "Parent-teacher meeting (Demo Child)", when: "Thu, 4:15 PM", location: "Demo Primary School" },
] as const

const RECENT_ACTIVITY = [
  { id: "r1", description: "Demo Parent marked medication as given", time: "2 hours ago" },
  { id: "r2", description: "Demo Child's school form was uploaded", time: "Yesterday" },
  { id: "r3", description: "Demo Sibling added a note to the care log", time: "2 days ago" },
  { id: "r4", description: "Appointment reminder sent to Demo Parent", time: "3 days ago" },
] as const

const STATUS_STYLES: Record<TaskStatus, string> = {
  "Due today": "border-amber-200 bg-amber-50 text-amber-800",
  Overdue: "border-red-200 bg-red-50 text-red-700",
  Upcoming: "border-slate-200 bg-slate-100 text-slate-700",
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Synthetic demo data</Badge>
            <span className="text-xs text-slate-500">
              Temporary placeholder — replace with live data from the backend.
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Good morning</h1>
          <p className="mt-1 text-slate-600">Here is the care overview for your family today.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-2xl bg-white shadow-sm ring-slate-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <CardTitle className="text-slate-900">Family overview</CardTitle>
              </div>
              <CardDescription>Members in your care circle</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {FAMILY_MEMBERS.map((member) => (
                  <li key={member.id} className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-xs font-semibold text-white"
                      aria-hidden="true"
                    >
                      {member.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{member.name}</p>
                      <p className="truncate text-xs text-slate-600">{member.relation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-sm ring-slate-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <CardTitle className="text-slate-900">Pending tasks</CardTitle>
              </div>
              <CardDescription>Items that need attention</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PENDING_TASKS.map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-600">{task.due}</p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", STATUS_STYLES[task.status])}>
                      {task.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-sm ring-slate-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <CardTitle className="text-slate-900">Upcoming appointments</CardTitle>
              </div>
              <CardDescription>Next scheduled visits</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                {APPOINTMENTS.map((appt) => (
                  <li key={appt.id} className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{appt.title}</p>
                      <p className="text-xs text-slate-600">{appt.when}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {appt.location}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-white shadow-sm ring-slate-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <CardTitle className="text-slate-900">Recent activity</CardTitle>
              </div>
              <CardDescription>Latest updates from the care log</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {RECENT_ACTIVITY.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700">{item.description}</p>
                    <span className="shrink-0 text-xs text-slate-500">{item.time}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
