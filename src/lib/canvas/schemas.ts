import { z } from "zod";

import { RESOURCE_TYPES } from "@/lib/subjects";

export const canvasConfidenceSchema = z.enum(["high", "medium", "low", "none"]);

export const canvasClassificationItemSchema = z.object({
  localId: z.string().min(1).max(64),
  topicId: z.union([z.string().uuid(), z.null()]).optional().default(null),
  confidence: canvasConfidenceSchema.optional().default("none"),
  explanation: z.string().max(280).optional().default(""),
});

export const canvasClassificationResponseSchema = z.object({
  classifications: z.array(canvasClassificationItemSchema).max(200),
});

export type CanvasClassificationResponse = z.infer<
  typeof canvasClassificationResponseSchema
>;

/** Gemini responseJsonSchema (subset of JSON Schema). */
export const geminiCanvasClassifyJsonSchema = {
  type: "object",
  properties: {
    classifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          localId: { type: "string" },
          topicId: { type: ["string", "null"] },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low", "none"],
          },
          explanation: { type: "string" },
        },
        required: ["localId", "topicId", "confidence", "explanation"],
      },
    },
  },
  required: ["classifications"],
} as const;

export const canvasInventoryItemSchema = z.object({
  localId: z.string().min(1).max(64),
  kind: z.enum([
    "file",
    "external_link",
    "canvas_internal",
    "missing",
    "unsupported",
  ]),
  title: z.string().min(1).max(200),
  archivePath: z.string().max(500).nullable(),
  externalUrl: z.string().max(2000).nullable(),
  modulePath: z.string().max(500).nullable(),
  suggestedResourceType: z.enum(RESOURCE_TYPES),
  mimeHint: z.string().max(120).nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  note: z.string().max(500).nullable(),
});

export const canvasReviewItemSchema = canvasInventoryItemSchema.extend({
  selected: z.boolean(),
  topicId: z.string().uuid().nullable(),
  confidence: canvasConfidenceSchema,
  explanation: z.string().max(280),
  renamedTitle: z.string().min(1).max(120),
  duplicateOfMaterialId: z.string().uuid().nullable(),
});

export const canvasImportConfirmSchema = z.object({
  stagingPath: z.string().min(1).max(512),
  items: z.array(canvasReviewItemSchema).min(1).max(200),
  sendContentConsent: z.boolean().optional().default(false),
});

export type CanvasImportConfirmInput = z.infer<typeof canvasImportConfirmSchema>;
