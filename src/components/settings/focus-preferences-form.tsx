"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveFocusPreferences } from "@/actions/focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOUNDSCAPE_IDS, type SoundscapeId } from "@/lib/calendar";
import { SOUNDSCAPE_META } from "@/lib/focus/soundscapes";
import type { FocusPreferences } from "@/lib/focus/types";

type FocusPreferencesFormProps = {
  preferences: FocusPreferences;
};

export function FocusPreferencesForm({
  preferences,
}: FocusPreferencesFormProps) {
  const [prefs, setPrefs] = useState(preferences);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveFocusPreferences(prefs);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Saved");
    });
  }

  return (
    <section className="studi-panel p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl tracking-tight">
          Focus & Pomodoro
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize cycle lengths, break behavior, and ambient sound defaults.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Focus minutes"
          type="number"
          min={5}
          max={120}
          value={prefs.pomodoro_focus_minutes}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, pomodoro_focus_minutes: v }))
          }
        />
        <Field
          label="Short break"
          type="number"
          min={1}
          max={30}
          value={prefs.pomodoro_short_break_minutes}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, pomodoro_short_break_minutes: v }))
          }
        />
        <Field
          label="Long break"
          type="number"
          min={5}
          max={60}
          value={prefs.pomodoro_long_break_minutes}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, pomodoro_long_break_minutes: v }))
          }
        />
        <Field
          label="Intervals before long break"
          type="number"
          min={2}
          max={8}
          value={prefs.pomodoro_intervals_before_long}
          onChange={(v) =>
            setPrefs((p) => ({ ...p, pomodoro_intervals_before_long: v }))
          }
        />
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prefs.auto_start_breaks}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, auto_start_breaks: e.target.checked }))
          }
        />
        Automatically start breaks and next focus intervals
      </label>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={prefs.focus_sound_enabled}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, focus_sound_enabled: e.target.checked }))
          }
        />
        Enable ambient sounds and phase chimes
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pref-primary">Default soundscape</Label>
          <select
            id="pref-primary"
            value={prefs.soundscape_primary}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                soundscape_primary: e.target.value as SoundscapeId,
              }))
            }
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {SOUNDSCAPE_IDS.map((id) => (
              <option key={id} value={id}>
                {SOUNDSCAPE_META[id].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pref-secondary">Default mix</Label>
          <select
            id="pref-secondary"
            value={prefs.soundscape_secondary}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                soundscape_secondary: e.target.value as SoundscapeId,
              }))
            }
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {SOUNDSCAPE_IDS.map((id) => (
              <option key={id} value={id}>
                {SOUNDSCAPE_META[id].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6">
        <Button type="button" disabled={isPending} onClick={save}>
          {isPending ? "Saving…" : "Save focus preferences"}
        </Button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "number",
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
