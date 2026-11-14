import { dailyFocusTotals, type FocusSessionSlice } from "@/lib/progress/streaks";
import {
  addLocalDays,
  endOfLocalWeekKey,
  startOfLocalWeekKey,
} from "@/lib/progress/timezone";

export type WeeklyGoalInput = {
  sessions: FocusSessionSlice[];
  timeZone: string;
  todayKey: string;
  weeklyGoalHours: number | null;
};

export type WeeklyGoalResult = {
  weekStart: string;
  weekEnd: string;
  completedSeconds: number;
  goalSeconds: number | null;
  remainingSeconds: number | null;
  progress: number | null;
  percent: number | null;
  daily: { date: string; focusSeconds: number }[];
  previousWeekSeconds: number;
  previousWeekDeltaSeconds: number;
};

export function computeWeeklyGoal(input: WeeklyGoalInput): WeeklyGoalResult {
  const weekStart = startOfLocalWeekKey(input.todayKey, input.timeZone);
  const weekEnd = endOfLocalWeekKey(input.todayKey, input.timeZone);

  const totals = dailyFocusTotals(input.sessions, input.timeZone);

  let completedSeconds = 0;
  const daily: { date: string; focusSeconds: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addLocalDays(weekStart, i);
    const focusSeconds = totals.get(date) ?? 0;
    daily.push({ date, focusSeconds });
    completedSeconds += focusSeconds;
  }

  let previousWeekSeconds = 0;
  for (let i = 0; i < 7; i++) {
    previousWeekSeconds += totals.get(addLocalDays(weekStart, -7 + i)) ?? 0;
  }

  const goalSeconds =
    input.weeklyGoalHours != null && input.weeklyGoalHours > 0
      ? Math.round(input.weeklyGoalHours * 3600)
      : null;

  const progress =
    goalSeconds != null ? Math.min(1, completedSeconds / goalSeconds) : null;
  const percent = progress != null ? Math.round(progress * 100) : null;
  const remainingSeconds =
    goalSeconds != null ? Math.max(0, goalSeconds - completedSeconds) : null;

  return {
    weekStart,
    weekEnd,
    completedSeconds,
    goalSeconds,
    remainingSeconds,
    progress,
    percent,
    daily,
    previousWeekSeconds,
    previousWeekDeltaSeconds: completedSeconds - previousWeekSeconds,
  };
}
