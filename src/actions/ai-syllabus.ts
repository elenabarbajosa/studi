"use server";

import { revalidatePath } from "next/cache";

import { AiFeatureError, userMessageFromAiError } from "@/lib/ai/errors";
import { extractSyllabusDraft } from "@/lib/ai/extract";
import {
  countSelectedImport,
  planImportInserts,
} from "@/lib/ai/import-plan";
import { AI_LIMITS } from "@/lib/ai/limits";
import { validatePdfUpload, validatePastedText } from "@/lib/ai/pdf";
import {
  importSyllabusPayloadSchema,
  syllabusReviewDraftSchema,
  type SyllabusReviewDraft,
} from "@/lib/ai/schemas";
import {
  claimSyllabusImportUsage,
  consumeImportSession,
  createImportSession,
} from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ExtractSyllabusResult =
  | {
      ok: true;
      sessionId: string;
      draft: SyllabusReviewDraft;
      model: string;
      remaining: number;
      limit: number;
    }
  | { ok: false; error: string; code?: string };

export type ImportSyllabusResult =
  | {
      ok: true;
      importedTopics: number;
      importedSubtopics: number;
      importedAssessments: number;
      skippedDuplicates: string[];
      errors: string[];
      partial: boolean;
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
    .select("id, name")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new AiFeatureError("unknown", error.message);
  if (!data) throw new AiFeatureError("forbidden", "Subject not found.");
  return data as { id: string; name: string };
}

function revalidateAfterImport(subjectId: string) {
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/subjects");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function extractSyllabus(
  subjectId: string,
  formData: FormData,
): Promise<ExtractSyllabusResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "You must be signed in.", code: "unauthorized" };
    }

    const privacyAccepted =
      formData.get("privacyAccepted") === "on" ||
      formData.get("privacyAccepted") === "true";
    if (!privacyAccepted) {
      return {
        ok: false,
        error:
          "Confirm that you understand Google may use free-tier submissions to improve its products before continuing.",
        code: "invalid_input",
      };
    }

    const subject = await requireOwnedSubject(auth.supabase, auth.user.id, subjectId);

    const { data: existingTopics, error: topicsError } = await auth.supabase
      .from("topics")
      .select("title")
      .eq("subject_id", subjectId)
      .eq("user_id", auth.user.id)
      .is("parent_id", null);

    if (topicsError) {
      return { ok: false, error: topicsError.message, code: "unknown" };
    }

    const existingTopicTitles = (existingTopics ?? []).map((t) => t.title);

    const file = formData.get("file");
    const textRaw = formData.get("text");
    const hasFile = file instanceof File && file.size > 0;
    const hasText = typeof textRaw === "string" && textRaw.trim().length > 0;

    if (hasFile && hasText) {
      return {
        ok: false,
        error: "Upload a PDF or paste text, not both at once.",
        code: "invalid_input",
      };
    }
    if (!hasFile && !hasText) {
      return {
        ok: false,
        error: "Upload a PDF syllabus or paste the text.",
        code: "invalid_input",
      };
    }

    // Validate inputs before claiming usage so bad uploads do not burn the daily limit.
    let pdfInput: Awaited<ReturnType<typeof validatePdfUpload>> | null = null;
    let textInput: string | null = null;
    if (hasFile && file instanceof File) {
      if (file.size > AI_LIMITS.maxPdfBytes) {
        return {
          ok: false,
          error: `PDF must be ${Math.floor(AI_LIMITS.maxPdfBytes / (1024 * 1024))} MB or smaller.`,
          code: "invalid_input",
        };
      }
      const buffer = new Uint8Array(await file.arrayBuffer());
      pdfInput = await validatePdfUpload({
        bytes: buffer,
        fileName: file.name,
        mimeType: file.type,
      });
    } else {
      textInput = validatePastedText(String(textRaw));
    }

    // Claim usage before calling Gemini so concurrent requests share the limit.
    const claim = await claimSyllabusImportUsage(auth.supabase, auth.user.id);
    const sessionId = await createImportSession(auth.supabase, subjectId);

    const extracted = pdfInput
      ? await extractSyllabusDraft({
          kind: "pdf",
          pdf: pdfInput,
          subjectName: subject.name,
          existingTopicTitles,
        })
      : await extractSyllabusDraft({
          kind: "text",
          text: textInput as string,
          subjectName: subject.name,
          existingTopicTitles,
        });

    const draftParsed = syllabusReviewDraftSchema.safeParse(extracted.draft);
    if (!draftParsed.success) {
      return {
        ok: false,
        error: "Could not build a review draft from the extraction.",
        code: "parse_error",
      };
    }

    return {
      ok: true,
      sessionId,
      draft: draftParsed.data,
      model: extracted.model,
      remaining: claim.remaining,
      limit: claim.limit,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}

export async function importSyllabus(
  subjectId: string,
  payload: unknown,
): Promise<ImportSyllabusResult> {
  try {
    const auth = await requireAuthedClient();
    if ("error" in auth) {
      return { ok: false, error: auth.error ?? "You must be signed in.", code: "unauthorized" };
    }

    await requireOwnedSubject(auth.supabase, auth.user.id, subjectId);

    const parsed = importSyllabusPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid import payload.",
        code: "invalid_input",
      };
    }

    await consumeImportSession(auth.supabase, parsed.data.sessionId, subjectId);

    const { data: existingTopics, error: topicsError } = await auth.supabase
      .from("topics")
      .select("title")
      .eq("subject_id", subjectId)
      .eq("user_id", auth.user.id)
      .is("parent_id", null);

    if (topicsError) {
      return { ok: false, error: topicsError.message, code: "unknown" };
    }

    const existingTitles = (existingTopics ?? []).map((t) => t.title);
    const { count } = await auth.supabase
      .from("topics")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", subjectId)
      .eq("user_id", auth.user.id)
      .is("parent_id", null);

    const baseSort = count ?? 0;
    const plan = planImportInserts(parsed.data, existingTitles);

    const errors: string[] = [];
    let importedTopics = 0;
    let importedSubtopics = 0;
    let importedAssessments = 0;

    for (const topic of plan.topics) {
      const { data: inserted, error } = await auth.supabase
        .from("topics")
        .insert({
          user_id: auth.user.id,
          subject_id: subjectId,
          parent_id: null,
          title: topic.title,
          notes: topic.notes,
          sort_order: baseSort + topic.sort_order,
          status: "not_started",
        })
        .select("id")
        .single();

      if (error || !inserted) {
        errors.push(`Topic "${topic.title}": ${error?.message ?? "insert failed"}`);
        continue;
      }

      importedTopics += 1;

      for (const sub of topic.subtopics) {
        const { error: subError } = await auth.supabase.from("topics").insert({
          user_id: auth.user.id,
          subject_id: subjectId,
          parent_id: inserted.id,
          title: sub.title,
          notes: sub.notes,
          sort_order: sub.sort_order,
          status: "not_started",
        });
        if (subError) {
          errors.push(`Subtopic "${sub.title}": ${subError.message}`);
        } else {
          importedSubtopics += 1;
        }
      }
    }

    for (const assessment of plan.assessments) {
      const { error } = await auth.supabase.from("assessments").insert({
        user_id: auth.user.id,
        subject_id: subjectId,
        title: assessment.title,
        assessment_type: assessment.assessment_type,
        starts_at: assessment.starts_at,
        ends_at: assessment.ends_at,
        all_day: assessment.all_day,
        description: assessment.description,
        priority: "medium",
        completed: false,
      });
      if (error) {
        errors.push(`Assessment "${assessment.title}": ${error.message}`);
      } else {
        importedAssessments += 1;
      }
    }

    const selected = countSelectedImport(parsed.data);
    const expected =
      selected.topics + selected.subtopics + selected.assessments;
    const done = importedTopics + importedSubtopics + importedAssessments;
    const partial =
      errors.length > 0 ||
      plan.skippedDuplicates.length > 0 ||
      (expected > 0 && done < expected);

    revalidateAfterImport(subjectId);

    return {
      ok: true,
      importedTopics,
      importedSubtopics,
      importedAssessments,
      skippedDuplicates: plan.skippedDuplicates,
      errors,
      partial,
    };
  } catch (error) {
    return {
      ok: false,
      error: userMessageFromAiError(error),
      code: error instanceof AiFeatureError ? error.code : "unknown",
    };
  }
}
