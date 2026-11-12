export const SUBJECT_COLORS = [
  "pink",
  "blue",
  "green",
  "purple",
  "peach",
  "neutral",
  "rose",
  "amber",
  "teal",
  "indigo",
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export const SUBJECT_COLOR_META: Record<
  SubjectColor,
  { label: string; swatch: string }
> = {
  pink: { label: "Pink", swatch: "oklch(0.78 0.1 10)" },
  blue: { label: "Blue", swatch: "oklch(0.72 0.1 245)" },
  green: { label: "Green", swatch: "oklch(0.75 0.1 160)" },
  purple: { label: "Purple", swatch: "oklch(0.72 0.1 300)" },
  peach: { label: "Peach", swatch: "oklch(0.8 0.1 50)" },
  neutral: { label: "Neutral", swatch: "oklch(0.55 0.02 260)" },
  rose: { label: "Rose", swatch: "oklch(0.7 0.14 15)" },
  amber: { label: "Amber", swatch: "oklch(0.8 0.12 75)" },
  teal: { label: "Teal", swatch: "oklch(0.72 0.09 190)" },
  indigo: { label: "Indigo", swatch: "oklch(0.65 0.12 275)" },
};

export const TOPIC_STATUSES = [
  "not_started",
  "studying",
  "practicing",
  "mastered",
] as const;

export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const TOPIC_STATUS_META: Record<
  TopicStatus,
  { label: string; weight: number }
> = {
  not_started: { label: "Not started", weight: 0 },
  studying: { label: "Studying", weight: 1 },
  practicing: { label: "Practicing", weight: 2 },
  mastered: { label: "Mastered", weight: 3 },
};

export const RESOURCE_TYPES = [
  "link",
  "pdf",
  "video",
  "article",
  "notes",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_META: Record<ResourceType, { label: string }> = {
  link: { label: "Link" },
  pdf: { label: "PDF" },
  video: { label: "Video" },
  article: { label: "Article" },
  notes: { label: "Notes" },
  other: { label: "Other" },
};

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type WeekdayAvailability = Record<Weekday, boolean>;

export const DEFAULT_WEEKDAY_AVAILABILITY: WeekdayAvailability = {
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: false,
  sun: false,
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const SESSION_DURATION_OPTIONS = [25, 40, 50, 60, 90, 120] as const;
export const BREAK_DURATION_OPTIONS = [0, 5, 10, 15, 20] as const;

export const ONBOARDING_STATUSES = [
  "pending",
  "in_progress",
  "skipped",
  "completed",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export function isSubjectColor(value: unknown): value is SubjectColor {
  return (
    typeof value === "string" &&
    (SUBJECT_COLORS as readonly string[]).includes(value)
  );
}

export function isTopicStatus(value: unknown): value is TopicStatus {
  return (
    typeof value === "string" &&
    (TOPIC_STATUSES as readonly string[]).includes(value)
  );
}

export function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" &&
    (RESOURCE_TYPES as readonly string[]).includes(value)
  );
}

/** Real progress from topic statuses — no invented percentages beyond status weights. */
export function topicProgressSummary(
  topics: { status: TopicStatus; parent_id: string | null }[],
) {
  const roots = topics.filter((t) => t.parent_id === null);
  const total = roots.length;
  const mastered = roots.filter((t) => t.status === "mastered").length;
  const inProgress = roots.filter(
    (t) => t.status === "studying" || t.status === "practicing",
  ).length;
  const notStarted = roots.filter((t) => t.status === "not_started").length;
  const weightSum = roots.reduce(
    (sum, t) => sum + TOPIC_STATUS_META[t.status].weight,
    0,
  );
  const maxWeight = total * TOPIC_STATUS_META.mastered.weight;

  return {
    total,
    mastered,
    inProgress,
    notStarted,
    completionRatio: maxWeight === 0 ? null : weightSum / maxWeight,
  };
}
