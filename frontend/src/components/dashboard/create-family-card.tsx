"use client";

import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFamily, dashboardKeys } from "@/lib/dashboard/queries";
import { useFamily } from "./family-context";

const MAX_FAMILY_NAME_LENGTH = 120;

export function CreateFamilyCard(): JSX.Element {
  const [name, setName] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { setSelectedFamilyId } = useFamily();

  const mutation = useMutation({
    mutationFn: (familyName: string) => createFamily(familyName),
    onSuccess: async (family) => {
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.families });
      setSelectedFamilyId(family.id);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setValidationError("Enter a family name.");
      return;
    }
    if (trimmed.length > MAX_FAMILY_NAME_LENGTH) {
      setValidationError(`Family name must be ${MAX_FAMILY_NAME_LENGTH} characters or fewer.`);
      return;
    }
    setValidationError(null);
    mutation.mutate(trimmed);
  }

  const errorMessage: string | null =
    validationError ??
    (mutation.error instanceof Error ? mutation.error.message : null);

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="text-teal-700" aria-hidden="true" />
          Create your first family
        </CardTitle>
        <CardDescription>
          You do not belong to a family yet. Give your family a name to get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="family-name">Family name</Label>
            <Input
              id="family-name"
              name="name"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? "family-name-error" : undefined}
            />
          </div>
          {errorMessage ? (
            <p id="family-name-error" role="alert" className="text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={mutation.isPending} className="w-fit">
            {mutation.isPending ? "Creating…" : "Create family"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
