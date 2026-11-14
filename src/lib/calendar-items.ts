import { ASSESSMENT_TYPE_META, type AssessmentType } from "@/lib/calendar";
import { hasDueTime } from "@/lib/planning";
import type { SubjectColor } from "@/lib/subjects";
import type {
  Assessment,
  CalendarEvent,
  StudySession,
  Subject,
  Task,
} from "@/types/database";

/** Visual treatments from the handoff (2b): one per kind of entry. */
export type CalItemKind =
  | "exam"
  | "deadline"
  | "session_done"
  | "session_planned"
  | "session_other"
  | "task"
  | "personal";

export type CalFilter = "sessions" | "planned" | "exams" | "deadlines" | "tasks" | "personal";

export const CAL_FILTERS: { value: CalFilter; label: string; kind: CalItemKind }[] = [
  { value: "sessions", label: "Study sessions", kind: "session_done" },
  { value: "planned", label: "Planned sessions", kind: "session_planned" },
  { value: "exams", label: "Exams", kind: "exam" },
  { value: "deadlines", label: "Deadlines", kind: "deadline" },
  { value: "tasks", label: "Tasks", kind: "task" },
  { value: "personal", label: "Personal", kind: "personal" },
];

const FILTER_OF_KIND: Record<CalItemKind, CalFilter> = {
  exam: "exams",
  deadline: "deadlines",
  session_done: "sessions",
  session_other: "sessions",
  session_planned: "planned",
  task: "tasks",
  personal: "personal",
};

export function filterOfKind(kind: CalItemKind) {
  return FILTER_OF_KIND[kind];
}

export const EXAM_TYPES: AssessmentType[] = ["final", "midterm", "quiz"];
export const DEADLINE_TYPES: AssessmentType[] = ["assignment", "project", "presentation", "other"];

export type CalSource = "assessment" | "personal" | "study_session" | "task";

export type CalItem = {
  /** `${source}:${id}`; the prefix routes drag and resize to the right action. */
  id: string;
  source: CalSource;
  kind: CalItemKind;
  title: string;
  meta: string;
  start: string;
  end: string | null;
  allDay: boolean;
  subjectId: string | null;
  color: SubjectColor | null;
  editable: boolean;
  assessment?: Assessment;
  personal?: CalendarEvent;
  session?: StudySession;
  task?: Task;
};

function sessionKind(s: StudySession): CalItemKind {
  if (s.status === "completed" || s.status === "in_progress") return "session_done";
  if (s.status === "planned") return "session_planned";
  return "session_other";
}

const SESSION_PREFIX: Record<StudySession["source"], string> = {
  calendar: "Study",
  focus: "Focus",
  study_together: "Together",
};

export function buildCalendarItems(input: {
  assessments: readonly Assessment[];
  personalEvents: readonly CalendarEvent[];
  studySessions: readonly StudySession[];
  tasks: readonly Task[];
  subjects: readonly Subject[];
  topicTitles?: ReadonlyMap<string, string>;
}): CalItem[] {
  const subjects = new Map(input.subjects.map((s) => [s.id, s]));
  const subjectOf = (id: string | null) => (id ? subjects.get(id) ?? null : null);

  const assessments = input.assessments.map<CalItem>((a) => {
    const subject = subjectOf(a.subject_id);
    const typeLabel = ASSESSMENT_TYPE_META[a.assessment_type].label;
    return {
      id: `assessment:${a.id}`,
      source: "assessment",
      kind: EXAM_TYPES.includes(a.assessment_type) ? "exam" : "deadline",
      title: a.title,
      meta: [typeLabel, subject?.name, a.location].filter(Boolean).join(" · "),
      start: a.starts_at,
      end: a.ends_at,
      allDay: a.all_day,
      subjectId: a.subject_id,
      color: subject?.color ?? null,
      editable: true,
      assessment: a,
    };
  });

  const personal = input.personalEvents.map<CalItem>((e) => ({
    id: `personal:${e.id}`,
    source: "personal",
    kind: "personal",
    title: e.title,
    meta: "Personal",
    start: e.starts_at,
    end: e.ends_at,
    allDay: e.all_day,
    subjectId: null,
    color: null,
    editable: true,
    personal: e,
  }));

  const sessions = input.studySessions.map<CalItem>((s) => {
    const subject = subjectOf(s.subject_id);
    const topic = s.topic_id ? input.topicTitles?.get(s.topic_id) : undefined;
    const prefix = SESSION_PREFIX[s.source] ?? "Study";
    return {
      id: `study_session:${s.id}`,
      source: "study_session",
      kind: sessionKind(s),
      title: subject ? `${prefix} · ${subject.name}` : `${prefix} session`,
      meta: [topic, s.status === "planned" ? "Planned" : null].filter(Boolean).join(" · "),
      start: s.starts_at,
      end: s.ends_at,
      allDay: false,
      subjectId: s.subject_id,
      color: subject?.color ?? null,
      editable: true,
      session: s,
    };
  });

  const tasks = input.tasks
    .filter((t) => t.status === "todo" && t.due_at)
    .map<CalItem>((t) => {
      const subject = subjectOf(t.subject_id);
      const timed = hasDueTime(t.due_at!);
      return {
        id: `task:${t.id}`,
        source: "task",
        kind: "task",
        title: t.title,
        meta: ["Task", subject?.name].filter(Boolean).join(" · "),
        start: t.due_at!,
        end: null,
        allDay: !timed,
        subjectId: t.subject_id,
        color: subject?.color ?? null,
        editable: false,
        task: t,
      };
    });

  return [...assessments, ...personal, ...sessions, ...tasks];
}

/** Items overlapping the local calendar day starting at `dayStart`. */
export function itemsOnDay(items: readonly CalItem[], dayStart: Date) {
  const start = dayStart.getTime();
  const end = start + 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const s = new Date(item.start).getTime();
    const e = item.end ? new Date(item.end).getTime() : s;
    return s < end && Math.max(e, s + 1) > start;
  });
}
