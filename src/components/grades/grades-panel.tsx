"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Calculator,
  Lock,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteGradeScheme,
  saveGradeScheme,
  updateGradeComponentScore,
} from "@/actions/grades";
import { Field, FormError, NativeSelect, PrimaryActions } from "@/components/studi/form-controls";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGradeDisplay } from "@/lib/grades/convert";
import { gradeInsightLines } from "@/lib/grades/insights";
import {
  requiredScoreForTarget,
  roundToDecimals,
  summarizeGrades,
  totalConfiguredWeight,
} from "@/lib/grades/math";
import {
  GRADE_COMPONENT_TYPE_META,
  GRADE_COMPONENT_TYPES,
  type GradeComponentType,
  type GradeScenarioScores,
} from "@/lib/grades/types";
import { cn } from "@/lib/utils";
import type {
  Assessment,
  GradeComponent,
  GradeGroup,
  Subject,
  SubjectGradeScheme,
} from "@/types/database";

type DraftGroup = {
  id?: string;
  clientKey: string;
  title: string;
  weightPercent: number;
  sortOrder: number;
};

type DraftComponent = {
  id?: string;
  clientKey: string;
  title: string;
  componentType: GradeComponentType;
  weightPercent: number;
  weightWithinGroup: number | null;
  maxScore: number;
  score: number | null;
  minScore: number | null;
  groupClientKey: string | null;
  sortOrder: number;
  assessmentId: string | null;
  dueAt: string | null;
};

function newKey() {
  return `k_${Math.random().toString(36).slice(2, 10)}`;
}

function bundleToDrafts(
  scheme: SubjectGradeScheme | null,
  groups: GradeGroup[],
  components: GradeComponent[],
) {
  const draftGroups: DraftGroup[] = groups.map((g, i) => ({
    id: g.id,
    clientKey: g.id,
    title: g.title,
    weightPercent: Number(g.weight_percent),
    sortOrder: g.sort_order ?? i,
  }));
  const draftComponents: DraftComponent[] = components.map((c, i) => ({
    id: c.id,
    clientKey: c.id,
    title: c.title,
    componentType: c.component_type,
    weightPercent: Number(c.weight_percent),
    weightWithinGroup:
      c.weight_within_group == null ? null : Number(c.weight_within_group),
    maxScore: Number(c.max_score),
    score: c.score == null ? null : Number(c.score),
    minScore: c.min_score == null ? null : Number(c.min_score),
    groupClientKey: c.group_id,
    sortOrder: c.sort_order ?? i,
    assessmentId: c.assessment_id,
    dueAt: c.due_at,
  }));
  return {
    displayScaleMax: scheme ? Number(scheme.display_scale_max) : 100,
    passingOverall: scheme?.passing_overall == null ? null : Number(scheme.passing_overall),
    passingFinalMin:
      scheme?.passing_final_min == null ? null : Number(scheme.passing_final_min),
    groups: draftGroups,
    components: draftComponents,
  };
}

type GradesPanelProps = {
  subject: Subject;
  assessments: Assessment[];
  scheme: SubjectGradeScheme | null;
  groups: GradeGroup[];
  components: GradeComponent[];
};

export function GradesPanel({
  subject,
  assessments,
  scheme,
  groups,
  components,
}: GradesPanelProps) {
  const initial = useMemo(
    () => bundleToDrafts(scheme, groups, components),
    [scheme, groups, components],
  );
  const [displayScaleMax, setDisplayScaleMax] = useState(initial.displayScaleMax);
  const [passingOverall, setPassingOverall] = useState<number | null>(
    initial.passingOverall,
  );
  const [passingFinalMin, setPassingFinalMin] = useState<number | null>(
    initial.passingFinalMin,
  );
  const [draftGroups] = useState(initial.groups);
  const [draftComponents, setDraftComponents] = useState(initial.components);
  const [mode, setMode] = useState<"overview" | "edit" | "whatif" | "need">("overview");
  const [scenario, setScenario] = useState<GradeScenarioScores>({});
  const [needTarget, setNeedTarget] = useState(50);
  const [needFocusId, setNeedFocusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mathScheme = useMemo(() => {
    const groupIdByKey = new Map(draftGroups.map((g) => [g.clientKey, g.clientKey]));
    return {
      displayScaleMax,
      passingOverall,
      passingFinalMin,
      groups: draftGroups.map((g) => ({
        id: g.clientKey,
        title: g.title,
        weightPercent: g.weightPercent,
        sortOrder: g.sortOrder,
      })),
      components: draftComponents.map((c) => ({
        id: c.clientKey,
        title: c.title,
        componentType: c.componentType,
        weightPercent: c.groupClientKey ? 0 : c.weightPercent,
        maxScore: c.maxScore,
        score: c.score,
        minScore: c.minScore,
        groupId: c.groupClientKey && groupIdByKey.has(c.groupClientKey)
          ? c.groupClientKey
          : null,
        weightWithinGroup: c.groupClientKey ? (c.weightWithinGroup ?? 0) : null,
        sortOrder: c.sortOrder,
        assessmentId: c.assessmentId,
        dueAt: c.dueAt,
      })),
    };
  }, [displayScaleMax, passingOverall, passingFinalMin, draftGroups, draftComponents]);

  const actualSummary = useMemo(() => summarizeGrades(mathScheme), [mathScheme]);
  const whatIfSummary = useMemo(
    () => summarizeGrades(mathScheme, scenario),
    [mathScheme, scenario],
  );
  const weightTotal = totalConfiguredWeight(mathScheme);
  const insights = gradeInsightLines(actualSummary);

  const pendingIds = useMemo(
    () =>
      actualSummary.contributions
        .filter((c) => c.actualScore == null && c.effectiveWeight > 0)
        .map((c) => c.id),
    [actualSummary],
  );

  const focusId = needFocusId ?? pendingIds[0] ?? null;
  const needResult = useMemo(() => {
    const id = needFocusId ?? pendingIds[0] ?? null;
    if (!id) return null;
    return requiredScoreForTarget(mathScheme, id, needTarget, scenario);
  }, [mathScheme, needFocusId, pendingIds, needTarget, scenario]);

  const addComponent = () => {
    setDraftComponents((prev) => [
      ...prev,
      {
        clientKey: newKey(),
        title: "New assessment",
        componentType: "other",
        weightPercent: 0,
        weightWithinGroup: null,
        maxScore: displayScaleMax,
        score: null,
        minScore: null,
        groupClientKey: null,
        sortOrder: prev.length,
        assessmentId: null,
        dueAt: null,
      },
    ]);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveGradeScheme({
        subjectId: subject.id,
        displayScaleMax,
        passingOverall,
        passingFinalMin,
        groups: draftGroups,
        components: draftComponents.map((c) => ({
          ...c,
          score: c.score,
          minScore: c.minScore,
          weightWithinGroup: c.weightWithinGroup,
          assessmentId: c.assessmentId,
          dueAt: c.dueAt,
          groupClientKey: c.groupClientKey,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.status === "complete"
          ? "Grading scheme saved (complete)."
          : "Grading scheme saved as draft — weights should total 100%.",
      );
      setMode("overview");
    });
  };

  const clearScheme = () => {
    if (!scheme) return;
    if (!confirm("Delete this subject's grading scheme and all recorded grades?")) return;
    startTransition(async () => {
      const result = await deleteGradeScheme(subject.id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Grading scheme removed.");
    });
  };

  const persistScore = (componentId: string | undefined, score: number | null) => {
    if (!componentId) return;
    startTransition(async () => {
      const result = await updateGradeComponentScore({
        subjectId: subject.id,
        componentId,
        score,
      });
      if (!result.ok) toast.error(result.error);
    });
  };

  if (!scheme && draftComponents.length === 0 && mode === "overview") {
    return (
      <section className="flex flex-col gap-4">
        <EmptyPanel
          compact
          icon={Calculator}
          title="Set up grading for this subject"
          body="Configure weights, record scores, and explore what-if scenarios. Calculations stay on-device — no AI."
        />
        <Button type="button" onClick={() => { addComponent(); setMode("edit"); }}>
          <Plus className="size-4" aria-hidden />
          Configure grades
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["edit", "Configure"],
            ["whatif", "What-If"],
            ["need", "What do I need?"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
              mode === id
                ? "bg-accent-soft text-accent-ink"
                : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "overview" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Graded-work average"
              value={
                actualSummary.gradedWorkAverage == null
                  ? "—"
                  : `${formatGradeDisplay(actualSummary.gradedWorkAverage)}%`
              }
              hint="Only completed assessments · not zeros for pending"
            />
            <Metric
              label="Points secured"
              value={formatGradeDisplay(actualSummary.securedPoints)}
              hint={`of ${formatGradeDisplay(actualSummary.totalWeight)} weight points`}
            />
            <Metric
              label="Weight done"
              value={`${formatGradeDisplay(actualSummary.completedWeight)}%`}
              hint={`${formatGradeDisplay(actualSummary.remainingWeight)}% remaining`}
            />
          </div>

          {!actualSummary.schemeComplete ? (
            <p className="rounded-[14px] bg-warning-soft px-3 py-2 text-[13px] font-medium text-warning">
              Draft scheme — weights total {roundToDecimals(weightTotal, 2)}% (need 100%).
            </p>
          ) : null}

          <ul className="overflow-hidden rounded-[18px] border border-hairline">
            {actualSummary.contributions.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-1 border-b border-hairline px-3.5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{c.title}</p>
                  <p className="text-[12px] text-ink-3">
                    {GRADE_COMPONENT_TYPE_META[c.componentType].label} ·{" "}
                    {roundToDecimals(c.effectiveWeight, 1)}% weight
                    {c.actualScore == null ? " · pending" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="h-9 w-24"
                    placeholder="Score"
                    defaultValue={c.actualScore ?? ""}
                    min={0}
                    max={c.maxScore}
                    step="any"
                    onBlur={(e) => {
                      const draft = draftComponents.find((d) => d.clientKey === c.id);
                      const raw = e.target.value.trim();
                      const next = raw === "" ? null : Number(raw);
                      if (next != null && (!Number.isFinite(next) || next < 0 || next > c.maxScore)) {
                        toast.error(`Enter a score between 0 and ${c.maxScore}.`);
                        return;
                      }
                      setDraftComponents((prev) =>
                        prev.map((d) =>
                          d.clientKey === c.id ? { ...d, score: next } : d,
                        ),
                      );
                      persistScore(draft?.id, next);
                    }}
                  />
                  <span className="text-[12px] text-ink-3">/ {c.maxScore}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-[18px] bg-sunken px-4 py-3">
            <h3 className="text-[13px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
              Insights
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13.5px] text-ink-2">
              {insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Scale max" htmlFor="scale-max">
              <Input
                id="scale-max"
                type="number"
                min={1}
                value={displayScaleMax}
                onChange={(e) => setDisplayScaleMax(Number(e.target.value) || 100)}
              />
            </Field>
            <Field label="Pass overall %" htmlFor="pass-overall" optional>
              <Input
                id="pass-overall"
                type="number"
                min={0}
                max={100}
                value={passingOverall ?? ""}
                placeholder="e.g. 50"
                onChange={(e) =>
                  setPassingOverall(e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Final min %" htmlFor="pass-final" optional>
              <Input
                id="pass-final"
                type="number"
                min={0}
                max={100}
                value={passingFinalMin ?? ""}
                placeholder="e.g. 50"
                onChange={(e) =>
                  setPassingFinalMin(e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </Field>
          </div>

          <p className="text-[13px] text-ink-2">
            Weights total{" "}
            <span className="font-semibold text-ink">{roundToDecimals(weightTotal, 2)}%</span>
            {Math.abs(weightTotal - 100) <= 0.05
              ? " · complete"
              : " · draft until 100%"}
          </p>

          <div className="flex flex-col gap-3">
            {draftComponents.map((c, index) => (
              <div
                key={c.clientKey}
                className="rounded-[18px] border border-hairline bg-raised p-3.5"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title" htmlFor={`t-${c.clientKey}`}>
                    <Input
                      id={`t-${c.clientKey}`}
                      value={c.title}
                      onChange={(e) =>
                        setDraftComponents((prev) =>
                          prev.map((x) =>
                            x.clientKey === c.clientKey
                              ? { ...x, title: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Type" htmlFor={`type-${c.clientKey}`}>
                    <NativeSelect
                      id={`type-${c.clientKey}`}
                      value={c.componentType}
                      onChange={(e) =>
                        setDraftComponents((prev) =>
                          prev.map((x) =>
                            x.clientKey === c.clientKey
                              ? {
                                  ...x,
                                  componentType: e.target.value as GradeComponentType,
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      {GRADE_COMPONENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {GRADE_COMPONENT_TYPE_META[t].label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Weight %" htmlFor={`w-${c.clientKey}`}>
                    <Input
                      id={`w-${c.clientKey}`}
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={c.weightPercent}
                      onChange={(e) =>
                        setDraftComponents((prev) =>
                          prev.map((x) =>
                            x.clientKey === c.clientKey
                              ? { ...x, weightPercent: Number(e.target.value) || 0 }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Max score" htmlFor={`max-${c.clientKey}`}>
                    <Input
                      id={`max-${c.clientKey}`}
                      type="number"
                      min={0.0001}
                      step="any"
                      value={c.maxScore}
                      onChange={(e) =>
                        setDraftComponents((prev) =>
                          prev.map((x) =>
                            x.clientKey === c.clientKey
                              ? { ...x, maxScore: Number(e.target.value) || 100 }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Score" htmlFor={`score-${c.clientKey}`} optional>
                    <Input
                      id={`score-${c.clientKey}`}
                      type="number"
                      min={0}
                      step="any"
                      value={c.score ?? ""}
                      placeholder="Pending"
                      onChange={(e) =>
                        setDraftComponents((prev) =>
                          prev.map((x) =>
                            x.clientKey === c.clientKey
                              ? {
                                  ...x,
                                  score:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Link exam" htmlFor={`link-${c.clientKey}`} optional>
                    <NativeSelect
                      id={`link-${c.clientKey}`}
                      value={c.assessmentId ?? ""}
                      onChange={(e) =>
                        setDraftComponents((prev) =>
                          prev.map((x) =>
                            x.clientKey === c.clientKey
                              ? {
                                  ...x,
                                  assessmentId: e.target.value || null,
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">None</option>
                      {assessments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <div className="mt-3 flex justify-between">
                  <p className="text-[12px] text-ink-3">#{index + 1}</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-danger"
                    onClick={() =>
                      setDraftComponents((prev) =>
                        prev.filter((x) => x.clientKey !== c.clientKey),
                      )
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addComponent}>
              <Plus className="size-4" aria-hidden />
              Add assessment
            </Button>
            {scheme ? (
              <Button type="button" variant="ghost" onClick={clearScheme} disabled={isPending}>
                Delete scheme
              </Button>
            ) : null}
          </div>

          <FormError message={error ?? undefined} />
          <PrimaryActions>
            <Button type="button" variant="ghost" onClick={() => setMode("overview")}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending || !draftComponents.length} onClick={save}>
              <Save className="size-4" aria-hidden />
              {isPending ? "Saving…" : "Save scheme"}
            </Button>
          </PrimaryActions>
        </div>
      ) : null}

      {mode === "whatif" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Projected overall"
              value={
                whatIfSummary.projectedOverall == null
                  ? "—"
                  : `${formatGradeDisplay(whatIfSummary.projectedOverall)}%`
              }
              hint={
                whatIfSummary.pass?.passes
                  ? "Meets passing rules"
                  : whatIfSummary.pass
                    ? "Does not meet passing rules"
                    : "Set all pending scores"
              }
            />
            <Metric
              label="Possible range"
              value={
                whatIfSummary.possibleRange
                  ? `${formatGradeDisplay(whatIfSummary.possibleRange.min)}–${formatGradeDisplay(whatIfSummary.possibleRange.max)}`
                  : "—"
              }
              hint="Given locked actual grades"
            />
            <Metric
              label="Graded average"
              value={
                actualSummary.gradedWorkAverage == null
                  ? "—"
                  : `${formatGradeDisplay(actualSummary.gradedWorkAverage)}%`
              }
              hint="Unchanged by what-if"
            />
          </div>

          {whatIfSummary.pass?.unmetReasons.length ? (
            <ul className="rounded-[14px] bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {whatIfSummary.pass.unmetReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}

          <ul className="flex flex-col gap-3">
            {whatIfSummary.contributions.map((c) => {
              const locked = c.locked;
              const value =
                scenario[c.id] != null
                  ? Number(scenario[c.id])
                  : (c.actualScore ?? 0);
              return (
                <li
                  key={c.id}
                  className="rounded-[18px] border border-hairline px-3.5 py-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-ink">
                        {c.title}
                        {locked ? (
                          <Lock className="ml-1.5 inline size-3.5 text-ink-3" aria-label="Locked actual" />
                        ) : null}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        {roundToDecimals(c.effectiveWeight, 1)}% · contrib{" "}
                        {c.weightedPoints == null
                          ? "—"
                          : formatGradeDisplay(c.weightedPoints)}
                      </p>
                    </div>
                    <Input
                      type="number"
                      className="h-9 w-24"
                      disabled={locked}
                      min={0}
                      max={c.maxScore}
                      step="any"
                      value={locked ? (c.actualScore ?? "") : value}
                      onChange={(e) => {
                        if (locked) return;
                        const n = Number(e.target.value);
                        setScenario((prev) => ({
                          ...prev,
                          [c.id]: Number.isFinite(n) ? n : 0,
                        }));
                      }}
                    />
                  </div>
                  {!locked ? (
                    <input
                      type="range"
                      className="w-full accent-[var(--accent-ink)]"
                      min={0}
                      max={c.maxScore}
                      step={c.maxScore <= 10 ? 0.1 : 1}
                      value={value}
                      onChange={(e) =>
                        setScenario((prev) => ({
                          ...prev,
                          [c.id]: Number(e.target.value),
                        }))
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setScenario({})}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset scenario
          </Button>
        </div>
      ) : null}

      {mode === "need" ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Target overall %" htmlFor="need-target">
              <Input
                id="need-target"
                type="number"
                min={0}
                max={100}
                value={needTarget}
                onChange={(e) => setNeedTarget(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Solve for" htmlFor="need-focus">
              <NativeSelect
                id="need-focus"
                value={focusId ?? ""}
                onChange={(e) => setNeedFocusId(e.target.value || null)}
              >
                {pendingIds.length === 0 ? (
                  <option value="">No pending assessments</option>
                ) : (
                  pendingIds.map((id) => {
                    const c = actualSummary.contributions.find((x) => x.id === id);
                    return (
                      <option key={id} value={id}>
                        {c?.title ?? id}
                      </option>
                    );
                  })
                )}
              </NativeSelect>
            </Field>
          </div>

          <p className="text-[13px] text-ink-2">
            Set hypothetical scores on other pending assessments below, then read the
            minimum required on the selected one. Actual grades stay locked.
          </p>

          <ul className="flex flex-col gap-3">
            {whatIfSummary.contributions
              .filter((c) => c.actualScore == null && c.id !== focusId)
              .map((c) => (
                <li key={c.id} className="rounded-[18px] border border-hairline px-3.5 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[14px] font-medium text-ink">{c.title}</span>
                    <Input
                      type="number"
                      className="h-9 w-24"
                      min={0}
                      max={c.maxScore}
                      value={scenario[c.id] ?? ""}
                      placeholder="Hyp."
                      onChange={(e) =>
                        setScenario((prev) => ({
                          ...prev,
                          [c.id]:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <input
                    type="range"
                    className="w-full accent-[var(--accent-ink)]"
                    min={0}
                    max={c.maxScore}
                    step={c.maxScore <= 10 ? 0.1 : 1}
                    value={Number(scenario[c.id] ?? 0)}
                    onChange={(e) =>
                      setScenario((prev) => ({
                        ...prev,
                        [c.id]: Number(e.target.value),
                      }))
                    }
                  />
                </li>
              ))}
          </ul>

          <div className="rounded-[18px] bg-sunken px-4 py-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-3 uppercase tracking-[0.04em]">
              <SlidersHorizontal className="size-4" aria-hidden />
              Result
            </p>
            {!needResult ? (
              <p className="mt-2 text-[14px] text-ink-2">Nothing to solve for.</p>
            ) : needResult.status === "required" ? (
              <p className="mt-2 text-[22px] font-semibold text-ink">
                Need {formatGradeDisplay(needResult.required)}
                <span className="text-[14px] font-medium text-ink-2">
                  {" "}
                  on the selected assessment
                </span>
              </p>
            ) : needResult.status === "guaranteed" ? (
              <p className="mt-2 text-[15px] font-medium text-success">
                Already guaranteed (projected {formatGradeDisplay(needResult.projected)}%).
              </p>
            ) : needResult.status === "impossible" ? (
              <p className="mt-2 text-[15px] font-medium text-danger">{needResult.reason}</p>
            ) : (
              <p className="mt-2 text-[15px] text-ink-2">{needResult.reason}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[18px] bg-sunken px-4 py-3">
      <p className="text-[12px] font-semibold tracking-[0.04em] text-ink-3 uppercase">
        {label}
      </p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}
