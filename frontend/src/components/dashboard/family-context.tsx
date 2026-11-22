"use client";

import type { JSX } from "react";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dashboardKeys, fetchFamilies } from "@/lib/dashboard/queries";
import type { Family } from "@/lib/dashboard/types";

interface FamilyContextValue {
  families: Family[];
  selectedFamily: Family | undefined;
  selectedFamilyId: string;
  setSelectedFamilyId: (id: string) => void;
  isLoading: boolean;
  error: Error | null;
  refetchFamilies: () => void;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

function FamilyProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [chosenFamilyId, setSelectedFamilyId] = useState<string>("");

  const query = useQuery({
    queryKey: dashboardKeys.families,
    queryFn: fetchFamilies,
  });

  const families = useMemo<Family[]>(() => query.data ?? [], [query.data]);
  const selectedFamilyId: string = families.some((f) => f.id === chosenFamilyId)
    ? chosenFamilyId
    : (families[0]?.id ?? "");
  const selectedFamily: Family | undefined = families.find((f) => f.id === selectedFamilyId);
  const error: Error | null = query.error instanceof Error ? query.error : null;
  const isLoading: boolean = query.isLoading;
  const { refetch } = query;
  const refetchFamilies = useCallback((): void => {
    void refetch();
  }, [refetch]);

  const value = useMemo<FamilyContextValue>(
    () => ({
      families,
      selectedFamily,
      selectedFamilyId,
      setSelectedFamilyId,
      isLoading,
      error,
      refetchFamilies,
    }),
    [families, selectedFamily, selectedFamilyId, isLoading, error, refetchFamilies],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function AppProviders({ children }: { children: React.ReactNode }): JSX.Element {
  const [queryClient] = useState<QueryClient>(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FamilyProvider>{children}</FamilyProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function useFamily(): FamilyContextValue {
  const context = useContext(FamilyContext);
  if (context === null) {
    throw new Error("useFamily must be used inside AppProviders");
  }
  return context;
}
