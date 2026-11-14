import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { Material, Subject, Topic } from "@/types/database";

export const listSubjects = cache(async (): Promise<Subject[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listSubjects:", error.message);
    return [];
  }

  return data ?? [];
});

export const getSubject = cache(async (id: string): Promise<Subject | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getSubject:", error.message);
    return null;
  }

  return data;
});

export const listTopicsForSubject = cache(
  async (subjectId: string): Promise<Topic[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("topics")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("listTopicsForSubject:", error.message);
      return [];
    }

    return data ?? [];
  },
);

export const listAllTopics = cache(async (): Promise<Topic[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listAllTopics:", error.message);
    return [];
  }

  return data ?? [];
});

export const listMaterialsForSubject = cache(
  async (subjectId: string): Promise<Material[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("listMaterialsForSubject:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      ...row,
      url: row.url ?? null,
      storage_path: row.storage_path ?? null,
      storage_bucket: row.storage_bucket ?? null,
      original_filename: row.original_filename ?? null,
      mime_type: row.mime_type ?? null,
      byte_size: row.byte_size ?? null,
      source: row.source ?? "manual",
      source_fingerprint: row.source_fingerprint ?? null,
      canvas_module_path: row.canvas_module_path ?? null,
    }));
  },
);

export const getStudyPreferences = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getStudyPreferences:", error.message);
    return null;
  }

  return data;
});
