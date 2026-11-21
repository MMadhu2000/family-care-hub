import type { ReactNode } from "react";
import { AppProviders } from "@/components/dashboard/family-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function DashboardRouteLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <DashboardLayout>{children}</DashboardLayout>
    </AppProviders>
  );
}
