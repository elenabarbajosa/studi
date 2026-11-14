import { addDays, startOfDay, startOfWeek, toDateKey } from "@/lib/planning";

/** First day of the month containing `date` (local midnight). */
export function startOfMonth(date: Date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

/** Shift by whole calendar months without day overflow (Jan 31 → Feb 28). */
export function addMonths(date: Date, months: number) {
  const d = startOfDay(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/**
 * Monday-first month grid cells for `viewMonth`.
 * Returns 35 or 42 days so the grid never scrolls horizontally.
 */
export function buildMonthGrid(viewMonth: Date): Date[] {
  const monthStart = startOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  let lastInMonth = 0;
  days.forEach((d, i) => {
    if (d.getMonth() === monthStart.getMonth()) lastInMonth = i;
  });
  return days.slice(0, Math.ceil((lastInMonth + 1) / 7) * 7);
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Date keys for every local day in the month grid (including padding). */
export function monthGridKeys(viewMonth: Date): string[] {
  return buildMonthGrid(viewMonth).map(toDateKey);
}
