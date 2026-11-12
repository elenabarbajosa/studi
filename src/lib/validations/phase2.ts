import { z } from "zod";

import {
  BREAK_DURATION_OPTIONS,
  RESOURCE_TYPES,
  SESSION_DURATION_OPTIONS,
  SUBJECT_COLORS,
  TOPIC_STATUSES,
  WEEKDAYS,
} from "@/lib/subjects";
import { ACCENT_COLORS, APPEARANCE_MODES } from "@/lib/theme";

export const onboardingPersonalizeSchema = z.object({
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(48, "Display name must be at most 48 characters"),
  appearance: z.enum(APPEARANCE_MODES),
  accent_color: z.enum(ACCENT_COLORS),
});

export const subjectInputSchema = z.object({
  name: z
    .string()
    .min(1, "Subject name is required")
    .max(80, "Name must be at most 80 characters"),
  color: z.enum(SUBJECT_COLORS),
  difficulty: z.coerce.number().int().min(1).max(5).nullable().optional(),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
});

export const studyPreferencesSchema = z.object({
  weekday_availability: z.object(
    Object.fromEntries(
      WEEKDAYS.map((day) => [day, z.boolean()]),
    ) as Record<(typeof WEEKDAYS)[number], z.ZodBoolean>,
  ),
  session_duration_minutes: z.coerce
    .number()
    .int()
    .refine(
      (v) => (SESSION_DURATION_OPTIONS as readonly number[]).includes(v),
      "Choose a valid session duration",
    ),
  break_duration_minutes: z.coerce
    .number()
    .int()
    .refine(
      (v) => (BREAK_DURATION_OPTIONS as readonly number[]).includes(v),
      "Choose a valid break duration",
    ),
  weekly_goal_hours: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    },
    z.number().min(0).max(80).nullable(),
  ),
});

export const topicInputSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must be at most 120 characters"),
  parent_id: z.string().uuid().nullable().optional(),
  status: z.enum(TOPIC_STATUSES).optional(),
  notes: z
    .string()
    .max(4000, "Notes must be at most 4000 characters")
    .optional()
    .or(z.literal("")),
});

export const materialInputSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must be at most 120 characters"),
  resource_type: z.enum(RESOURCE_TYPES),
  url: z
    .string()
    .min(1, "URL is required")
    .max(2000)
    .url("Enter a valid URL (include https://)"),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
  topic_id: z.string().uuid().nullable().optional(),
});

export type OnboardingPersonalizeInput = z.infer<
  typeof onboardingPersonalizeSchema
>;
export type SubjectInput = z.infer<typeof subjectInputSchema>;
export type StudyPreferencesInput = z.infer<typeof studyPreferencesSchema>;
export type TopicInput = z.infer<typeof topicInputSchema>;
export type MaterialInput = z.infer<typeof materialInputSchema>;
