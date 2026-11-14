import type { PlannerPreferencesInput } from "@/lib/planner/schemas";
import { addLocalDays, localDateKey, weekdayKeyFromDateKey } from "@/lib/progress/timezone";

export function resolvePeriodBounds(
  prefs: PlannerPreferencesInput,
  timeZone: string,
  assessments: { id: string; starts_at: string }[],
  now = new Date(),
): { periodStart: string; periodEnd: string } {
  const today = localDateKey(now, timeZone);

  if (prefs.planning_period === "today") {
    return { periodStart: today, periodEnd: today };
  }
  if (prefs.planning_period === "tomorrow") {
    const tomorrow = addLocalDays(today, 1);
    return { periodStart: tomorrow, periodEnd: tomorrow };
  }
  if (prefs.planning_period === "custom" && prefs.target_date) {
    return { periodStart: prefs.target_date, periodEnd: prefs.target_date };
  }

  if (prefs.planning_period === "until_exam" && prefs.until_assessment_id) {
    const exam = assessments.find((a) => a.id === prefs.until_assessment_id);
    if (exam) {
      const end = localDateKey(exam.starts_at, timeZone);
      if (end >= today) return { periodStart: today, periodEnd: end };
    }
  }
  const span =
    prefs.planning_period === "7" ? 6 : prefs.planning_period === "30" ? 29 : 13;
  return { periodStart: today, periodEnd: addLocalDays(today, span) };
}

/**
 * For one-day plans, ensure the target weekday is available with at least one
 * window so the scheduler can place sessions (user-selected day overrides rest).
 */
export function ensureDayAvailability(
  prefs: PlannerPreferencesInput,
  dateKey: string,
  timeZone: string,
): PlannerPreferencesInput {
  const weekday = weekdayKeyFromDateKey(dateKey, timeZone);
  const windows = structuredClone(prefs.time_windows);
  const availability = { ...prefs.weekday_availability };
  availability[weekday] = true;
  if ((windows[weekday] ?? []).length === 0) {
    windows[weekday] = [
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "18:00" },
    ];
  }
  const rest_days = prefs.rest_days.filter((d) => d !== weekday);
  return {
    ...prefs,
    weekday_availability: availability,
    time_windows: windows,
    rest_days,
  };
}
