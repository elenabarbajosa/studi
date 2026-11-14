/**
 * Local-day helpers using IANA timezones (DST-safe via Intl).
 * Weekly boundary: Monday 00:00 in the user's timezone.
 */

export function localDateKey(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function localWeekdayMon0(dateKey: string, timeZone: string): number {
  // Parse as noon UTC-ish via Date of local components is tricky; use formatter weekday
  const [y, m, day] = dateKey.split("-").map(Number);
  // Construct an instant that falls on that local calendar day
  const probe = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
  // Adjust by finding offset — use weekday from formatter on a refined instant
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(probe);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  // Refine: walk hours until local date matches dateKey
  const t = Date.UTC(y, m - 1, day, 0, 0, 0) - 14 * 3600_000;
  for (let i = 0; i < 48; i++) {
    const cand = new Date(t + i * 3600_000);
    if (localDateKey(cand, timeZone) === dateKey) {
      const wd = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
      }).format(cand);
      return map[wd] ?? 0;
    }
  }
  return map[weekday] ?? 0;
}

export function addLocalDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function startOfLocalWeekKey(dateKey: string, timeZone: string): string {
  const mon0 = localWeekdayMon0(dateKey, timeZone);
  return addLocalDays(dateKey, -mon0);
}

export function endOfLocalWeekKey(dateKey: string, timeZone: string): string {
  return addLocalDays(startOfLocalWeekKey(dateKey, timeZone), 6);
}

/** Weekday key matching Studi WEEKDAYS (mon…sun). */
export function weekdayKeyFromDateKey(
  dateKey: string,
  timeZone: string,
): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  return keys[localWeekdayMon0(dateKey, timeZone)]!;
}

/**
 * Allocate focus seconds across local calendar days when a session
 * spans midnight. Proportional to wall-clock duration when ends_at exists;
 * otherwise attribute all seconds to the start day.
 */
export function allocateFocusToLocalDays(input: {
  startsAt: string;
  endsAt: string | null;
  focusSeconds: number;
  timeZone: string;
}): Map<string, number> {
  const out = new Map<string, number>();
  const focus = Math.max(0, input.focusSeconds);
  if (focus === 0) return out;

  const start = new Date(input.startsAt);
  const end = input.endsAt ? new Date(input.endsAt) : null;
  const startKey = localDateKey(start, input.timeZone);

  if (!end || Number.isNaN(end.getTime()) || end <= start) {
    out.set(startKey, focus);
    return out;
  }

  const endKey = localDateKey(end, input.timeZone);
  if (startKey === endKey) {
    out.set(startKey, focus);
    return out;
  }

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) {
    out.set(startKey, focus);
    return out;
  }

  // Walk local midnights between start and end
  let cursor = start.getTime();
  const remaining = focus;
  let dayKey = startKey;
  const pieces: { key: string; ms: number }[] = [];

  while (dayKey < endKey) {
    const nextKey = addLocalDays(dayKey, 1);
    // Find first instant of nextKey in this timezone
    const nextMidnight = findLocalMidnightUtc(nextKey, input.timeZone);
    const sliceMs = Math.max(0, Math.min(end.getTime(), nextMidnight) - cursor);
    pieces.push({ key: dayKey, ms: sliceMs });
    cursor = nextMidnight;
    dayKey = nextKey;
  }
  pieces.push({ key: endKey, ms: Math.max(0, end.getTime() - cursor) });

  const sumMs = pieces.reduce((s, p) => s + p.ms, 0) || 1;
  let allocated = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const share =
      i === pieces.length - 1
        ? remaining - allocated
        : Math.floor((focus * p.ms) / sumMs);
    allocated += share;
    if (share > 0) out.set(p.key, (out.get(p.key) ?? 0) + share);
  }
  return out;
}

function findLocalMidnightUtc(dateKey: string, timeZone: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  // Binary-ish search around UTC midnight ±14h
  let lo = Date.UTC(y, m - 1, d) - 14 * 3600_000;
  let hi = Date.UTC(y, m - 1, d) + 14 * 3600_000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const key = localDateKey(new Date(mid), timeZone);
    if (key < dateKey) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Instant of local midnight for `dateKey` in `timeZone`, as an ISO string. */
export function localMidnightIso(dateKey: string, timeZone: string): string {
  return new Date(findLocalMidnightUtc(dateKey, timeZone)).toISOString();
}
