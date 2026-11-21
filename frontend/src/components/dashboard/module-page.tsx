import type { LucideIcon } from "lucide-react";
import { Info, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { EmptyState } from "./page-states";

export function ModulePage({
  title,
  description,
  icon,
  actionLabel,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
        </div>
        <div>
          <Button disabled className="bg-[#0B1F3A] text-white hover:bg-[#13305a]">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {actionLabel}
          </Button>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Available once the live service is connected. Demo build only.
          </p>
        </div>
      </div>
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
        </CardContent>
      </Card>
    </div>
  );
}
