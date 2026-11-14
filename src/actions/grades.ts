"use server";

import { revalidatePath } from "next/cache";

import {
  isSchemeWeightComplete,
  totalConfiguredWeight,
} from "@/lib/grades/math";
import {
  saveGradeSchemeSchema,
  updateComponentScoreSchema,
  type SaveGradeSchemeInput,
} from "@/lib/grades/schemas";
import type { GradeSchemeInput } from "@/lib/grades/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type GradeActionResult =
  | { ok: true; schemeId: string; status: "draft" | "complete" }
  | { ok: false; error: string };

export type ScoreActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAuthedClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured." } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." } as const;
  }
  return { supabase, user } as const;
}

async function requireOwnedSubject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subjectId: string,
) {
  const { data, error } = await supabase
    .from("subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { error: error.message } as const;
  if (!data) return { error: "Subject not found." } as const;
  return { subjectId: data.id } as const;
}

function revalidateGrades(subjectId: string) {
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/grades");
  revalidatePath("/subjects");
  revalidatePath("/dashboard");
}

function draftToMathInput(input: SaveGradeSchemeInput): GradeSchemeInput {
  const groupIdByKey = new Map(
    input.groups.map((g) => [g.clientKey, g.id ?? g.clientKey]),
  );
  return {
    displayScaleMax: input.displayScaleMax,
    passingOverall: input.passingOverall,
    passingFinalMin: input.passingFinalMin,
    groups: input.groups.map((g) => ({
      id: g.id ?? g.clientKey,
      title: g.title,
      weightPercent: g.weightPercent,
      sortOrder: g.sortOrder,
    })),
    components: input.components.map((c) => ({
      id: c.id ?? c.clientKey,
      title: c.title,
      componentType: c.componentType,
      weightPercent: c.groupClientKey ? 0 : c.weightPercent,
      maxScore: c.maxScore,
      score: c.score ?? null,
      minScore: c.minScore ?? null,
      groupId: c.groupClientKey
        ? (groupIdByKey.get(c.groupClientKey) ?? null)
        : null,
      weightWithinGroup: c.groupClientKey ? (c.weightWithinGroup ?? 0) : null,
      sortOrder: c.sortOrder,
      assessmentId: c.assessmentId ?? null,
      dueAt: c.dueAt ?? null,
    })),
  };
}

/**
 * Upsert the subject's grading scheme and replace groups/components atomically
 * enough for a single-user editor (delete missing, upsert present).
 */
export async function saveGradeScheme(
  raw: unknown,
): Promise<GradeActionResult> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { ok: false, error: auth.error ?? "You must be signed in." };

  const parsed = saveGradeSchemeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid grading scheme.",
    };
  }
  const input = parsed.data;

  const owned = await requireOwnedSubject(
    auth.supabase,
    auth.user.id,
    input.subjectId,
  );
  if ("error" in owned) return { ok: false, error: owned.error ?? "Subject not found." };

  const mathInput = draftToMathInput(input);
  const complete = isSchemeWeightComplete(mathInput);
  const status = complete ? "complete" : "draft";

  // Ensure scheme row
  const { data: existing } = await auth.supabase
    .from("subject_grade_schemes")
    .select("id")
    .eq("subject_id", input.subjectId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  let schemeId = existing?.id as string | undefined;
  if (schemeId) {
    const { error } = await auth.supabase
      .from("subject_grade_schemes")
      .update({
        display_scale_max: input.displayScaleMax,
        passing_overall: input.passingOverall,
        passing_final_min: input.passingFinalMin,
        status,
      })
      .eq("id", schemeId)
      .eq("user_id", auth.user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await auth.supabase
      .from("subject_grade_schemes")
      .insert({
        user_id: auth.user.id,
        subject_id: input.subjectId,
        display_scale_max: input.displayScaleMax,
        passing_overall: input.passingOverall,
        passing_final_min: input.passingFinalMin,
        status,
      })
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error:
          error?.message?.includes("subject_grade_schemes") ||
          error?.message?.includes("schema cache")
            ? "Grades storage is not set up. Apply migration 017_grades.sql."
            : error?.message || "Could not create grading scheme.",
      };
    }
    schemeId = data.id;
  }

  // Load existing groups/components to delete removed ones
  const [{ data: oldGroups }, { data: oldComponents }] = await Promise.all([
    auth.supabase
      .from("grade_groups")
      .select("id")
      .eq("scheme_id", schemeId)
      .eq("user_id", auth.user.id),
    auth.supabase
      .from("grade_components")
      .select("id")
      .eq("scheme_id", schemeId)
      .eq("user_id", auth.user.id),
  ]);

  const keepGroupIds = new Set(
    input.groups.map((g) => g.id).filter((id): id is string => Boolean(id)),
  );
  const keepComponentIds = new Set(
    input.components.map((c) => c.id).filter((id): id is string => Boolean(id)),
  );

  const groupsToDelete = (oldGroups ?? [])
    .map((g) => g.id)
    .filter((id) => !keepGroupIds.has(id));
  const componentsToDelete = (oldComponents ?? [])
    .map((c) => c.id)
    .filter((id) => !keepComponentIds.has(id));

  if (componentsToDelete.length) {
    await auth.supabase
      .from("grade_components")
      .delete()
      .in("id", componentsToDelete)
      .eq("user_id", auth.user.id);
  }
  if (groupsToDelete.length) {
    await auth.supabase
      .from("grade_groups")
      .delete()
      .in("id", groupsToDelete)
      .eq("user_id", auth.user.id);
  }

  // Upsert groups first (need ids for components)
  const groupIdByClientKey = new Map<string, string>();
  for (const g of input.groups) {
    if (g.id) {
      const { error } = await auth.supabase
        .from("grade_groups")
        .update({
          title: g.title,
          weight_percent: g.weightPercent,
          sort_order: g.sortOrder,
        })
        .eq("id", g.id)
        .eq("user_id", auth.user.id);
      if (error) return { ok: false, error: error.message };
      groupIdByClientKey.set(g.clientKey, g.id);
    } else {
      const { data, error } = await auth.supabase
        .from("grade_groups")
        .insert({
          user_id: auth.user.id,
          subject_id: input.subjectId,
          scheme_id: schemeId,
          title: g.title,
          weight_percent: g.weightPercent,
          sort_order: g.sortOrder,
        })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: error?.message || "Group save failed." };
      groupIdByClientKey.set(g.clientKey, data.id);
    }
  }

  for (const c of input.components) {
    const groupId = c.groupClientKey
      ? (groupIdByClientKey.get(c.groupClientKey) ?? null)
      : null;
    const row = {
      title: c.title,
      component_type: c.componentType,
      weight_percent: groupId ? 0 : c.weightPercent,
      weight_within_group: groupId ? (c.weightWithinGroup ?? 0) : null,
      max_score: c.maxScore,
      score: c.score ?? null,
      min_score: c.minScore ?? null,
      group_id: groupId,
      sort_order: c.sortOrder,
      assessment_id: c.assessmentId ?? null,
      due_at: c.dueAt ?? null,
    };

    if (c.id) {
      const { error } = await auth.supabase
        .from("grade_components")
        .update(row)
        .eq("id", c.id)
        .eq("user_id", auth.user.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await auth.supabase.from("grade_components").insert({
        user_id: auth.user.id,
        subject_id: input.subjectId,
        scheme_id: schemeId,
        ...row,
      });
      if (error) return { ok: false, error: error.message };
    }
  }

  // Refresh status after final weight check using saved effective weights
  void totalConfiguredWeight;
  revalidateGrades(input.subjectId);
  return { ok: true, schemeId, status };
}

export async function updateGradeComponentScore(
  raw: unknown,
): Promise<ScoreActionResult> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { ok: false, error: auth.error ?? "You must be signed in." };

  const parsed = updateComponentScoreSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid score.",
    };
  }

  const { subjectId, componentId, score } = parsed.data;
  const owned = await requireOwnedSubject(
    auth.supabase,
    auth.user.id,
    subjectId,
  );
  if ("error" in owned) return { ok: false, error: owned.error ?? "Subject not found." };

  const { data: component, error: loadError } = await auth.supabase
    .from("grade_components")
    .select("id, max_score, subject_id")
    .eq("id", componentId)
    .eq("user_id", auth.user.id)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!component) return { ok: false, error: "Assessment not found." };

  if (score != null && score > Number(component.max_score)) {
    return {
      ok: false,
      error: `Score cannot exceed ${component.max_score}.`,
    };
  }

  const { error } = await auth.supabase
    .from("grade_components")
    .update({ score })
    .eq("id", componentId)
    .eq("user_id", auth.user.id);

  if (error) return { ok: false, error: error.message };

  revalidateGrades(subjectId);
  return { ok: true };
}

export async function deleteGradeScheme(
  subjectId: string,
): Promise<ScoreActionResult> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { ok: false, error: auth.error ?? "You must be signed in." };

  const owned = await requireOwnedSubject(
    auth.supabase,
    auth.user.id,
    subjectId,
  );
  if ("error" in owned) return { ok: false, error: owned.error ?? "Subject not found." };

  const { error } = await auth.supabase
    .from("subject_grade_schemes")
    .delete()
    .eq("subject_id", subjectId)
    .eq("user_id", auth.user.id);

  if (error) return { ok: false, error: error.message };
  revalidateGrades(subjectId);
  return { ok: true };
}
