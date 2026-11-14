import type { Weekday, WeekdayAvailability } from "@/lib/subjects";

export const PLANNING_PERIODS = ["7", "14", "30", "until_exam"] as const;
export type PlanningPeriod = (typeof PLANNING_PERIODS)[number];

export const PLAN_INTENSITIES = ["light", "balanced", "intensive"] as const;
export type PlanIntensity = (typeof PLAN_INTENSITIES)[number];

export type TimeWindow = { start: string; end: string };

export type PlannerTimeWindows = Record<Weekday, TimeWindow[]>;

export const DEFAULT_DAY_WINDOWS: TimeWindow[] = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "18:00" },
];

export const DEFAULT_PLANNER_TIME_WINDOWS: PlannerTimeWindows = {
  mon: DEFAULT_DAY_WINDOWS,
  tue: DEFAULT_DAY_WINDOWS,
  wed: DEFAULT_DAY_WINDOWS,
  thu: DEFAULT_DAY_WINDOWS,
  fri: DEFAULT_DAY_WINDOWS,
  sat: [],
  sun: [],
};

export type ProposedSession = {
  localId: string;
  subjectId: string;
  topicId: string | null;
  taskId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  goal: string | null;
  kind: "study" | "revision";
  locked: boolean;
  selected: boolean;
};

export type BusyInterval = {
  startsAt: string;
  endsAt: string;
  label?: string;
};

export type SchedulingConfig = {
  timeZone: string;
  periodStart: string;
  periodEnd: string;
  weekdayAvailability: WeekdayAvailability;
  timeWindows: PlannerTimeWindows;
  restDays: Weekday[];
  maxHoursPerDay: number;
  sessionMinutes: number;
  breakMinutes: number;
  includeRevision: boolean;
  nowIso: string;
  busy: BusyInterval[];
};

export type SubjectAllocation = {
  subjectId: string;
  topicId: string | null;
  priority: number;
  suggestedMinutes: number;
  reason: string;
  kind: "study" | "revision";
  beforeDate?: string | null;
};
