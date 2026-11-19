import { END_BEFORE_START_MESSAGE, resolveTimeZone } from "@/lib/event-time";
import { zonedDateTimeToUtcIso } from "@/lib/planner/zoned-time";
import { subjectTone, type SubjectColorValue } from "@/lib/subjects";

export const ASSESSMENT_TYPES = [
  "final",
  "midterm",
  "quiz",
  "assignment",
  "project",
  "presentation",
  "other",
] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_TYPE_META: Record<
  AssessmentType,
  { label: string }
> = {
  final: { label: "Final exam" },
  midterm: { label: "Midterm" },
  quiz: { label: "Quiz" },
  assignment: { label: "Assignment" },
  project: { label: "Project" },
  presentation: { label: "Presentation" },
  other: { label: "Other assessment" },
};

export const PRIORITY_LEVELS = ["low", "medium", "high", "critical"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const PRIORITY_META: Record<PriorityLevel, { label: string }> = {
  low: { label: "Low" },
  medium: { label: "Medium" },
  high: { label: "High" },
  critical: { label: "Critical" },
};

export const TASK_STATUSES = ["todo", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STUDY_SESSION_STATUSES = [
  "planned",
  "completed",
  "skipped",
  "missed",
  "in_progress",
  "interrupted",
] as const;
export type StudySessionStatus = (typeof STUDY_SESSION_STATUSES)[number];

export const STUDY_SESSION_STATUS_META: Record<
  StudySessionStatus,
  { label: string }
> = {
  planned: { label: "Planned" },
  completed: { label: "Completed" },
  skipped: { label: "Skipped" },
  missed: { label: "Missed" },
  in_progress: { label: "In progress" },
  interrupted: { label: "Interrupted" },
};

export const FOCUS_TIMER_MODES = ["pomodoro", "stopwatch"] as const;
export type FocusTimerMode = (typeof FOCUS_TIMER_MODES)[number];

export const STUDY_SESSION_SOURCES = [
  "calendar",
  "focus",
  "study_together",
] as const;
export type StudySessionSource = (typeof STUDY_SESSION_SOURCES)[number];

export const SOUNDSCAPE_IDS = [
  "silence",
  "rain",
  "cafe",
  "white_noise",
  "forest",
] as const;
export type SoundscapeId = (typeof SOUNDSCAPE_IDS)[number];

export type CalendarEventKind =
  | "assessment"
  | "personal"
  | "study_session"
  | "task";

export const CALENDAR_VIEWS = ["dayGridMonth", "timeGridWeek", "timeGridDay"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function isAssessmentType(v: unknown): v is AssessmentType {
  return typeof v === "string" && (ASSESSMENT_TYPES as readonly string[]).includes(v);
}

export function isPriorityLevel(v: unknown): v is PriorityLevel {
  return typeof v === "string" && (PRIORITY_LEVELS as readonly string[]).includes(v);
}

export function isStudySessionStatus(v: unknown): v is StudySessionStatus {
  return (
    typeof v === "string" &&
    (STUDY_SESSION_STATUSES as readonly string[]).includes(v)
  );
}

export function subjectEventColor(color?: SubjectColorValue | null) {
  if (!color) return "oklch(0.62 0.08 260)";
  return subjectTone(color).dot;
}

/** Countdown label from now → target (local). */
export function examCountdown(startsAtIso: string, now = new Date()) {
  const start = new Date(startsAtIso);
  const diffMs = start.getTime() - now.getTime();
  if (Number.isNaN(diffMs)) return "Date unavailable";
  if (diffMs <= 0) return "Started or passed";

  const minutes = Math.floor(diffMs / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Build UTC instants for a wall-clock date and time in `timeZone`.
 * `timeZone` is an IANA name (browser or profile). The server's own zone is
 * never used: `new Date("YYYY-MM-DDTHH:mm")` would interpret that string in
 * UTC on Vercel and shift the event for everyone outside UTC.
 *
 * All-day events cover local midnight through 23:59 in that timezone, so the
 * calendar day does not move. A missing end time becomes 60 elapsed minutes.
 * A wall time that does not exist (spring-forward gap) resolves to the next
 * valid local time.
 */
export function buildEventRange(input: {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay: boolean;
  timeZone: string;
}) {
  const { date, startTime, endTime, allDay } = input;
  const timeZone = resolveTimeZone(input.timeZone);
  if (allDay || !startTime) {
    return {
      starts_at: zonedDateTimeToUtcIso(date, "00:00", timeZone),
      ends_at: zonedDateTimeToUtcIso(date, "23:59", timeZone),
      all_day: true,
    };
  }

  const starts_at = zonedDateTimeToUtcIso(date, startTime, timeZone);
  const ends_at = endTime
    ? zonedDateTimeToUtcIso(date, endTime, timeZone)
    : new Date(new Date(starts_at).getTime() + 60 * 60 * 1000).toISOString();

  return {
    starts_at,
    ends_at,
    all_day: false,
  };
}

export function eventRangeOrError(input: {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay: boolean;
  timeZone: string;
}): { error: string } | { range: ReturnType<typeof buildEventRange> } {
  try {
    const range = buildEventRange(input);
    if (!range.all_day && range.ends_at <= range.starts_at) {
      return { error: END_BEFORE_START_MESSAGE };
    }
    return { range };
  } catch {
    return { error: "Invalid date or time." };
  }
}

export function toLocalDateInput(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toLocalTimeInput(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
