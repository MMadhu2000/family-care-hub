"use client";

import type { JSX } from "react";
import { useState } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NotifyKey = "appointments" | "tasks" | "activity";

interface NotifySettings {
  appointments: boolean;
  tasks: boolean;
  activity: boolean;
}

export default function SettingsPage(): JSX.Element {
  const [displayName, setDisplayName] = useState<string>("Demo Parent");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [notify, setNotify] = useState<NotifySettings>({
    appointments: true,
    tasks: true,
    activity: true,
  });

  const notifyOptions: ReadonlyArray<{ key: NotifyKey; label: string }> = [
    { key: "appointments", label: "Appointment reminders" },
    { key: "tasks", label: "Task due dates" },
    { key: "activity", label: "Family activity" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 bg-transparent p-1">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your profile and how Family Care Hub keeps you informed.
        </p>
      </header>

      <section className="space-y-6">
        <Card className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Profile
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Your name as shown to other family members.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name" className="text-sm font-medium text-slate-800">
                Display name
              </Label>

              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setSavedMessage(null);
                }}
                className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-teal-600"
              />
            </div>

            <Button
              type="button"
              onClick={() => setSavedMessage("Saved locally for this session.")}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              Save
            </Button>

            {savedMessage ? (
              <p role="status" className="text-sm font-medium text-teal-800">
                {savedMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Notifications
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Choose which updates you want to see.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {notifyOptions.map((option) => (
              <label
                key={option.key}
                className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800"
              >
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer rounded border-slate-300 accent-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  checked={notify[option.key]}
                  onChange={(e) =>
                    setNotify((prev) => ({
                      ...prev,
                      [option.key]: e.target.checked,
                    }))
                  }
                />
                {option.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Data and privacy
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-slate-700">
              Data shown is loaded from your account on the live service.
            </p>

            <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
              <Info
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-slate-500"
              />
              Account and data controls will be available once the live service is connected.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
