import { resolveTimeZone } from "@/lib/event-time";
import { zonedDateTimeToUtcIso } from "@/lib/planner/zoned-time";
import { addLocalDays, localDateKey, localMidnightIso } from "@/lib/progress/timezone";
import type { Task } from "@/types/database";

/**
 * Date-only due dates are stored at noon UTC so the calendar day is stable
 * across common timezones (±12h). Timed dues are the wall clock in `timeZone`.
 */
export function dueAtFromForm(
  dueDate?: string | null,
  dueTime?: string | null,
  timeZone?: string | null,
) {
  if (!dueDate) return null;
  if (dueTime) {
    return zonedDateTimeToUtcIso(dueDate, dueTime, resolveTimeZone(timeZone));
  }
  return `${dueDate}T12:00:00.000Z`;
}

/** Study-block start/end from a local date and clock times in `timeZone`. */
export function scheduleRangeFromForm(
  date?: string | null,
  start?: string | null,
  end?: string | null,
  timeZone?: string | null,
) {
  if (!date || !start) return { scheduled_start: null, scheduled_end: null };
  const zone = resolveTimeZone(timeZone);
  const scheduled_start = zonedDateTimeToUtcIso(date, start, zone);
  const scheduled_end = end
    ? zonedDateTimeToUtcIso(date, end, zone)
    : new Date(new Date(scheduled_start).getTime() + 60 * 60 * 1000).toISOString();
  return { scheduled_start, scheduled_end };
}

/** True when the stored due_at represents a date-only value (no clock time). */
export function isDateOnlyDue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCHours() === 12 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

export function dayBoundsIso(dateKey: string, timeZone: string) {
  const start = localMidnightIso(dateKey, timeZone);
  const end = localMidnightIso(addLocalDays(dateKey, 1), timeZone);
  return { start, endExclusive: end };
}

/**
 * Split incomplete tasks into today vs overdue using the user's IANA timezone.
 * Undated tasks are excluded (they are not due today).
 */
export function partitionTodoTasksByDueDay(
  tasks: Task[],
  timeZone: string,
  now = new Date(),
) {
  const todayKey = localDateKey(now, timeZone);
  const todayTasks: Task[] = [];
  const overdueTasks: Task[] = [];

  for (const task of tasks) {
    if (task.status !== "todo" || !task.due_at) continue;
    const key = localDateKey(task.due_at, timeZone);
    if (key === todayKey) todayTasks.push(task);
    else if (key < todayKey) overdueTasks.push(task);
  }

  return { todayKey, todayTasks, overdueTasks };
}
