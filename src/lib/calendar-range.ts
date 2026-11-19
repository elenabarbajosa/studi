import { buildMonthGrid } from "@/lib/calendar-month";
import { addLocalDays, localDateKey, localMidnightIso } from "@/lib/progress/timezone";
import { addDays, startOfDay, startOfWeek, toDateKey } from "@/lib/planning";

/** Default window when the calendar URL has no range: recent history through next academic year. */
export const CALENDAR_PAST_DAYS = 45;
export const CALENDAR_FUTURE_DAYS = 400;
/** Extra days requested around the visible grid so paging a month does not refetch. */
export const CALENDAR_REFETCH_PAD_DAYS = 45;
const MAX_RANGE_DAYS = 800;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(value: unknown): string | null {
  return typeof value === "string" && DATE_KEY.test(value) ? value : null;
}

export function defaultCalendarRange(now: Date, timeZone: string) {
  const today = localDateKey(now, timeZone);
  return {
    from: addLocalDays(today, -CALENDAR_PAST_DAYS),
    to: addLocalDays(today, CALENDAR_FUTURE_DAYS),
  };
}

/** Inclusive local date keys. Swaps inverted bounds and caps the span. */
export function resolveRequestedRange(
  fromParam: unknown,
  toParam: unknown,
  now: Date,
  timeZone: string,
): { from: string; to: string } {
  const fallback = defaultCalendarRange(now, timeZone);
  let from = parseDateKey(fromParam) ?? fallback.from;
  let to = parseDateKey(toParam) ?? fallback.to;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const cap = addLocalDays(from, MAX_RANGE_DAYS);
  if (to > cap) to = cap;
  return { from, to };
}

/**
 * Instants covering the requested local dates, plus one day on each side so a
 * profile timezone and the browser timezone cannot drop a boundary event.
 */
export function queryWindowForRange(
  range: { from: string; to: string },
  timeZone: string,
): { startIso: string; endIso: string } {
  const from = addLocalDays(range.from, -1);
  const to = addLocalDays(range.to, 1);
  return {
    startIso: localMidnightIso(from, timeZone),
    endIso: localMidnightIso(addLocalDays(to, 1), timeZone),
  };
}

export function rangeCovers(
  loaded: { from: string; to: string },
  visible: { from: string; to: string },
): boolean {
  return visible.from >= loaded.from && visible.to <= loaded.to;
}

export function windowAround(
  visible: { from: string; to: string },
  padDays = CALENDAR_REFETCH_PAD_DAYS,
): { from: string; to: string } {
  return resolveRequestedRange(
    addLocalDays(visible.from, -padDays),
    addLocalDays(visible.to, padDays),
    new Date(),
    "UTC",
  );
}

/**
 * Union of the month grid, week, and a 14-day agenda for each anchor.
 * Desktop and mobile calendars can sit on different days at once; pass both.
 */
export function visibleCalendarSpan(anchors: Date[]): { from: string; to: string } {
  const usable = anchors.filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
  const list = usable.length > 0 ? usable : [new Date()];
  let from = "9999-12-31";
  let to = "0000-01-01";
  for (const anchor of list) {
    const grid = buildMonthGrid(anchor);
    const keys = [
      toDateKey(grid[0]!),
      toDateKey(grid[grid.length - 1]!),
      toDateKey(startOfWeek(anchor)),
      toDateKey(addDays(startOfWeek(anchor), 6)),
      toDateKey(addDays(startOfDay(anchor), 13)),
    ];
    for (const key of keys) {
      if (key < from) from = key;
      if (key > to) to = key;
    }
  }
  return { from, to };
}
