"use client";

import type { JSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser, signOut } from "@/lib/auth/auth-service";

const FALLBACK_INITIALS = "FC";
const MAX_INITIALS = 2;

function computeInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, MAX_INITIALS)
    .join("");
  return letters.length > 0 ? letters : FALLBACK_INITIALS;
}

export function UserMenu(): JSX.Element {
  const userQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const result = await getCurrentUser();
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.data;
    },
  });

  const user = userQuery.data ?? null;
  const displayName = user?.fullName ?? user?.email ?? "Account";
  const initials = computeInitials(displayName);

  const [signOutError, setSignOutError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSignOut(): Promise<void> {
    setSignOutError(null);
    const result = await signOut();
    if (!result.ok) {
      setSignOutError(result.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2"
          aria-label={`Account menu for ${displayName}`}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-[#0B1F3A] text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-slate-900 lg:inline">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="z-[100] w-64 rounded-xl border border-slate-200 bg-white p-1 text-slate-900 opacity-100 shadow-xl backdrop-blur-none">
        <DropdownMenuLabel className="flex flex-col gap-1 bg-white px-3 py-3">
          <span className="text-sm font-medium text-slate-900">
            {displayName}
          </span>
          {user?.email ? (
            <span className="text-xs font-normal text-slate-500">
              {user.email}
            </span>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:bg-slate-100 focus:text-slate-900">
          <Link href="/dashboard/settings">
            <Settings aria-hidden="true" className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            void handleSignOut();
          }}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>

        {signOutError ? (
          <p role="alert" className="px-2 py-1.5 text-xs text-red-700">
            {signOutError}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

