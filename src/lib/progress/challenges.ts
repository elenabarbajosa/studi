import { dailyFocusTotals, type FocusSessionSlice } from "@/lib/progress/streaks";
import { addLocalDays, localDateKey } from "@/lib/progress/timezone";

export const CHALLENGE_TYPES = [
  "hours",
  "pomodoros",
  "distinct_days",
  "consistency",
] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export type ChallengeProgressInput = {
  type: ChallengeType;
  /** Hours, pomodoro count, distinct days, or days-per-week target. */
  target: number;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  sessions: FocusSessionSlice[];
  /** For consistency: required active days inside the window. */
  minDailyFocusSeconds?: number;
};

export type ChallengeProgressResult = {
  current: number;
  target: number;
  percent: number;
  completed: boolean;
};

/**
 * Progress from verified focus/study_together sessions inside [startsAt, endsAt].
 * Activity outside the window is ignored.
 */
export function computeChallengeProgress(
  input: ChallengeProgressInput,
): ChallengeProgressResult {
  const minDaily = input.minDailyFocusSeconds ?? 15 * 60;
  const start = new Date(input.startsAt).getTime();
  const end = new Date(input.endsAt).getTime();
  const inRange = input.sessions.filter((s) => {
    if (s.status !== "completed") return false;
    if (s.source !== "focus" && s.source !== "study_together") return false;
    const t = new Date(s.starts_at).getTime();
    return t >= start && t <= end;
  });

  let current = 0;

  if (input.type === "hours") {
    const seconds = inRange.reduce((sum, s) => sum + (s.focus_seconds ?? 0), 0);
    current = seconds / 3600;
  } else if (input.type === "pomodoros") {
    // Approximate: each completed focus session with pomodoro_cycles; callers
    // should pass pomodoro_cycles via a widened session type. Fallback: 1 per session.
    current = inRange.reduce((sum, s) => {
      const cycles = (s as { pomodoro_cycles?: number }).pomodoro_cycles ?? 0;
      return sum + Math.max(0, cycles);
    }, 0);
  } else if (input.type === "distinct_days" || input.type === "consistency") {
    const totals = dailyFocusTotals(inRange, input.timeZone);
    const startKey = localDateKey(input.startsAt, input.timeZone);
    const endKey = localDateKey(input.endsAt, input.timeZone);
    let key = startKey;
    let active = 0;
    while (key <= endKey) {
      if ((totals.get(key) ?? 0) >= minDaily) active += 1;
      key = addLocalDays(key, 1);
    }
    current = active;
  }

  const target = Math.max(0, input.target);
  const percent =
    target <= 0 ? 0 : Math.min(100, Math.round((current / target) * 100));
  return {
    current: Math.round(current * 100) / 100,
    target,
    percent,
    completed: target > 0 && current + 1e-9 >= target,
  };
}
