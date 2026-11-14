import {
  addLocalDays,
  allocateFocusToLocalDays,
  localDateKey,
  startOfLocalWeekKey,
  weekdayKeyFromDateKey,
} from "@/lib/progress/timezone";
import type { Weekday } from "@/lib/subjects";

export type FocusSessionSlice = {
  starts_at: string;
  ends_at: string | null;
  focus_seconds: number;
  status: string;
  source: string;
};

export type StreakConfig = {
  timeZone: string;
  /** Minimum focus seconds for a day to count as active. Default 15 min. */
  minDailyFocusSeconds: number;
  /** Days that preserve streak without incrementing when inactive. */
  restDays: Weekday[];
  /** Optional: require at least N active days per rolling week (Mon–Sun). */
  consistencyDaysPerWeek: number | null;
  /** "Today" in the user's timezone — usually localDateKey(now). */
  todayKey: string;
};

export type DayActivity = {
  date: string;
  focusSeconds: number;
  active: boolean;
  rest: boolean;
  status: "active" | "rest" | "missed" | "future" | "empty";
};

export type StreakResult = {
  currentStreak: number;
  longestStreak: number;
  todayFocusSeconds: number;
  todayActive: boolean;
  days: DayActivity[];
  activeDaysThisWeek: number;
};

const VALID_SOURCES = new Set(["focus", "study_together"]);

/**
 * Build per-local-day focus totals from completed verified sessions.
 * Breaks never appear (focus_seconds only). Planned calendar sessions excluded by source.
 */
export function dailyFocusTotals(
  sessions: FocusSessionSlice[],
  timeZone: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    if (!VALID_SOURCES.has(s.source)) continue;
    const parts = allocateFocusToLocalDays({
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      focusSeconds: s.focus_seconds ?? 0,
      timeZone,
    });
    for (const [key, sec] of parts) {
      totals.set(key, (totals.get(key) ?? 0) + sec);
    }
  }
  return totals;
}

function isRestDay(dateKey: string, timeZone: string, restDays: Weekday[]) {
  const wd = weekdayKeyFromDateKey(dateKey, timeZone);
  return restDays.includes(wd);
}

/**
 * Compute current/longest streaks.
 *
 * Rules:
 * - A day is active if focusSeconds >= minDailyFocusSeconds.
 * - Configured rest days with no active study preserve the streak (do not break,
 *   do not increment).
 * - Studying on a rest day still counts as active and increments.
 * - The current (incomplete) day does not break the streak if still empty.
 * - Walk backwards from yesterday (or today if already active).
 */
export function computeStreaks(
  sessions: FocusSessionSlice[],
  config: StreakConfig,
  historyDays = 120,
): StreakResult {
  const totals = dailyFocusTotals(sessions, config.timeZone);
  const today = config.todayKey;
  const todaySec = totals.get(today) ?? 0;
  const todayActive = todaySec >= config.minDailyFocusSeconds;

  const days: DayActivity[] = [];
  for (let i = historyDays - 1; i >= 0; i--) {
    const key = addLocalDays(today, -i);
    const focusSeconds = totals.get(key) ?? 0;
    const rest = isRestDay(key, config.timeZone, config.restDays);
    const active = focusSeconds >= config.minDailyFocusSeconds;
    let status: DayActivity["status"] = "empty";
    if (key > today) status = "future";
    else if (active) status = "active";
    else if (rest) status = "rest";
    else if (focusSeconds === 0 && key < today) status = "missed";
    else if (!active && focusSeconds > 0) status = "empty";
    days.push({ date: key, focusSeconds, active, rest, status });
  }

  // Current streak: walk back from today if active, else yesterday
  let cursor = todayActive ? today : addLocalDays(today, -1);
  let current = 0;
  while (true) {
    if (cursor > today) break;
    const sec = totals.get(cursor) ?? 0;
    const active = sec >= config.minDailyFocusSeconds;
    const rest = isRestDay(cursor, config.timeZone, config.restDays);
    if (active) {
      current += 1;
      cursor = addLocalDays(cursor, -1);
      continue;
    }
    if (rest && cursor !== today) {
      // preserve — skip without increment
      cursor = addLocalDays(cursor, -1);
      continue;
    }
    // Today incomplete empty: do not break when starting from yesterday path
    if (cursor === today && !todayActive) {
      cursor = addLocalDays(cursor, -1);
      continue;
    }
    break;
  }

  // Longest streak over history
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.date > today) continue;
    if (day.active) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (day.rest) {
      // preserve run
    } else if (day.date === today && !todayActive) {
      // ignore incomplete today
    } else {
      run = 0;
    }
  }
  longest = Math.max(longest, current);

  const weekStart = startOfLocalWeekKey(today, config.timeZone);
  let activeDaysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const key = addLocalDays(weekStart, i);
    if ((totals.get(key) ?? 0) >= config.minDailyFocusSeconds) {
      activeDaysThisWeek += 1;
    }
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    todayFocusSeconds: todaySec,
    todayActive,
    days,
    activeDaysThisWeek,
  };
}

export function defaultTodayKey(timeZone: string) {
  return localDateKey(new Date(), timeZone);
}
