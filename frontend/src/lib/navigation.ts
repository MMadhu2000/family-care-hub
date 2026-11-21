import {
  Bell,
  CalendarDays,
  CheckSquare,
  FileText,
  GitBranch,
  HeartHandshake,
  LayoutDashboard,
  Pill,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Family Members", href: "/dashboard/family", icon: Users },
  { label: "Care Recipients", href: "/dashboard/care-recipients", icon: HeartHandshake },
  { label: "Medical Records", href: "/dashboard/medical-records", icon: FileText },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Appointments", href: "/dashboard/appointments", icon: CalendarDays },
  { label: "Prescriptions", href: "/dashboard/prescriptions", icon: Pill },
  { label: "Family Timeline", href: "/dashboard/timeline", icon: GitBranch },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
