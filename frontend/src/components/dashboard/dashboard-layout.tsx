"use client";

import type { JSX, ReactNode } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export function DashboardLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-100">
      <DashboardSidebar />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <DashboardHeader />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
