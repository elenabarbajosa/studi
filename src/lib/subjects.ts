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

export type SubjectTone = { dot: string; tint: string; text: string };

/** Approved subject palette, keyed by the stored dot hex. */
export const SUBJECT_TONES: Record<string, SubjectTone> = {
  "#D46A80": { dot: "#D46A80", tint: "#FBE9EC", text: "#A23A55" },
  "#4C93C9": { dot: "#4C93C9", tint: "#E5F0F9", text: "#2B6896" },
  "#4E9E78": { dot: "#4E9E78", tint: "#E6F3EC", text: "#2F6E50" },
  "#8E7CCB": { dot: "#8E7CCB", tint: "#EFEBFA", text: "#5B4A99" },
  "#E08A5B": { dot: "#E08A5B", tint: "#FBEBE1", text: "#9A4F24" },
  "#6B7280": { dot: "#6B7280", tint: "#EEEFF1", text: "#3F4550" },
  "#D9706B": { dot: "#D9706B", tint: "#FBE7E5", text: "#A1302C" },
  "#C98A2E": { dot: "#C98A2E", tint: "#FAF0DF", text: "#8A5A12" },
  "#3E9C96": { dot: "#3E9C96", tint: "#E1F2F0", text: "#226B66" },
  "#6A7BCF": { dot: "#6A7BCF", tint: "#E9ECFA", text: "#3E4FA0" },
};

/**
 * Existing subject rows store color names, not hex.
 * Each name maps once onto the approved palette. Pink and rose stay distinct:
 * pink uses rose, rose uses coral.
 */
const SUBJECT_COLOR_HEX: Record<SubjectColor, keyof typeof SUBJECT_TONES> = {
  pink: "#D46A80",
  blue: "#4C93C9",
  green: "#4E9E78",
  purple: "#8E7CCB",
  peach: "#E08A5B",
  neutral: "#6B7280",
  rose: "#D9706B",
  amber: "#C98A2E",
  teal: "#3E9C96",
  indigo: "#6A7BCF",
};

const SUBJECT_COLOR_LABEL: Record<SubjectColor, string> = {
  pink: "Pink",
  blue: "Blue",
  green: "Green",
  purple: "Purple",
  peach: "Peach",
  neutral: "Neutral",
  rose: "Rose",
  amber: "Amber",
  teal: "Teal",
  indigo: "Indigo",
};

export function subjectTone(color: SubjectColor): SubjectTone {
  return SUBJECT_TONES[SUBJECT_COLOR_HEX[color]];
}

export function subjectToneVars(color: SubjectColor) {
  const tone = subjectTone(color);
  return {
    "--subject-dot": tone.dot,
    "--subject-tint": tone.tint,
    "--subject-text": tone.text,
  } as const;
}

function subjectColorMeta(color: SubjectColor) {
  const tone = subjectTone(color);
  return {
    label: SUBJECT_COLOR_LABEL[color],
    swatch: tone.dot,
    tint: tone.tint,
    text: tone.text,
  };
}

export const SUBJECT_COLOR_META: Record<
  SubjectColor,
  { label: string; swatch: string; tint: string; text: string }
> = {
  pink: subjectColorMeta("pink"),
  blue: subjectColorMeta("blue"),
  green: subjectColorMeta("green"),
  purple: subjectColorMeta("purple"),
  peach: subjectColorMeta("peach"),
  neutral: subjectColorMeta("neutral"),
  rose: subjectColorMeta("rose"),
  amber: subjectColorMeta("amber"),
  teal: subjectColorMeta("teal"),
  indigo: subjectColorMeta("indigo"),
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
