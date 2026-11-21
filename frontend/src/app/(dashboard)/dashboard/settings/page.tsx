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
    <div className="mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your profile and how Family Care Hub keeps you informed.
        </p>
      </div>

      <div className="space-y-6 mt-6">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Your name as shown to other family members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => setSavedMessage("Saved locally for this session.")}
            >
              Save
            </Button>
            {savedMessage ? (
              <p role="status" className="mt-3 text-sm text-teal-800">
                {savedMessage}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Choose which updates you want to see.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifyOptions.map((option) => (
              <label
                key={option.key}
                className="flex items-center gap-3 text-sm text-slate-800"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 text-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600"
                  checked={notify[option.key]}
                  onChange={(e) =>
                    setNotify((prev) => ({ ...prev, [option.key]: e.target.checked }))
                  }
                />
                {option.label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Data and privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700">
              Demo build: data shown is synthetic and stored only in this browser session.
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Info aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
              Account and data controls will be available once the live service is connected.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
