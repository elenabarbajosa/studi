import { z } from "zod";

import {
  GRADE_COMPONENT_TYPES,
  WEIGHT_TOTAL_TOLERANCE,
} from "@/lib/grades/types";

const nullableNumber = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? null : v));

export const gradeGroupDraftSchema = z.object({
  id: z.string().uuid().optional(),
  clientKey: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  weightPercent: z.number().min(0).max(100),
  sortOrder: z.number().int().nonnegative(),
});

export const gradeComponentDraftSchema = z.object({
  id: z.string().uuid().optional(),
  clientKey: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  componentType: z.enum(GRADE_COMPONENT_TYPES),
  weightPercent: z.number().min(0).max(100),
  weightWithinGroup: z.number().min(0).max(100).nullable().optional(),
  maxScore: z.number().positive().max(1_000_000),
  score: z.number().min(0).nullable().optional(),
  minScore: z.number().min(0).nullable().optional(),
  groupClientKey: z.string().min(1).max(64).nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  assessmentId: z.string().uuid().nullable().optional(),
  dueAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const saveGradeSchemeSchema = z
  .object({
    subjectId: z.string().uuid(),
    displayScaleMax: z.number().positive().max(1_000_000),
    passingOverall: nullableNumber,
    passingFinalMin: nullableNumber,
    groups: z.array(gradeGroupDraftSchema).max(40),
    components: z.array(gradeComponentDraftSchema).min(1).max(80),
  })
  .superRefine((data, ctx) => {
    const links = new Set<string>();
    for (const c of data.components) {
      if (c.score != null && c.score > c.maxScore) {
        ctx.addIssue({
          code: "custom",
          message: `Score for “${c.title}” exceeds its maximum.`,
        });
      }
      if (c.minScore != null && c.minScore > c.maxScore) {
        ctx.addIssue({
          code: "custom",
          message: `Minimum for “${c.title}” exceeds its maximum.`,
        });
      }
      if (c.assessmentId) {
        if (links.has(c.assessmentId)) {
          ctx.addIssue({
            code: "custom",
            message: "The same calendar assessment is linked more than once.",
          });
        }
        links.add(c.assessmentId);
      }
    }

    for (const g of data.groups) {
      const children = data.components.filter(
        (c) => c.groupClientKey === g.clientKey,
      );
      const within = children.reduce(
        (s, c) => s + (c.weightWithinGroup ?? 0),
        0,
      );
      if (children.length && Math.abs(within - 100) > WEIGHT_TOTAL_TOLERANCE) {
        ctx.addIssue({
          code: "custom",
          message: `Group “${g.title}” internal weights must total 100%.`,
        });
      }
    }
  });

export const updateComponentScoreSchema = z.object({
  subjectId: z.string().uuid(),
  componentId: z.string().uuid(),
  score: z.number().min(0).nullable(),
});

export type SaveGradeSchemeInput = z.infer<typeof saveGradeSchemeSchema>;
export type UpdateComponentScoreInput = z.infer<typeof updateComponentScoreSchema>;
