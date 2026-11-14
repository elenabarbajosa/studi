import type { GradeSchemeInput } from "@/lib/grades/types";
import type {
  GradeComponent,
  GradeGroup,
  SubjectGradeScheme,
} from "@/types/database";

export type SubjectGradeBundle = {
  scheme: SubjectGradeScheme;
  groups: GradeGroup[];
  components: GradeComponent[];
};

export function toGradeSchemeInput(bundle: SubjectGradeBundle): GradeSchemeInput {
  return {
    displayScaleMax: Number(bundle.scheme.display_scale_max),
    passingOverall:
      bundle.scheme.passing_overall == null
        ? null
        : Number(bundle.scheme.passing_overall),
    passingFinalMin:
      bundle.scheme.passing_final_min == null
        ? null
        : Number(bundle.scheme.passing_final_min),
    groups: bundle.groups.map((g) => ({
      id: g.id,
      title: g.title,
      weightPercent: Number(g.weight_percent),
      sortOrder: g.sort_order,
    })),
    components: bundle.components.map((c) => ({
      id: c.id,
      title: c.title,
      componentType: c.component_type,
      weightPercent: Number(c.weight_percent),
      maxScore: Number(c.max_score),
      score: c.score == null ? null : Number(c.score),
      minScore: c.min_score == null ? null : Number(c.min_score),
      groupId: c.group_id,
      weightWithinGroup:
        c.weight_within_group == null ? null : Number(c.weight_within_group),
      sortOrder: c.sort_order,
      assessmentId: c.assessment_id,
      dueAt: c.due_at,
    })),
  };
}

export function formatGradeDisplay(
  normalizedOrScore: number,
  opts?: { decimals?: number; suffix?: string },
) {
  const decimals = opts?.decimals ?? 1;
  const n = Number.isFinite(normalizedOrScore) ? normalizedOrScore : 0;
  const text = n.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${text}${opts?.suffix ?? ""}`;
}
