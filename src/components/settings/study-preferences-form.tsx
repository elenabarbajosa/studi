"use client";

import { useActionState, useState } from "react";

import {
  saveStudyPreferences,
  type ActionState,
} from "@/actions/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BREAK_DURATION_OPTIONS,
  DEFAULT_WEEKDAY_AVAILABILITY,
  SESSION_DURATION_OPTIONS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type WeekdayAvailability,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { StudyPreferences } from "@/types/database";

const initial: ActionState = {};

type StudyPreferencesFormProps = {
  preferences: StudyPreferences | null;
};

export function StudyPreferencesForm({
  preferences,
}: StudyPreferencesFormProps) {
  const [state, formAction, pending] = useActionState(
    saveStudyPreferences,
    initial,
  );
  const [availability, setAvailability] = useState<WeekdayAvailability>(
    preferences?.weekday_availability ?? DEFAULT_WEEKDAY_AVAILABILITY,
  );

  return (
    <section className="studi-panel p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl tracking-tight">
          Study preferences
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Weekly availability, session length, breaks, and goals — unique to
          your schedule.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium">Typical availability</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className={cn(
                  "cursor-pointer rounded-xl border px-3 py-2 text-sm",
                  availability[day]
                    ? "border-primary bg-brand-soft"
                    : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  name={`day_${day}`}
                  checked={availability[day]}
                  onChange={(e) =>
                    setAvailability((prev) => ({
                      ...prev,
                      [day]: e.target.checked,
                    }))
                  }
                  className="sr-only"
                />
                {WEEKDAY_LABELS[day]}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="session_duration_minutes">Session duration</Label>
            <select
              id="session_duration_minutes"
              name="session_duration_minutes"
              defaultValue={preferences?.session_duration_minutes ?? 50}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              {SESSION_DURATION_OPTIONS.map((mins) => (
                <option key={mins} value={mins}>
                  {mins} minutes
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="break_duration_minutes">Break duration</Label>
            <select
              id="break_duration_minutes"
              name="break_duration_minutes"
              defaultValue={preferences?.break_duration_minutes ?? 10}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              {BREAK_DURATION_OPTIONS.map((mins) => (
                <option key={mins} value={mins}>
                  {mins === 0 ? "No break" : `${mins} minutes`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="weekly_goal_hours">
            Weekly study goal (hours, optional)
          </Label>
          <Input
            id="weekly_goal_hours"
            name="weekly_goal_hours"
            type="number"
            min={0}
            max={80}
            step={0.5}
            defaultValue={preferences?.weekly_goal_hours ?? ""}
            placeholder="e.g. 12"
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-primary" role="status">
            {state.success}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save study preferences"}
        </Button>
      </form>
    </section>
  );
}
