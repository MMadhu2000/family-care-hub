"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Menu, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/navigation";
import { dashboardKeys, fetchFamilyMembers } from "@/lib/dashboard/queries";
import { MobileNavSheet } from "./dashboard-sidebar";
import { FamilySelector } from "./family-selector";
import { NotificationPanel } from "./notification-panel";
import { UserMenu } from "./user-menu";
import { useFamily } from "./family-context";

interface SearchResult {
  key: string;
  label: string;
  href: string;
}

export function DashboardHeader(): JSX.Element {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { selectedFamilyId } = useFamily();

  const membersQuery = useQuery({
    queryKey: dashboardKeys.members(selectedFamilyId),
    queryFn: () => fetchFamilyMembers(selectedFamilyId),
    enabled: Boolean(selectedFamilyId),
  });

  const trimmed = query.trim().toLowerCase();

  const pageResults: SearchResult[] = trimmed
    ? NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(trimmed)).map((item) => ({
        key: item.href,
        label: item.label,
        href: item.href,
      }))
    : [];

  const memberResults: SearchResult[] = trimmed
    ? (membersQuery.data ?? [])
        .filter(
          (m) =>
            m.fullName.toLowerCase().includes(trimmed) ||
            m.relationship.toLowerCase().includes(trimmed),
        )
        .map((m) => ({
          key: m.id,
          label: `${m.fullName} — ${m.relationship}`,
          href: "/dashboard/family",
        }))
    : [];

  const results: SearchResult[] = [...pageResults, ...memberResults].slice(0, 8);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const first = results[0];
    if (first) {
      router.push(first.href);
      setQuery("");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
          <span className="font-semibold text-[#0B1F3A] lg:hidden">Family Care Hub</span>

          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="relative hidden flex-1 md:block md:max-w-md"
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              aria-label="Search family members and pages"
              placeholder="Search members, pages…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:border-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
            />

            {trimmed.length > 0 ? (
              <ul className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {results.map((r) => (
                  <li key={r.key}>
                    <Link
                      href={r.href}
                      onClick={() => setQuery("")}
                      className="block rounded-lg px-3 py-2 text-sm text-slate-900 hover:bg-slate-100"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
                {results.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-600">No matches</li>
                ) : null}
              </ul>
            ) : null}
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <FamilySelector />
            <NotificationPanel />
            <UserMenu />
          </div>
        </div>
      </header>
      <MobileNavSheet open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
}
