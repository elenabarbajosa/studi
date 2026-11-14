import "server-only";

import { cache } from "react";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SubjectGradeBundle } from "@/lib/grades/convert";
import type {
  GradeComponent,
  GradeGroup,
  SubjectGradeScheme,
} from "@/types/database";

export const getGradeBundleForSubject = cache(
  async (subjectId: string): Promise<SubjectGradeBundle | null> => {
    const user = await getSessionUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data: scheme, error } = await supabase
      .from("subject_grade_schemes")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("getGradeBundleForSubject:", error.message);
      return null;
    }
    if (!scheme) return null;

    const [{ data: groups }, { data: components }] = await Promise.all([
      supabase
        .from("grade_groups")
        .select("*")
        .eq("scheme_id", scheme.id)
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("grade_components")
        .select("*")
        .eq("scheme_id", scheme.id)
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
    ]);

    return {
      scheme: scheme as SubjectGradeScheme,
      groups: (groups ?? []) as GradeGroup[],
      components: (components ?? []) as GradeComponent[],
    };
  },
);

export const listGradeBundlesForUser = cache(
  async (): Promise<SubjectGradeBundle[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data: schemes, error } = await supabase
      .from("subject_grade_schemes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("listGradeBundlesForUser:", error.message);
      return [];
    }
    if (!schemes?.length) return [];

    const schemeIds = schemes.map((s) => s.id);
    const [{ data: groups }, { data: components }] = await Promise.all([
      supabase
        .from("grade_groups")
        .select("*")
        .in("scheme_id", schemeIds)
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("grade_components")
        .select("*")
        .in("scheme_id", schemeIds)
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true }),
    ]);

    const groupsByScheme = new Map<string, GradeGroup[]>();
    for (const g of (groups ?? []) as GradeGroup[]) {
      const list = groupsByScheme.get(g.scheme_id) ?? [];
      list.push(g);
      groupsByScheme.set(g.scheme_id, list);
    }
    const componentsByScheme = new Map<string, GradeComponent[]>();
    for (const c of (components ?? []) as GradeComponent[]) {
      const list = componentsByScheme.get(c.scheme_id) ?? [];
      list.push(c);
      componentsByScheme.set(c.scheme_id, list);
    }

    return (schemes as SubjectGradeScheme[]).map((scheme) => ({
      scheme,
      groups: groupsByScheme.get(scheme.id) ?? [],
      components: componentsByScheme.get(scheme.id) ?? [],
    }));
  },
);
