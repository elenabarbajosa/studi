import type { PriorityLevel } from "@/lib/calendar";
import type { Assessment, Task } from "@/types/database";

const DAY_MS = 24 * 60 * 60 * 1000;

export const PRIORITY_RANK: Record<PriorityLevel, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** Priority is never shown by color alone: !, !! and !!! mirror the handoff. */
export const PRIORITY_MARK: Record<PriorityLevel, string> = {
  critical: "!!!",
  high: "!!",
  medium: "!",
  low: "",
};

function dueTime(task: Pick<Task, "due_at">) {
  return task.due_at ? new Date(task.due_at).getTime() : Number.POSITIVE_INFINITY;
}

/** Highest priority first, then earliest due date. Does not mutate the input. */
export function sortByPriority<T extends Pick<Task, "priority" | "due_at">>(
  tasks: readonly T[],
): T[] {
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
      dueTime(a) - dueTime(b),
  );
}

export type UpNextReason = "exam" | "today" | "overdue";

/**
 * Handoff rule: the highest-priority open task linked to the nearest exam,
 * falling back to the first task due today, then the oldest overdue task.
 */
export function pickUpNext(input: {
  todayTasks: readonly Task[];
  overdueTasks: readonly Task[];
  nextAssessment: Pick<Assessment, "subject_id"> | null;
}): { task: Task; reason: UpNextReason } | null {
  const { todayTasks, overdueTasks, nextAssessment } = input;
  const examSubject = nextAssessment?.subject_id ?? null;

  if (examSubject) {
    const linked = sortByPriority(
      [...todayTasks, ...overdueTasks].filter(
        (t) => t.subject_id === examSubject,
      ),
    );
    if (linked[0]) return { task: linked[0], reason: "exam" };
  }

  const today = sortByPriority(todayTasks)[0];
  if (today) return { task: today, reason: "today" };

  const overdue = sortByPriority(overdueTasks)[0];
  if (overdue) return { task: overdue, reason: "overdue" };

  return null;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Whole calendar days from `now` until `iso` (0 = today, 1 = tomorrow).
 * Uses the local calendar date of each instant in the runtime timezone, so
 * date-only assessments stored as local midnight stay on the intended day
 * when this runs in the viewer's browser (not a UTC server clock).
 */
export function daysUntil(iso: string, now = new Date()) {
  const target = new Date(iso);
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  return Math.round((b - a) / DAY_MS);
}

export function relativeDayLabel(iso: string, now = new Date()) {
  const days = daysUntil(iso, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "12h 40m", "45m" or "0m". */
export function formatFocusDuration(seconds: number) {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Compact bar label: "2.4h", "45m", or empty when nothing was logged. */
export function formatBarValue(seconds: number) {
  if (seconds < 60) return "";
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.round(seconds / 60)}m`;
}

export type WeekBar = {
  key: string;
  label: string;
  dayName: string;
  seconds: number;
  isToday: boolean;
  isFuture: boolean;
};

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Monday-first bars for the current week. Keys match `getFocusStats().daily`,
 * which buckets sessions by the ISO date of local midnight.
 */
export function buildWeekBars(
  daily: readonly { date: string; seconds: number }[],
  now = new Date(),
): WeekBar[] {
  const byDate = new Map(daily.map((d) => [d.date, d.seconds]));
  const today = startOfDay(now);
  const monday = new Date(today);
  const weekday = today.getDay();
  monday.setDate(today.getDate() + (weekday === 0 ? -6 : 1 - weekday));

  return WEEKDAY_INITIALS.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    return {
      key,
      label,
      dayName: WEEKDAY_NAMES[i],
      seconds: byDate.get(key) ?? 0,
      isToday: day.getTime() === today.getTime(),
      isFuture: day.getTime() > today.getTime(),
    };
  });
}
