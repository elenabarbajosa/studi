"use client";

import { useCallback, useEffect, useState } from "react";

import { saveStudyPreferences } from "@/actions/preferences";
import { useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { useAutosave } from "@/components/settings/use-autosave";
import { Slider } from "@/components/ui/slider";
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

export function StudyPreferencesForm({
  preferences,
}: {
  preferences: StudyPreferences | null;
}) {
  const [availability, setAvailability] = useState<WeekdayAvailability>(
    preferences?.weekday_availability ?? DEFAULT_WEEKDAY_AVAILABILITY,
  );
  const [sessionDuration, setSessionDuration] = useState(
    preferences?.session_duration_minutes ?? 50,
  );
  const [breakDuration, setBreakDuration] = useState(
    preferences?.break_duration_minutes ?? 10,
  );
  const [weeklyGoal, setWeeklyGoal] = useState(
    preferences?.weekly_goal_hours ?? 0,
  );
  const { setStatus } = useSettingsSaveStatus();

  const payload = {
    availability,
    sessionDuration,
    breakDuration,
    weeklyGoal,
  };

  const save = useCallback(async (next: typeof payload) => {
    const fd = new FormData();
    for (const day of WEEKDAYS) {
      if (next.availability[day]) fd.set(`day_${day}`, "on");
    }
    fd.set("session_duration_minutes", String(next.sessionDuration));
    fd.set("break_duration_minutes", String(next.breakDuration));
    if (next.weeklyGoal > 0) {
      fd.set("weekly_goal_hours", String(next.weeklyGoal));
    } else {
      fd.set("weekly_goal_hours", "");
    }
    return saveStudyPreferences({}, fd);
  }, []);

  const { status, error } = useAutosave(payload, save);
  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  return (
    <div className="flex flex-col gap-7">
      <p className="text-[14px] text-ink-2">
        Typical study days and session habits. Weekly goal is also used on Progress and
        Statistics.
      </p>

      <div>
        <p className="mb-3 text-[14px] font-medium text-ink">Typical availability</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() =>
                setAvailability((prev) => ({ ...prev, [day]: !prev[day] }))
              }
              className={cn(
                "rounded-full px-3.5 py-2 text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                availability[day]
                  ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                  : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
              )}
              aria-pressed={availability[day]}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[14px] font-medium text-ink">Preferred session</p>
        <div className="flex flex-wrap gap-2">
          {SESSION_DURATION_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setSessionDuration(mins)}
              className={cn(
                "rounded-full px-3.5 py-2 text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                sessionDuration === mins
                  ? "bg-accent-soft text-accent-text"
                  : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
              )}
              aria-pressed={sessionDuration === mins}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[14px] font-medium text-ink">Break between sessions</p>
        <div className="flex flex-wrap gap-2">
          {BREAK_DURATION_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setBreakDuration(mins)}
              className={cn(
                "rounded-full px-3.5 py-2 text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                breakDuration === mins
                  ? "bg-accent-soft text-accent-text"
                  : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
              )}
              aria-pressed={breakDuration === mins}
            >
              {mins === 0 ? "None" : `${mins}m`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[22px] bg-sunken p-5 md:rounded-[26px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-medium text-ink">Weekly study goal</span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
            {weeklyGoal === 0 ? "Off" : `${weeklyGoal}h`}
          </span>
        </div>
        <Slider
          min={0}
          max={60}
          step={1}
          value={[weeklyGoal]}
          onValueChange={(v) =>
            setWeeklyGoal(Array.isArray(v) ? Number(v[0]) : Number(v))
          }
        />
        <div className="flex justify-between text-[11.5px] text-ink-3">
          <span>Off</span>
          <span>60h</span>
        </div>
      </div>

      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
