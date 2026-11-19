import { zonedDateTimeToUtcIso } from "@/lib/planner/zoned-time";
import { localDateKey } from "@/lib/progress/timezone";

/** Shared copy for the end-before-start check (client, schema, and database). */
export const END_BEFORE_START_MESSAGE = "End time must be after the start time.";

export function isValidIanaTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer the timezone that produced the wall-clock strings (the browser),
 * then the profile timezone, then UTC. Never the server's local zone.
 */
export function resolveTimeZone(
  candidate: unknown,
  fallback?: string | null,
): string {
  if (typeof candidate === "string" && isValidIanaTimeZone(candidate.trim())) {
    return candidate.trim();
  }
  if (fallback && isValidIanaTimeZone(fallback)) return fallback;
  return "UTC";
}

export function browserTimeZone(): string {
  try {
    return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "UTC";
  }
}

export function endAfterStartError(
  start: string,
  end: string,
  required: boolean,
): string | null {
  if (!start && !end) {
    return required ? "Add a start and end time." : null;
  }
  if (required && (!start || !end)) return "Add a start and end time.";
  if (start && end && end <= start) return END_BEFORE_START_MESSAGE;
  return null;
}

/** Keep the previous duration when the start moves, clamped to the same day. */
export function shiftEndPreservingDuration(
  previousStart: string,
  nextStart: string,
  previousEnd: string,
): string {
  const prevStart = minutesOf(previousStart);
  const next = minutesOf(nextStart);
  const prevEnd = minutesOf(previousEnd);
  if (prevStart === null || next === null || prevEnd === null) return previousEnd;
  const shifted = prevEnd + (next - prevStart);
  if (shifted <= 0) return "00:00";
  if (shifted >= 24 * 60) return "23:59";
  const h = Math.floor(shifted / 60);
  const m = shifted % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesOf(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function isPastCalendarEvent(input: {
  date: string;
  startTime?: string | null;
  allDay: boolean;
  timeZone: string;
  now?: Date;
}): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return false;
  const now = input.now ?? new Date();
  const timeZone = resolveTimeZone(input.timeZone);
  if (input.allDay || !input.startTime) {
    return input.date < localDateKey(now, timeZone);
  }
  try {
    const start = zonedDateTimeToUtcIso(input.date, input.startTime, timeZone);
    return new Date(start).getTime() < now.getTime();
  } catch {
    return false;
  }
}

/**
 * Turn a Postgres check-constraint failure into something a student can act on.
 * Unknown database errors stay generic so raw constraint names never reach the form.
 */
export function friendlyWriteError(message: string): string {
  if (/ends_after_start|schedule_order/i.test(message)) {
    return END_BEFORE_START_MESSAGE;
  }
  if (/violates check constraint/i.test(message)) {
    return "That couldn't be saved. Check the details and try again.";
  }
  return "Couldn't save this. Please try again.";
}
