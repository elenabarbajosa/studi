import { localDateKey } from "@/lib/progress/timezone";

export type CountdownMode = "days" | "detailed";

export type CountdownParts = {
  /** Whole calendar days remaining (0 = today). Never negative for display. */
  days: number;
  /** True when the assessment has a clock time (not all-day / date-only). */
  hasTime: boolean;
  /** Remaining until the timestamp; null when date-only or already started. */
  remainingMs: number | null;
  hours: number;
  minutes: number;
  seconds: number;
  /** Human label for Days mode. */
  daysLabel: string;
  /** Human label for Detailed mode (or note when time unavailable). */
  detailedLabel: string;
  /** Past / started — hide negative countdowns. */
  isPast: boolean;
};

function startOfLocalCalendarDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calendar-day distance in a specific IANA timezone (0 = same local day).
 */
export function calendarDaysUntil(
  iso: string,
  timeZone: string,
  now = new Date(),
) {
  const today = localDateKey(now, timeZone);
  const target = localDateKey(iso, timeZone);
  const a = Date.parse(`${today}T12:00:00Z`);
  const b = Date.parse(`${target}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Derive countdown parts for an assessment.
 * Date-only (`allDay`) never invents a clock time for Detailed mode.
 */
export function assessmentCountdown(input: {
  startsAt: string;
  allDay: boolean;
  timeZone: string;
  now?: Date;
}): CountdownParts {
  const now = input.now ?? new Date();
  const start = new Date(input.startsAt);
  const days = calendarDaysUntil(input.startsAt, input.timeZone, now);
  const hasTime = !input.allDay;

  if (!hasTime) {
    const isPast = days < 0;
    const safeDays = Math.max(0, days);
    const daysLabel =
      isPast ? "Passed" : safeDays === 0 ? "Today" : safeDays === 1 ? "1 day" : `${safeDays} days`;
    return {
      days: safeDays,
      hasTime: false,
      remainingMs: null,
      hours: 0,
      minutes: 0,
      seconds: 0,
      daysLabel,
      detailedLabel: isPast
        ? "Passed"
        : "Day countdown only — add a time for hourly precision",
      isPast,
    };
  }

  const remainingMs = start.getTime() - now.getTime();
  if (remainingMs <= 0) {
    // Same calendar day after start → "Today"; otherwise passed.
    const sameDay =
      localDateKey(start, input.timeZone) === localDateKey(now, input.timeZone);
    return {
      days: 0,
      hasTime: true,
      remainingMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      daysLabel: sameDay ? "Today" : "Passed",
      detailedLabel: sameDay ? "Started" : "Passed",
      isPast: !sameDay,
    };
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const daysPart = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const daysLabel =
    daysPart === 0 && hours < 24 && calendarDaysUntil(input.startsAt, input.timeZone, now) === 0
      ? "Today"
      : daysPart <= 0
        ? days === 1
          ? "1 day"
          : days <= 0
            ? "Today"
            : `${days} days`
        : daysPart === 1
          ? "1 day"
          : `${daysPart} days`;

  const detailedLabel =
    daysPart > 0
      ? `${daysPart}d ${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m ${seconds}s`;

  return {
    days: Math.max(0, days),
    hasTime: true,
    remainingMs,
    hours,
    minutes,
    seconds,
    daysLabel,
    detailedLabel,
    isPast: false,
  };
}

/** Viewer-local fallback when timezone prefs are unavailable (browser). */
export function assessmentCountdownLocal(input: {
  startsAt: string;
  allDay: boolean;
  now?: Date;
}): CountdownParts {
  const now = input.now ?? new Date();
  const start = new Date(input.startsAt);
  const a = startOfLocalCalendarDay(now).getTime();
  const b = startOfLocalCalendarDay(start).getTime();
  const days = Math.round((b - a) / 86_400_000);
  const hasTime = !input.allDay;

  if (!hasTime) {
    const isPast = days < 0;
    const safeDays = Math.max(0, days);
    return {
      days: safeDays,
      hasTime: false,
      remainingMs: null,
      hours: 0,
      minutes: 0,
      seconds: 0,
      daysLabel:
        isPast ? "Passed" : safeDays === 0 ? "Today" : safeDays === 1 ? "1 day" : `${safeDays} days`,
      detailedLabel: isPast
        ? "Passed"
        : "Day countdown only — add a time for hourly precision",
      isPast,
    };
  }

  const remainingMs = start.getTime() - now.getTime();
  if (remainingMs <= 0) {
    const sameDay = days === 0;
    return {
      days: 0,
      hasTime: true,
      remainingMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      daysLabel: sameDay ? "Today" : "Passed",
      detailedLabel: sameDay ? "Started" : "Passed",
      isPast: !sameDay,
    };
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const daysPart = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const detailedLabel =
    daysPart > 0
      ? `${daysPart}d ${hours}h ${minutes}m`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m ${seconds}s`;

  return {
    days: Math.max(0, days),
    hasTime: true,
    remainingMs,
    hours,
    minutes,
    seconds,
    daysLabel:
      days <= 0 ? "Today" : days === 1 ? "1 day" : `${days} days`,
    detailedLabel,
    isPast: false,
  };
}
