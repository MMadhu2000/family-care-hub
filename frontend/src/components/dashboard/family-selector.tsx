"use client";

import type { JSX } from "react";
import { Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFamily } from "./family-context";

export function FamilySelector(): JSX.Element {
  const { families, selectedFamilyId, setSelectedFamilyId, isLoading, error } =
    useFamily();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedFamilyId}
        onValueChange={setSelectedFamilyId}
        disabled={isLoading || families.length === 0}
      >
        <SelectTrigger aria-label="Select family" className="w-full bg-white sm:w-[200px]">
          <Users aria-hidden="true" className="size-4 text-teal-700" />
          <SelectValue placeholder={isLoading ? "Loading families…" : "No family"} />
        </SelectTrigger>
        <SelectContent>
          {families.map((family) => (
            <SelectItem key={family.id} value={family.id}>
              {family.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <span role="status" className="text-xs text-red-700">
          Families unavailable
        </span>
      ) : null}
    </div>
  );
}
