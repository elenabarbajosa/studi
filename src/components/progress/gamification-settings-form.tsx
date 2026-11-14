"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateGamificationPreferences } from "@/actions/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { GamificationPreferences } from "@/lib/progress/types";
import { WEEKDAY_LABELS, WEEKDAYS, type Weekday } from "@/lib/subjects";
import { cn } from "@/lib/utils";

type Props = {
  prefs: GamificationPreferences;
  weeklyGoalHours: number | null;
};

export function GamificationSettingsForm({ prefs, weeklyGoalHours }: Props) {
  const [enabled, setEnabled] = useState(prefs.enabled);
  const [leaderboard, setLeaderboard] = useState(prefs.leaderboard_opt_in);
  const [notifications, setNotifications] = useState(
    prefs.achievement_notifications,
  );
  const [acceptInvites, setAcceptInvites] = useState(
    prefs.accept_challenge_invites,
  );
  const [timezone, setTimezone] = useState(prefs.timezone);
  const [minMinutes, setMinMinutes] = useState(prefs.min_daily_focus_minutes);
  const [restDays, setRestDays] = useState<Weekday[]>(prefs.rest_days);
  const [goalHours, setGoalHours] = useState(
    weeklyGoalHours != null ? String(weeklyGoalHours) : "",
  );
  const [isPending, startTransition] = useTransition();

  function toggleRest(day: Weekday) {
    setRestDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await updateGamificationPreferences({
        enabled,
        leaderboard_opt_in: leaderboard,
        achievement_notifications: notifications,
        accept_challenge_invites: acceptInvites,
        timezone: timezone || "UTC",
        min_daily_focus_minutes: minMinutes,
        rest_days: restDays,
        weekly_goal_hours: goalHours === "" ? null : Number(goalHours),
      });
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Saved");
    });
  }

  return (
    <section className="studi-panel space-y-6 p-6 sm:p-8">
      <div>
        <h2 className="font-display text-2xl tracking-tight">Progress & gamification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional streaks, achievements, challenges, and friends leaderboards.
          Turning this off hides competitive surfaces without deleting focus history.
        </p>
      </div>

      <ToggleRow
        label="Enable gamification"
        description="Show Progress hub widgets and evaluate achievements."
        checked={enabled}
        onCheckedChange={setEnabled}
        disabled={isPending}
      />
      <ToggleRow
        label="Friends leaderboard"
        description="Opt in to weekly verified focus-time rankings among friends. Default off."
        checked={leaderboard}
        onCheckedChange={setLeaderboard}
        disabled={isPending || !enabled}
      />
      <ToggleRow
        label="Achievement notifications"
        description="Celebrate unlocks after saving a focus session."
        checked={notifications}
        onCheckedChange={setNotifications}
        disabled={isPending || !enabled}
      />
      <ToggleRow
        label="Accept challenge invites"
        description="Allow friends to invite you to collaborative challenges."
        checked={acceptInvites}
        onCheckedChange={setAcceptInvites}
        disabled={isPending || !enabled}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <Input
            id="tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Europe/Madrid"
          />
          <p className="text-xs text-muted-foreground">
            IANA timezone for streaks and weekly boundaries (Monday start).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="min-focus">Min focus minutes / active day</Label>
          <Input
            id="min-focus"
            type="number"
            min={1}
            max={180}
            value={minMinutes}
            onChange={(e) => setMinMinutes(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weekly-goal">Weekly study hours goal</Label>
          <Input
            id="weekly-goal"
            type="number"
            min={0}
            max={80}
            step={0.5}
            value={goalHours}
            onChange={(e) => setGoalHours(e.target.value)}
            placeholder="e.g. 10"
          />
          <p className="text-xs text-muted-foreground">
            Stored on your study preferences (same as Statistics).
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Rest days</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Rest days preserve a streak without increasing it when you skip studying.
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleRest(day)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm",
                restDays.includes(day)
                  ? "border-primary bg-brand-soft"
                  : "border-border hover:bg-muted/60",
              )}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      <Button type="button" onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save progress settings"}
      </Button>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
