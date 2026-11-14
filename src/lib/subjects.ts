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

/** Named presets stored in older rows. Custom colours are `#RRGGBB`. */
export type SubjectColorPreset = (typeof SUBJECT_COLORS)[number];
/** @deprecated Prefer SubjectColorPreset for presets; Subject.color is SubjectColorValue. */
export type SubjectColor = SubjectColorPreset;
/** Stored subject colour: preset name or validated `#RRGGBB`. */
export type SubjectColorValue = SubjectColorPreset | string;

export type SubjectTone = { dot: string; tint: string; text: string };

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

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
export const SUBJECT_COLOR_HEX: Record<SubjectColorPreset, keyof typeof SUBJECT_TONES> = {
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

const SUBJECT_COLOR_LABEL: Record<SubjectColorPreset, string> = {
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

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_COLOR_RE.test(withHash)) return null;
  return withHash.toUpperCase();
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r / 255)}${to(g / 255)}${to(b / 255)}`.toUpperCase();
}

/** Mix `hex` toward white (amount 0–1) for accessible light tints. */
function mixTowardWhite(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = clamp01(amount);
  return rgbToHex(
    r + (255 - r) * a,
    g + (255 - g) * a,
    b + (255 - b) * a,
  );
}

/** Darken for readable text on tinted backgrounds. */
function mixTowardBlack(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = clamp01(amount);
  return rgbToHex(r * (1 - a), g * (1 - a), b * (1 - a));
}

export function toneFromHex(hex: string): SubjectTone {
  const normalized = normalizeHexColor(hex) ?? "#6B7280";
  const known = SUBJECT_TONES[normalized];
  if (known) return known;
  return {
    dot: normalized,
    tint: mixTowardWhite(normalized, 0.88),
    text: mixTowardBlack(normalized, 0.42),
  };
}

export function resolveSubjectHex(color: SubjectColorValue): string {
  if (isSubjectColor(color)) return SUBJECT_COLOR_HEX[color];
  return normalizeHexColor(color) ?? SUBJECT_COLOR_HEX.neutral;
}

export function subjectTone(color: SubjectColorValue): SubjectTone {
  if (isSubjectColor(color)) return SUBJECT_TONES[SUBJECT_COLOR_HEX[color]];
  return toneFromHex(color);
}

export function subjectToneVars(color: SubjectColorValue) {
  const tone = subjectTone(color);
  return {
    "--subject-dot": tone.dot,
    "--subject-tint": tone.tint,
    "--subject-text": tone.text,
  } as const;
}

function subjectColorMeta(color: SubjectColorPreset) {
  const tone = subjectTone(color);
  return {
    label: SUBJECT_COLOR_LABEL[color],
    swatch: tone.dot,
    tint: tone.tint,
    text: tone.text,
  };
}

export const SUBJECT_COLOR_META: Record<
  SubjectColorPreset,
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

export function isSubjectColorValue(value: unknown): value is SubjectColorValue {
  return isSubjectColor(value) || isHexColor(value);
}

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

export function isSubjectColor(value: unknown): value is SubjectColorPreset {
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
