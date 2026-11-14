import { z } from "zod";

import { WEEKDAYS } from "@/lib/subjects";
import { PLAN_INTENSITIES, PLANNING_PERIODS } from "@/lib/planner/types";

const timeHHmm = z.string().regex(/^\d{2}:\d{2}$/);

export const timeWindowSchema = z.object({
  start: timeHHmm,
  end: timeHHmm,
});

export const plannerPreferencesInputSchema = z.object({
  planning_period: z.enum(PLANNING_PERIODS),
  intensity: z.enum(PLAN_INTENSITIES),
  max_hours_per_day: z.number().min(0.5).max(12),
  preferred_session_minutes: z.number().int().min(15).max(180),
  break_minutes: z.number().int().min(0).max(60),
  include_revision: z.boolean(),
  include_incomplete_tasks: z.boolean(),
  weekday_availability: z.record(z.enum(WEEKDAYS), z.boolean()),
  time_windows: z.record(z.enum(WEEKDAYS), z.array(timeWindowSchema)),
  rest_days: z.array(z.enum(WEEKDAYS)).default([]),
  included_subject_ids: z.array(z.string().uuid()).nullable(),
  prioritized_topic_ids: z.array(z.string().uuid()).default([]),
  excluded_topic_ids: z.array(z.string().uuid()).default([]),
  until_assessment_id: z.string().uuid().nullable(),
});

export type PlannerPreferencesInput = z.infer<typeof plannerPreferencesInputSchema>;

export const aiPlanRecommendationSchema = z.object({
  summary: z.string().max(600).optional().default(""),
  subjectPriorities: z
    .array(
      z.object({
        subjectId: z.string().uuid(),
        priority: z.number().min(0).max(100),
        reasoning: z.string().max(240),
        suggestedMinutes: z.number().int().min(0).max(6000),
        topicIds: z.array(z.string().uuid()).optional().default([]),
      }),
    )
    .default([]),
  revisionTopics: z
    .array(
      z.object({
        subjectId: z.string().uuid(),
        topicId: z.string().uuid().nullable().optional(),
        suggestedMinutes: z.number().int().min(0).max(2000),
        reason: z.string().max(240),
      }),
    )
    .default([]),
  workloadWarnings: z.array(z.string().max(300)).default([]),
  practiceNeeded: z
    .array(
      z.object({
        subjectId: z.string().uuid(),
        topicId: z.string().uuid().nullable().optional(),
        message: z.string().max(240),
      }),
    )
    .default([]),
});

export type AiPlanRecommendation = z.infer<typeof aiPlanRecommendationSchema>;

export const geminiPlanRecommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "subjectPriorities", "revisionTopics", "workloadWarnings", "practiceNeeded"],
  properties: {
    summary: { type: "string" },
    subjectPriorities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subjectId", "priority", "reasoning", "suggestedMinutes"],
        properties: {
          subjectId: { type: "string" },
          priority: { type: "number" },
          reasoning: { type: "string" },
          suggestedMinutes: { type: "integer" },
          topicIds: { type: "array", items: { type: "string" } },
        },
      },
    },
    revisionTopics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subjectId", "suggestedMinutes", "reason"],
        properties: {
          subjectId: { type: "string" },
          topicId: { type: ["string", "null"] },
          suggestedMinutes: { type: "integer" },
          reason: { type: "string" },
        },
      },
    },
    workloadWarnings: { type: "array", items: { type: "string" } },
    practiceNeeded: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subjectId", "message"],
        properties: {
          subjectId: { type: "string" },
          topicId: { type: ["string", "null"] },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

export const proposedSessionSchema = z.object({
  localId: z.string().min(1),
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().nullable(),
  taskId: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: timeHHmm,
  endTime: timeHHmm,
  durationMinutes: z.number().int().min(15).max(360),
  goal: z.string().max(200).nullable(),
  kind: z.enum(["study", "revision"]),
  locked: z.boolean(),
  selected: z.boolean(),
});

export const saveStudyPlanPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1).max(120).default("Study plan"),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  intensity: z.enum(PLAN_INTENSITIES),
  timezone: z.string().min(1).max(64),
  summary: z.string().max(600).nullable(),
  recommendations: z.array(z.string().max(300)).default([]),
  warnings: z.array(z.string().max(300)).default([]),
  sessions: z.array(proposedSessionSchema).min(1).max(200),
});

export type SaveStudyPlanPayload = z.infer<typeof saveStudyPlanPayloadSchema>;

export const adjustPlanPayloadSchema = z.object({
  planId: z.string().uuid(),
  preserveLocked: z.boolean().default(true),
  reason: z.enum([
    "missed_sessions",
    "new_exam",
    "exam_changed",
    "availability_changed",
    "completed_early",
    "manual",
  ]),
  preferences: plannerPreferencesInputSchema.partial().optional(),
});
