import { z } from "zod";

import { ASSESSMENT_TYPES, type AssessmentType } from "@/lib/calendar";

export const TOPIC_DIFFICULTY_ESTIMATES = [
  "easy",
  "medium",
  "hard",
  "unknown",
] as const;
export type TopicDifficultyEstimate = (typeof TOPIC_DIFFICULTY_ESTIMATES)[number];

export const SYLLABUS_ASSESSMENT_TYPES = [
  "final",
  "midterm",
  "quiz",
  "assignment",
  "project",
  "presentation",
  "other",
] as const;

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v == null || v === "" ? null : v));

const nullableInt = z
  .union([z.number().int().nonnegative(), z.null()])
  .optional()
  .transform((v) => (v == null || Number.isNaN(v) ? null : v));

const nullableWeight = z
  .union([z.number().min(0).max(100), z.null()])
  .optional()
  .transform((v) => (v == null || Number.isNaN(v) ? null : v));

export const extractedSubtopicSchema = z.object({
  title: z.string().min(1).max(200),
  description: nullableString,
  sourceTerm: nullableString,
  order: z.number().int().nonnegative().optional().default(0),
  estimatedDifficulty: z
    .enum(TOPIC_DIFFICULTY_ESTIMATES)
    .optional()
    .default("unknown"),
  sourcePage: nullableInt,
});

export const extractedTopicSchema = z.object({
  title: z.string().min(1).max(200),
  description: nullableString,
  sourceTerm: nullableString,
  order: z.number().int().nonnegative().optional().default(0),
  estimatedDifficulty: z
    .enum(TOPIC_DIFFICULTY_ESTIMATES)
    .optional()
    .default("unknown"),
  sourcePage: nullableInt,
  subtopics: z.array(extractedSubtopicSchema).optional().default([]),
});

export const extractedAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(SYLLABUS_ASSESSMENT_TYPES).optional().default("other"),
  date: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
  dateAmbiguous: z.boolean().optional().default(false),
  dateRaw: nullableString,
  weightPercent: nullableWeight,
  sourcePage: nullableInt,
  notes: nullableString,
});

export const extractedSuggestionSchema = z.object({
  kind: z.enum(["duplicate_topic", "difficulty_estimate", "warning", "note"]),
  message: z.string().min(1).max(500),
  relatedTopicTitle: nullableString,
});

export const syllabusExtractionSchema = z.object({
  language: nullableString,
  topics: z.array(extractedTopicSchema).default([]),
  assessments: z.array(extractedAssessmentSchema).default([]),
  suggestions: z.array(extractedSuggestionSchema).default([]),
  warnings: z.array(z.string().max(500)).default([]),
});

export type SyllabusExtraction = z.infer<typeof syllabusExtractionSchema>;
export type ExtractedTopic = z.infer<typeof extractedTopicSchema>;
export type ExtractedAssessment = z.infer<typeof extractedAssessmentSchema>;

/** Client review draft with selection flags and stable local ids. */
export const reviewSubtopicSchema = extractedSubtopicSchema.extend({
  localId: z.string().min(1),
  selected: z.boolean(),
});

export const reviewTopicSchema = extractedTopicSchema
  .omit({ subtopics: true })
  .extend({
    localId: z.string().min(1),
    selected: z.boolean(),
    possibleDuplicate: z.boolean().optional().default(false),
    duplicateOfTitle: nullableString,
    subtopics: z.array(reviewSubtopicSchema).default([]),
  });

export const reviewAssessmentSchema = extractedAssessmentSchema.extend({
  localId: z.string().min(1),
  selected: z.boolean(),
  needsConfirmation: z.boolean(),
});

export const reviewSuggestionSchema = extractedSuggestionSchema.extend({
  localId: z.string().min(1),
  selected: z.boolean(),
});

export const syllabusReviewDraftSchema = z.object({
  language: nullableString,
  topics: z.array(reviewTopicSchema),
  assessments: z.array(reviewAssessmentSchema),
  suggestions: z.array(reviewSuggestionSchema),
  warnings: z.array(z.string().max(500)).default([]),
});

export type SyllabusReviewDraft = z.infer<typeof syllabusReviewDraftSchema>;

export const importSyllabusPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  topics: z.array(
    z.object({
      localId: z.string().min(1),
      title: z.string().min(1).max(120),
      notes: z.string().max(4000).nullable().optional(),
      selected: z.boolean(),
      subtopics: z
        .array(
          z.object({
            localId: z.string().min(1),
            title: z.string().min(1).max(120),
            notes: z.string().max(4000).nullable().optional(),
            selected: z.boolean(),
          }),
        )
        .default([]),
    }),
  ),
  assessments: z.array(
    z.object({
      localId: z.string().min(1),
      title: z.string().min(1).max(120),
      assessment_type: z.enum(ASSESSMENT_TYPES),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weightPercent: z.number().min(0).max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      selected: z.boolean(),
    }),
  ),
});

export type ImportSyllabusPayload = z.infer<typeof importSyllabusPayloadSchema>;

export function toAssessmentType(type: string | null | undefined): AssessmentType {
  if (type && (ASSESSMENT_TYPES as readonly string[]).includes(type)) {
    return type as AssessmentType;
  }
  return "other";
}

/** JSON Schema for Gemini structured output (no transforms). */
export const geminiSyllabusJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topics", "assessments", "suggestions", "warnings"],
  properties: {
    language: { type: ["string", "null"] },
    topics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "subtopics"],
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          sourceTerm: { type: ["string", "null"] },
          order: { type: "integer" },
          estimatedDifficulty: {
            type: "string",
            enum: [...TOPIC_DIFFICULTY_ESTIMATES],
          },
          sourcePage: { type: ["integer", "null"] },
          subtopics: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title"],
              properties: {
                title: { type: "string" },
                description: { type: ["string", "null"] },
                sourceTerm: { type: ["string", "null"] },
                order: { type: "integer" },
                estimatedDifficulty: {
                  type: "string",
                  enum: [...TOPIC_DIFFICULTY_ESTIMATES],
                },
                sourcePage: { type: ["integer", "null"] },
              },
            },
          },
        },
      },
    },
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "type", "dateAmbiguous"],
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: [...SYLLABUS_ASSESSMENT_TYPES] },
          date: {
            anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }],
          },
          dateAmbiguous: { type: "boolean" },
          dateRaw: { type: ["string", "null"] },
          weightPercent: { type: ["number", "null"] },
          sourcePage: { type: ["integer", "null"] },
          notes: { type: ["string", "null"] },
        },
      },
    },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "message"],
        properties: {
          kind: {
            type: "string",
            enum: ["duplicate_topic", "difficulty_estimate", "warning", "note"],
          },
          message: { type: "string" },
          relatedTopicTitle: { type: ["string", "null"] },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;
