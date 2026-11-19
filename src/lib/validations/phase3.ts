import { z } from "zod";

import {
  ASSESSMENT_TYPES,
  PRIORITY_LEVELS,
  STUDY_SESSION_STATUSES,
  TASK_STATUSES,
} from "@/lib/calendar";
import { END_BEFORE_START_MESSAGE } from "@/lib/event-time";

const optionalUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const assessmentSchema = z.object({
  title: z.string().min(1).max(120),
  subject_id: optionalUuid,
  assessment_type: z.enum(ASSESSMENT_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  all_day: z.coerce.boolean().optional(),
  location: z.string().max(200).optional().or(z.literal("")),
  description: z.string().max(2000).optional().or(z.literal("")),
  priority: z.enum(PRIORITY_LEVELS),
  completed: z.coerce.boolean().optional(),
}).superRefine((data, ctx) => {
  assertWallClockOrder(data, ctx, false);
});

export const personalEventSchema = z.object({
  title: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  all_day: z.coerce.boolean().optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  assertWallClockOrder(data, ctx, false);
});

export const studySessionSchema = z.object({
  subject_id: optionalUuid,
  topic_id: optionalUuid,
  task_id: optionalUuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(STUDY_SESSION_STATUSES).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  assertWallClockOrder(
    { all_day: false, start_time: data.start_time, end_time: data.end_time },
    ctx,
    true,
  );
});

export const taskSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  subject_id: optionalUuid,
  topic_id: optionalUuid,
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  due_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  scheduled_start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  scheduled_end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal("")),
  priority: z.enum(PRIORITY_LEVELS),
  estimated_minutes: z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().int().min(5).max(600).nullable()),
  status: z.enum(TASK_STATUSES).optional(),
}).superRefine((data, ctx) => {
  const start = data.scheduled_start_time ?? "";
  const end = data.scheduled_end_time ?? "";
  if (data.scheduled_date && start && end && end <= start) {
    ctx.addIssue({
      code: "custom",
      message: END_BEFORE_START_MESSAGE,
      path: ["scheduled_end_time"],
    });
  }
});

export const subtaskSchema = z.object({
  title: z.string().min(1).max(160),
});

export const eventMoveSchema = z
  .object({
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).nullable().optional(),
    all_day: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.ends_at) return;
    const start = Date.parse(data.starts_at);
    const end = Date.parse(data.ends_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      ctx.addIssue({
        code: "custom",
        message: END_BEFORE_START_MESSAGE,
        path: ["ends_at"],
      });
    }
  });

function assertWallClockOrder(
  data: { all_day?: boolean; start_time?: string; end_time?: string },
  ctx: z.RefinementCtx,
  required: boolean,
) {
  if (data.all_day) return;
  const start = data.start_time ?? "";
  const end = data.end_time ?? "";
  if (!start && !end) {
    if (required) {
      ctx.addIssue({
        code: "custom",
        message: "Add a start and end time.",
        path: ["end_time"],
      });
    }
    return;
  }
  if (required && (!start || !end)) {
    ctx.addIssue({
      code: "custom",
      message: "Add a start and end time.",
      path: ["end_time"],
    });
    return;
  }
  if (start && end && end <= start) {
    ctx.addIssue({
      code: "custom",
      message: END_BEFORE_START_MESSAGE,
      path: ["end_time"],
    });
  }
}
