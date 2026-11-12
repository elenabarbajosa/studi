import { SUBJECT_COLOR_META, type SubjectColor } from "@/lib/subjects";

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

export const STUDY_SESSION_SOURCES = ["calendar", "focus"] as const;
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

export function subjectEventColor(color?: SubjectColor | null) {
  if (!color) return "oklch(0.62 0.08 260)";
  return SUBJECT_COLOR_META[color].swatch;
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
 * Build ISO strings for all-day vs timed events without shifting the calendar day.
 * Client should pass local date (`YYYY-MM-DD`) and optional local times (`HH:mm`).
 */
export function buildEventRange(input: {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  allDay: boolean;
}) {
  const { date, startTime, endTime, allDay } = input;
  if (allDay || !startTime) {
    // Store local midnight → ISO via Date constructed in local TZ.
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    return {
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: true,
    };
  }

  const start = new Date(`${date}T${startTime}:00`);
  const end = endTime
    ? new Date(`${date}T${endTime}:00`)
    : new Date(start.getTime() + 60 * 60 * 1000);

  return {
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    all_day: false,
  };
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
