"use server";

import { revalidatePath } from "next/cache";

import { AiFeatureError, userMessageFromAiError } from "@/lib/ai/errors";
import { AI_STUDY_PLAN_FEATURE } from "@/lib/ai/limits";
import {
  claimStudyPlanUsage,
  consumeGenerationSession,
  createGenerationSession,
} from "@/lib/ai/usage";
import {
  defaultPrefsFromStudy,
  ensureDayAvailability,
  getActiveStudyPlan,
  loadPlannerDashboard,
  resolvePeriodBounds,
} from "@/lib/planner/context";
import { isOneDayPeriod } from "@/lib/planner/types";
import {
  allocationsFromRecommendation,
  generateAiRecommendations,
} from "@/lib/planner/recommend";
import {
  adjustPlanPayloadSchema,
  plannerPreferencesInputSchema,
  saveStudyPlanPayloadSchema,
  type PlannerPreferencesInput,
} from "@/lib/planner/schemas";
import {
  buildSchedule,
  detectSessionConflicts,
  resetProposalIds,
} from "@/lib/planner/schedule";
import type { ProposedSession } from "@/lib/planner/types";
import { zonedDateTimeToUtcIso } from "@/lib/planner/zoned-time";
import { getStudyPreferences } from "@/lib/data/subjects";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type GeneratePlanResult =
  | {
      ok: true;
      sessionId: string;
      summary: string;
      recommendations: string[];
      warnings: string[];
      sessions: ProposedSession[];
      plannedMinutes: number;
      remaining: number;
      limit: number;
      usedAi: boolean;
      periodStart: string;
      periodEnd: string;
      conflicts: { localId: string; message: string }[];
    }
  | { ok: false; error: string; code?: string };

export type SavePlanResult =
  | {
      ok: true;
      planId: string;
      savedSessions: number;
      partial: boolean;
      errors: string[];
    }
  | { ok: false; error: string; code?: string };

async function requireAuthedClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." } as const;
  return { supabase, user } as const;
}

function revalidatePlanner() {
  revalidatePath("/planner");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/focus");
}

/** Persistable prefs — drops ephemeral NL instruction. */
function prefsForStorage(prefs: PlannerPreferencesInput) {
  const { user_instruction, ...rest } = prefs;
  void user_instruction;
  return rest;
}

export async function savePlannerPreferences(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) return { ok: false, error: auth.error ?? "Unauthorized" };

    const parsed = plannerPreferencesInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid preferences" };
    }

    const { error } = await auth.supabase.from("planner_preferences").upsert(
      {
        user_id: auth.user.id,
        ...prefsForStorage(parsed.data),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      if (error.message.includes("planner_preferences") || error.code === "42P01") {
        return {
          ok: false,
          error:
            "Planner preferences are not set up yet. Apply migration 012_phase10_ai_study_planner.sql in Supabase.",
        };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath("/planner");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: userMessageFromAiError(error) };
  }
}

export async function generateStudyPlan(
  preferencesOverride?: unknown,
): Promise<GeneratePlanResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "Unauthorized", code: "unauthorized" };
    }

    const dashboard = await loadPlannerDashboard(auth.user.id);
    let preferences = dashboard.preferences;
    if (preferencesOverride) {
      const parsed = plannerPreferencesInputSchema.safeParse(preferencesOverride);
      if (!parsed.success) {
        return {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid preferences",
          code: "invalid_input",
        };
      }
      preferences = parsed.data;
      // Persist for next time (best effort) — skip ephemeral instruction
      await auth.supabase.from("planner_preferences").upsert(
        {
          user_id: auth.user.id,
          ...prefsForStorage(parsed.data),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }

    const bounds = resolvePeriodBounds(
      preferences,
      dashboard.timeZone,
      dashboard.assessments,
    );

    const schedulingPrefs = isOneDayPeriod(preferences.planning_period)
      ? ensureDayAvailability(preferences, bounds.periodStart, dashboard.timeZone)
      : preferences;

    const context = {
      ...dashboard.context,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      intensity: preferences.intensity,
      includeRevision: preferences.include_revision,
      userInstruction: preferences.user_instruction?.trim() || undefined,
    };

    // Claim usage then create generation session before Gemini
    const claim = await claimStudyPlanUsage(auth.supabase, auth.user.id);
    const sessionId = await createGenerationSession(auth.supabase, AI_STUDY_PLAN_FEATURE);

    const { recommendation, usedAi } = await generateAiRecommendations(context);
    const allocations = allocationsFromRecommendation(context, recommendation);

    resetProposalIds();
    const schedule = buildSchedule(
      {
        timeZone: dashboard.timeZone,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        weekdayAvailability: schedulingPrefs.weekday_availability,
        timeWindows: schedulingPrefs.time_windows,
        restDays: schedulingPrefs.rest_days,
        maxHoursPerDay: schedulingPrefs.max_hours_per_day,
        sessionMinutes: schedulingPrefs.preferred_session_minutes,
        breakMinutes: schedulingPrefs.break_minutes,
        includeRevision: schedulingPrefs.include_revision,
        nowIso: new Date().toISOString(),
        busy: dashboard.busy,
      },
      allocations,
    );

    const conflicts = detectSessionConflicts(
      schedule.sessions,
      dashboard.busy,
      dashboard.timeZone,
    );

    const recommendations = [
      recommendation.summary,
      ...recommendation.subjectPriorities
        .slice()
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5)
        .map((s) => {
          const name =
            dashboard.subjects.find((x) => x.id === s.subjectId)?.name ?? "Subject";
          return `${name}: ${s.reasoning}`;
        }),
      ...recommendation.practiceNeeded.slice(0, 3).map((p) => p.message),
    ].filter(Boolean);

    return {
      ok: true,
      sessionId,
      summary: recommendation.summary,
      recommendations,
      warnings: [...recommendation.workloadWarnings, ...schedule.warnings],
      sessions: schedule.sessions,
      plannedMinutes: schedule.plannedMinutes,
      remaining: claim.remaining,
      limit: claim.limit,
      usedAi,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      conflicts,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function saveStudyPlan(payload: unknown): Promise<SavePlanResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "Unauthorized", code: "unauthorized" };
    }

    const parsed = saveStudyPlanPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid plan payload",
        code: "invalid_input",
      };
    }

    await consumeGenerationSession(
      auth.supabase,
      parsed.data.sessionId,
      AI_STUDY_PLAN_FEATURE,
    );

    const selected = parsed.data.sessions.filter((s) => s.selected);
    if (selected.length === 0) {
      return { ok: false, error: "Select at least one session to save.", code: "invalid_input" };
    }

    const isOneDay =
      parsed.data.periodStart === parsed.data.periodEnd;

    // Longer-term saves replace the active plan marker. One-day saves keep
    // existing active longer-term plans and only append new sessions.
    if (!isOneDay) {
      await auth.supabase
        .from("study_plans")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("user_id", auth.user.id)
        .eq("status", "active");
    }

    const { data: plan, error: planError } = await auth.supabase
      .from("study_plans")
      .insert({
        user_id: auth.user.id,
        title: parsed.data.title,
        // One-day plans are recorded as completed so they don't steal the
        // "active" longer-term plan slot.
        status: isOneDay ? "completed" : "active",
        period_start: parsed.data.periodStart,
        period_end: parsed.data.periodEnd,
        intensity: parsed.data.intensity,
        timezone: parsed.data.timezone,
        summary: parsed.data.summary,
        recommendations: parsed.data.recommendations,
        warnings: parsed.data.warnings,
        generation_session_id: parsed.data.sessionId,
      })
      .select("id")
      .single();

    if (planError || !plan) {
      return {
        ok: false,
        error: planError?.message ?? "Could not create study plan.",
        code: "unknown",
      };
    }

    const errors: string[] = [];
    let savedSessions = 0;

    for (const session of selected) {
      const startsAt = zonedDateTimeToUtcIso(
        session.date,
        session.startTime,
        parsed.data.timezone,
      );
      const endsAt = zonedDateTimeToUtcIso(
        session.date,
        session.endTime,
        parsed.data.timezone,
      );
      const duration = Math.max(
        5,
        Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000),
      );

      const { data: inserted, error } = await auth.supabase
        .from("study_sessions")
        .insert({
          user_id: auth.user.id,
          subject_id: session.subjectId,
          topic_id: session.topicId,
          task_id: session.taskId,
          starts_at: startsAt,
          ends_at: endsAt,
          planned_duration_minutes: duration,
          status: "planned",
          notes: session.goal,
          source: "calendar",
          goal: session.goal,
        })
        .select("id")
        .single();

      if (error || !inserted) {
        errors.push(`${session.date} ${session.startTime}: ${error?.message ?? "failed"}`);
        continue;
      }

      const { error: linkError } = await auth.supabase.from("study_plan_sessions").insert({
        plan_id: plan.id,
        study_session_id: inserted.id,
        user_id: auth.user.id,
        locked: session.locked,
        user_edited: false,
      });
      if (linkError) {
        errors.push(`Link ${session.date}: ${linkError.message}`);
      } else {
        savedSessions += 1;
      }
    }

    revalidatePlanner();
    return {
      ok: true,
      planId: plan.id,
      savedSessions,
      partial: errors.length > 0 || savedSessions < selected.length,
      errors,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function adjustStudyPlan(payload: unknown): Promise<GeneratePlanResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "Unauthorized", code: "unauthorized" };
    }

    const parsed = adjustPlanPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid adjust payload",
        code: "invalid_input",
      };
    }

    const { data: plan } = await auth.supabase
      .from("study_plans")
      .select("*")
      .eq("id", parsed.data.planId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!plan) {
      return { ok: false, error: "Plan not found.", code: "forbidden" };
    }

    const dashboard = await loadPlannerDashboard(auth.user.id);
    const preferences = {
      ...dashboard.preferences,
      ...(parsed.data.preferences ?? {}),
    } as PlannerPreferencesInput;

    // Locked sessions stay busy so reschedule won't overwrite them
    const lockedBusy =
      parsed.data.preserveLocked
        ? dashboard.planSessions
            .filter((p) => p.link.locked || p.link.user_edited)
            .map((p) => ({
              startsAt: p.session.starts_at,
              endsAt: p.session.ends_at ?? p.session.starts_at,
              label: "Locked session",
            }))
        : [];

    const bounds = resolvePeriodBounds(
      preferences,
      dashboard.timeZone,
      dashboard.assessments,
    );

    const claim = await claimStudyPlanUsage(auth.supabase, auth.user.id);
    const sessionId = await createGenerationSession(auth.supabase, AI_STUDY_PLAN_FEATURE);

    const context = {
      ...dashboard.context,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      intensity: preferences.intensity,
      includeRevision: preferences.include_revision,
    };

    const { recommendation, usedAi } = await generateAiRecommendations(context);
    recommendation.workloadWarnings = [
      `Adjusting plan (${parsed.data.reason.replaceAll("_", " ")}). Locked sessions are preserved.`,
      ...recommendation.workloadWarnings,
    ];

    const allocations = allocationsFromRecommendation(context, recommendation);
    resetProposalIds();
    const schedule = buildSchedule(
      {
        timeZone: dashboard.timeZone,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        weekdayAvailability: preferences.weekday_availability,
        timeWindows: preferences.time_windows,
        restDays: preferences.rest_days,
        maxHoursPerDay: preferences.max_hours_per_day,
        sessionMinutes: preferences.preferred_session_minutes,
        breakMinutes: preferences.break_minutes,
        includeRevision: preferences.include_revision,
        nowIso: new Date().toISOString(),
        busy: [...dashboard.busy, ...lockedBusy],
      },
      allocations,
    );

    // Attach locked existing sessions into the proposal for comparison (not selected for re-save by default)
    const lockedSessions: ProposedSession[] = dashboard.planSessions
      .filter((p) => p.link.locked || p.link.user_edited)
      .map((p, index) => {
        const start = new Date(p.session.starts_at);
        const end = new Date(p.session.ends_at ?? p.session.starts_at);
        const date = p.session.starts_at.slice(0, 10);
        const pad = (n: number) => String(n).padStart(2, "0");
        // Use timezone-aware display via ISO local parts approximation
        void index;
        return {
          localId: `locked_${p.session.id}`,
          subjectId: p.session.subject_id ?? dashboard.subjects[0]?.id ?? p.session.id,
          topicId: p.session.topic_id,
          taskId: p.session.task_id,
          date,
          startTime: `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`,
          endTime: `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`,
          durationMinutes: p.session.planned_duration_minutes ?? 50,
          goal: p.session.goal ?? p.session.notes,
          kind: "study" as const,
          locked: true,
          selected: false,
        };
      })
      .filter((s) => Boolean(s.subjectId));

    const conflicts = detectSessionConflicts(
      schedule.sessions,
      [...dashboard.busy, ...lockedBusy],
      dashboard.timeZone,
    );

    return {
      ok: true,
      sessionId,
      summary: recommendation.summary,
      recommendations: [
        recommendation.summary,
        "Review the new proposal. Locked sessions will not be changed automatically.",
      ],
      warnings: [...recommendation.workloadWarnings, ...schedule.warnings],
      sessions: [...lockedSessions, ...schedule.sessions],
      plannedMinutes: schedule.plannedMinutes,
      remaining: claim.remaining,
      limit: claim.limit,
      usedAi,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      conflicts,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function togglePlanSessionLock(
  planSessionId: string,
  locked: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { ok: false, error: auth.error ?? "Unauthorized" };

  const { error } = await auth.supabase
    .from("study_plan_sessions")
    .update({ locked, user_edited: locked ? true : undefined })
    .eq("id", planSessionId)
    .eq("user_id", auth.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/planner");
  return { ok: true };
}

export async function getDefaultPlannerPreferences(): Promise<PlannerPreferencesInput> {
  const study = await getStudyPreferences();
  return defaultPrefsFromStudy(study);
}

export async function peekActivePlanId(): Promise<string | null> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return null;
  const plan = await getActiveStudyPlan(auth.user.id);
  return plan?.id ?? null;
}
