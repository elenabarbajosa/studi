"use client";

import { useCallback, useEffect, useState } from "react";

import { updateGamificationPreferences } from "@/actions/progress";
import { useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { useAutosave } from "@/components/settings/use-autosave";
import { Field, SwitchRow } from "@/components/studi/form-controls";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { GamificationPreferences } from "@/lib/progress/types";
import { WEEKDAY_LABELS, WEEKDAYS, type Weekday } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export function GamificationSettingsForm({
  prefs,
  weeklyGoalHours,
}: {
  prefs: GamificationPreferences;
  weeklyGoalHours: number | null;
}) {
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
  const [goalHours, setGoalHours] = useState(weeklyGoalHours ?? 0);
  const { setStatus } = useSettingsSaveStatus();

  const payload = {
    enabled,
    leaderboard_opt_in: leaderboard,
    achievement_notifications: notifications,
    accept_challenge_invites: acceptInvites,
    timezone: timezone || "UTC",
    min_daily_focus_minutes: minMinutes,
    rest_days: restDays,
    weekly_goal_hours: goalHours > 0 ? goalHours : null,
  };

  const save = useCallback(async (next: typeof payload) => {
    return updateGamificationPreferences(next);
  }, []);

  const { status, error } = useAutosave(payload, save);
  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  function toggleRest(day: Weekday) {
    setRestDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[14px] text-ink-2">
        Optional streaks, achievements, challenges and friends leaderboards. Turning
        this off hides competitive surfaces without deleting focus history.
      </p>

      <div className="flex flex-col gap-2">
        <SwitchRow
          label="Enable Progress features"
          checked={enabled}
          onChange={setEnabled}
        />
        <SwitchRow
          label="Friends leaderboard"
          checked={leaderboard}
          onChange={(v) => enabled && setLeaderboard(v)}
        />
        <SwitchRow
          label="Achievement notifications"
          checked={notifications}
          onChange={(v) => enabled && setNotifications(v)}
        />
        <SwitchRow
          label="Accept challenge invites"
          checked={acceptInvites}
          onChange={(v) => enabled && setAcceptInvites(v)}
        />
      </div>
      {!enabled ? (
        <p className="text-[12.5px] text-ink-3">
          Leaderboard, notifications and invites stay off while Progress features are
          disabled.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[22px] bg-sunken p-5 md:rounded-[26px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-medium text-ink">Weekly study goal</span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
            {goalHours === 0 ? "Off" : `${goalHours}h`}
          </span>
        </div>
        <Slider
          min={0}
          max={60}
          step={1}
          value={[goalHours]}
          onValueChange={(v) =>
            setGoalHours(Array.isArray(v) ? Number(v[0]) : Number(v))
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-sunken p-5 md:rounded-[26px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-medium text-ink">
            Min focus for an active day
          </span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">
            {minMinutes}
            <span className="ml-1 text-[13px] font-medium text-ink-2">min</span>
          </span>
        </div>
        <Slider
          min={1}
          max={60}
          step={1}
          value={[minMinutes]}
          onValueChange={(v) =>
            setMinMinutes(Array.isArray(v) ? Number(v[0]) : Number(v))
          }
        />
        <p className="text-[12.5px] text-ink-3">
          Days below this threshold don’t count toward your streak.
        </p>
      </div>

      <div>
        <p className="mb-1 text-[14px] font-medium text-ink">Rest days</p>
        <p className="mb-3 text-[12.5px] text-ink-3">
          Rest days keep a streak without growing it when you skip studying.
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleRest(day)}
              className={cn(
                "rounded-full px-3.5 py-2 text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                restDays.includes(day)
                  ? "bg-warning-soft text-warning"
                  : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
              )}
              aria-pressed={restDays.includes(day)}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Timezone" htmlFor="tz">
        <Input
          id="tz"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="Europe/Madrid"
        />
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          IANA timezone for streaks and weekly boundaries (weeks start Monday).
        </p>
      </Field>

      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
