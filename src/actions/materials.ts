"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { materialInputSchema } from "@/lib/validations/phase2";

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

export async function createMaterial(
  subjectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const topicRaw = formData.get("topic_id");
  const parsed = materialInputSchema.safeParse({
    title: formData.get("title"),
    resource_type: formData.get("resource_type"),
    url: formData.get("url"),
    description: formData.get("description") ?? "",
    topic_id: topicRaw === "" || topicRaw === null ? null : String(topicRaw),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid material" };
  }

  const { error } = await auth.supabase.from("materials").insert({
    user_id: auth.user.id,
    subject_id: subjectId,
    topic_id: parsed.data.topic_id ?? null,
    title: parsed.data.title.trim(),
    resource_type: parsed.data.resource_type,
    url: parsed.data.url.trim(),
    description: parsed.data.description?.trim() || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Material added" };
}

export async function deleteMaterial(
  subjectId: string,
  materialId: string,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("materials")
    .delete()
    .eq("id", materialId)
    .eq("user_id", auth.user.id)
    .eq("subject_id", subjectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/subjects/${subjectId}`);
  return { success: "Material removed" };
}
