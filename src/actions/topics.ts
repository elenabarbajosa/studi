"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isTopicStatus } from "@/lib/subjects";
import { topicInputSchema } from "@/lib/validations/phase2";

export type ActionState = {
  error?: string;
  success?: string;
};

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

export async function createTopic(
  subjectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const parentRaw = formData.get("parent_id");
  const parsed = topicInputSchema.safeParse({
    title: formData.get("title"),
    parent_id:
      parentRaw === "" || parentRaw === null ? null : String(parentRaw),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid topic" };
  }

  let countQuery = auth.supabase
    .from("topics")
    .select("*", { count: "exact", head: true })
    .eq("subject_id", subjectId)
    .eq("user_id", auth.user.id);

  countQuery = parsed.data.parent_id
    ? countQuery.eq("parent_id", parsed.data.parent_id)
    : countQuery.is("parent_id", null);

  const { count } = await countQuery;

  const { error } = await auth.supabase.from("topics").insert({
    user_id: auth.user.id,
    subject_id: subjectId,
    parent_id: parsed.data.parent_id ?? null,
    title: parsed.data.title.trim(),
    notes: parsed.data.notes?.trim() || null,
    sort_order: count ?? 0,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Topic created" };
}

export async function updateTopic(
  subjectId: string,
  topicId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = topicInputSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") ?? "",
    status: formData.get("status") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid topic" };
  }

  const { error } = await auth.supabase
    .from("topics")
    .update({
      title: parsed.data.title.trim(),
      notes: parsed.data.notes?.trim() || null,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    })
    .eq("id", topicId)
    .eq("user_id", auth.user.id)
    .eq("subject_id", subjectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Topic updated" };
}

export async function updateTopicStatus(
  subjectId: string,
  topicId: string,
  status: string,
): Promise<ActionState> {
  if (!isTopicStatus(status)) {
    return { error: "Invalid status" };
  }

  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("topics")
    .update({ status })
    .eq("id", topicId)
    .eq("user_id", auth.user.id)
    .eq("subject_id", subjectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Status updated" };
}

export async function deleteTopic(
  subjectId: string,
  topicId: string,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("topics")
    .delete()
    .eq("id", topicId)
    .eq("user_id", auth.user.id)
    .eq("subject_id", subjectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Topic deleted" };
}

export async function reorderTopics(
  subjectId: string,
  orderedIds: string[],
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const updates = orderedIds.map((id, index) =>
    auth.supabase
      .from("topics")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .eq("subject_id", subjectId),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { error: failed.error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Order updated" };
}
