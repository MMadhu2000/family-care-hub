import { Card, CardContent } from "@/components/ui/card";
import type { JSX } from "react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
}): JSX.Element {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">{label}</span>
          <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Icon aria-hidden="true" size={20} />
          </div>
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}
