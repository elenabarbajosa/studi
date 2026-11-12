"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { subjectInputSchema } from "@/lib/validations/phase2";

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

function parseSubjectForm(formData: FormData) {
  const difficultyRaw = formData.get("difficulty");
  return subjectInputSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    difficulty:
      difficultyRaw === "" || difficultyRaw === null
        ? null
        : Number(difficultyRaw),
    description: formData.get("description") ?? "",
  });
}

export async function createSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = parseSubjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subject" };
  }

  const { count } = await auth.supabase
    .from("subjects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", auth.user.id);

  const { data, error } = await auth.supabase
    .from("subjects")
    .insert({
      user_id: auth.user.id,
      name: parsed.data.name.trim(),
      color: parsed.data.color,
      difficulty: parsed.data.difficulty ?? null,
      description: parsed.data.description?.trim() || null,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  if (data?.id) {
    redirect(`/subjects/${data.id}`);
  }
  return { success: "Subject created" };
}

export async function updateSubject(
  subjectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = parseSubjectForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subject" };
  }

  const { error } = await auth.supabase
    .from("subjects")
    .update({
      name: parsed.data.name.trim(),
      color: parsed.data.color,
      difficulty: parsed.data.difficulty ?? null,
      description: parsed.data.description?.trim() || null,
    })
    .eq("id", subjectId)
    .eq("user_id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/subjects");
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/onboarding");
  return { success: "Subject updated" };
}

export async function deleteSubject(subjectId: string): Promise<ActionState> {
  const auth = await requireAuthedClient();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("user_id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  redirect("/subjects");
}
