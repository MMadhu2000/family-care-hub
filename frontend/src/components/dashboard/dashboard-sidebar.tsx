"use client";

import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { NAV_ITEMS, isActivePath } from "@/lib/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function SidebarContents({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const pathname = usePathname();

  return (
    <div>
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-11 items-center justify-center rounded-xl bg-teal-600">
          <ShieldCheck aria-hidden="true" className="size-6 text-white" />
        </div>
        <div>
          <p className="font-semibold text-white">Family Care Hub</p>
          <p className="text-xs text-slate-300">Caregiving, coordinated.</p>
        </div>
      </div>

      <nav aria-label="Primary" className="mt-8">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-teal-400"
                    />
                  ) : null}
                  <item.icon aria-hidden="true" className="size-[18px]" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function DashboardSidebar(): JSX.Element {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:bg-[#0B1F3A] lg:px-4 lg:py-6">
      <SidebarContents />
    </aside>
  );
}

export function MobileNavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 border-none bg-[#0B1F3A] p-6 text-white"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContents onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
