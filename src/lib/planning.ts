import type { PriorityLevel } from "@/lib/calendar";
import { daysUntil } from "@/lib/dashboard";

export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday of the week containing `d`, at local midnight. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const weekday = x.getDay();
  x.setDate(x.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return x;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function formatTime(iso: string) {
  return TIME.format(new Date(iso));
}

/** Tasks saved without a time are stored at 23:59:59 local. */
export function hasDueTime(iso: string) {
  const d = new Date(iso);
  return !(d.getHours() === 23 && d.getMinutes() === 59);
}

export type DueLabel = { label: string; tone: "overdue" | "today" | "soon" | "later" };

/** "Today 14:00", "Tomorrow", "Thu", "16 Nov", or "Overdue · 9 Nov". */
export function dueLabel(iso: string, now = new Date()): DueLabel {
  const days = daysUntil(iso, now);
  const time = hasDueTime(iso) ? ` ${formatTime(iso)}` : "";
  const date = new Date(iso);
  if (days < 0) return { label: `Overdue · ${SHORT_DATE.format(date)}`, tone: "overdue" };
  if (days === 0) {
    if (time && date.getTime() < now.getTime()) {
      return { label: `Overdue · ${formatTime(iso)}`, tone: "overdue" };
    }
    return { label: `Today${time}`, tone: "today" };
  }
  if (days === 1) return { label: `Tomorrow${time}`, tone: "soon" };
  if (days < 7) return { label: `${WEEKDAY.format(date)}${time}`, tone: "soon" };
  return { label: SHORT_DATE.format(date), tone: "later" };
}

export type TaskGroupKey = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export const TASK_GROUP_LABEL: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
  later: "Later",
  none: "No date",
};

export function taskGroup(dueAt: string | null, now = new Date()): TaskGroupKey {
  if (!dueAt) return "none";
  const days = daysUntil(dueAt, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return "week";
  return "later";
}

export type QuickAddDue = "today" | "tomorrow" | "week";

export type QuickAddResult = {
  title: string;
  subjectId: string | null;
  priority: PriorityLevel | null;
  due: QuickAddDue | null;
};

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Client-side tokens from the handoff: `@subject`, `!`/`!!`/`!!!`, and
 * `today` / `tomorrow` / `week`. Unrecognised tokens stay in the title.
 */
export function parseQuickAdd(
  input: string,
  subjects: readonly { id: string; name: string }[],
): QuickAddResult {
  let subjectId: string | null = null;
  let priority: PriorityLevel | null = null;
  let due: QuickAddDue | null = null;
  const kept: string[] = [];

  for (const word of input.split(/\s+/).filter(Boolean)) {
    const lower = normalize(word);
    if (word.startsWith("@") && word.length > 1) {
      const needle = normalize(word.slice(1));
      const match =
        subjects.find((s) => normalize(s.name).replace(/\s+/g, "").startsWith(needle)) ??
        subjects.find((s) => normalize(s.name).split(/\s+/).some((w) => w.startsWith(needle)));
      if (match) {
        subjectId = match.id;
        continue;
      }
    }
    if (/^!{1,3}$/.test(word)) {
      priority = word.length === 3 ? "critical" : word.length === 2 ? "high" : "medium";
      continue;
    }
    if (lower === "today" || lower === "tomorrow" || lower === "week") {
      due = lower;
      continue;
    }
    kept.push(word);
  }

  return { title: kept.join(" "), subjectId, priority, due };
}

/** Local `YYYY-MM-DD` for a quick-add due token; "week" is the coming Sunday. */
export function quickDueDate(due: QuickAddDue, now = new Date()) {
  if (due === "today") return toDateKey(now);
  if (due === "tomorrow") return toDateKey(addDays(now, 1));
  return toDateKey(addDays(startOfWeek(now), 6));
}

export type TimedItem = { id: string; start: number; end: number };
export type LaidOut<T> = T & { lane: number; lanes: number };

/**
 * Side-by-side lanes for overlapping timeline items, the way a day view
 * splits clashing events. Minutes since midnight in, lane info out.
 */
export function layoutLanes<T extends TimedItem>(items: readonly T[]): LaidOut<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: LaidOut<T>[] = [];
  let cluster: LaidOut<T>[] = [];
  let clusterEnd = -Infinity;
  let laneEnds: number[] = [];

  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const item of cluster) item.lanes = lanes;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) flush();
  return out;
}
