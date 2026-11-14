import { addLocalDays, localDateKey } from "@/lib/progress/timezone";

/**
 * YYYY-MM-DD for a Date in the given IANA timezone (or the runtime's local
 * zone when `timeZone` is omitted). Avoids `toISOString().slice(0, 10)`, which
 * shifts calendar days for UTC+ viewers.
 */
export function calendarDayKey(date: Date | string, timeZone?: string) {
  if (timeZone) return localDateKey(date, timeZone);
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build a contiguous daily series of focus seconds. Keys are local calendar
 * dates in `timeZone` (or the runtime local zone). Public shape matches
 * `FocusStats.daily`.
 */
export function buildDailyFocusSeries(
  sessions: ReadonlyArray<{ starts_at: string; focus_seconds: number | null }>,
  options: {
    /** Inclusive start day as YYYY-MM-DD in the target zone. */
    startKey: string;
    /** Number of days in the series (e.g. 28). */
    dayCount: number;
    timeZone?: string;
  },
): { date: string; seconds: number }[] {
  const { startKey, dayCount, timeZone } = options;
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < dayCount; i++) {
    dailyMap.set(addLocalDays(startKey, i), 0);
  }
  for (const s of sessions) {
    const key = calendarDayKey(s.starts_at, timeZone);
    if (dailyMap.has(key)) {
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + (s.focus_seconds ?? 0));
    }
  }
  return [...dailyMap.entries()].map(([date, seconds]) => ({ date, seconds }));
}
