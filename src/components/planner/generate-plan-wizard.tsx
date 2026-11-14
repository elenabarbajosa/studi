"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  generateStudyPlan,
  savePlannerPreferences,
  saveStudyPlan,
} from "@/actions/ai-planner";
import { Field, FormError } from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Segmented } from "@/components/studi/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlannerPreferencesInput } from "@/lib/planner/schemas";
import type { ProposedSession } from "@/lib/planner/types";
import { PLAN_INTENSITIES, PLANNING_PERIODS } from "@/lib/planner/types";
import {
  WEEKDAY_LABELS,
  WEEKDAYS,
  subjectTone,
  type SubjectColor,
  type Weekday,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Assessment, Subject, Topic } from "@/types/database";

type Step = "goals" | "availability" | "generating" | "review" | "confirm";

type GeneratePlanWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPreferences: PlannerPreferencesInput;
  subjects: Subject[];
  topics: Topic[];
  assessments: Assessment[];
  timeZone: string;
  dailyAiLimit: number;
};

export function GeneratePlanWizard({
  open,
  onOpenChange,
  initialPreferences,
  subjects,
  topics,
  assessments,
  timeZone,
  dailyAiLimit,
}: GeneratePlanWizardProps) {
  const [step, setStep] = useState<Step>("goals");
  const [prefs, setPrefs] = useState<PlannerPreferencesInput>(initialPreferences);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ProposedSession[]>([]);
  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [intensity, setIntensity] = useState(initialPreferences.intensity);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(dailyAiLimit);
  const [conflicts, setConflicts] = useState<{ localId: string; message: string }[]>([]);
  const [isPending, startTransition] = useTransition();

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const reset = () => {
    setStep("goals");
    setPrefs(initialPreferences);
    setError(null);
    setSessionId(null);
    setSessions([]);
    setSummary("");
    setRecommendations([]);
    setWarnings([]);
    setPeriodStart("");
    setPeriodEnd("");
    setIntensity(initialPreferences.intensity);
    setRemaining(null);
    setLimit(dailyAiLimit);
    setConflicts([]);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const selectedCounts = useMemo(() => {
    const selected = sessions.filter((s) => s.selected);
    return {
      count: selected.length,
      minutes: selected.reduce((sum, s) => sum + s.durationMinutes, 0),
    };
  }, [sessions]);

  const runGenerate = () => {
    setError(null);
    setStep("generating");
    startTransition(async () => {
      await savePlannerPreferences(prefs);
      const result = await generateStudyPlan(prefs);
      if (!result.ok) {
        setStep("availability");
        setError(result.error);
        if (result.code === "quota_exhausted" || result.code === "rate_limited") {
          toast.error(result.error);
        }
        return;
      }
      setSessionId(result.sessionId);
      setSessions(result.sessions);
      setSummary(result.summary);
      setRecommendations(result.recommendations);
      setWarnings(result.warnings);
      setPeriodStart(result.periodStart);
      setPeriodEnd(result.periodEnd);
      setIntensity(prefs.intensity);
      setRemaining(result.remaining);
      setLimit(result.limit);
      setConflicts(result.conflicts);
      setStep("review");
    });
  };

  const confirmSave = () => {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await saveStudyPlan({
        sessionId,
        title: "Study plan",
        periodStart,
        periodEnd,
        intensity,
        timezone: timeZone,
        summary,
        recommendations,
        warnings,
        sessions,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.partial) {
        toast.success(`Saved ${result.savedSessions} sessions with some issues`, {
          description: result.errors[0],
        });
      } else {
        toast.success(`Saved ${result.savedSessions} study sessions to your calendar`);
      }
      handleOpenChange(false);
    });
  };

  const title =
    step === "goals"
      ? "Plan goals"
      : step === "availability"
        ? "Availability"
        : step === "generating"
          ? "Building your plan"
          : step === "review"
            ? "Review schedule"
            : "Confirm plan";

  const footer =
    step === "goals" ? (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" onClick={() => setStep("availability")}>
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>
    ) : step === "availability" ? (
      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => setStep("goals")}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" disabled={isPending} onClick={runGenerate}>
          <Sparkles className="size-4" />
          Generate plan
        </Button>
      </div>
    ) : step === "review" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-ink-3">
          {selectedCounts.count} sessions · {Math.round(selectedCounts.minutes / 60)}h{" "}
          {selectedCounts.minutes % 60}m
          {remaining != null ? ` · ${remaining}/${limit} AI left today` : null}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setStep("availability")}>
            Back
          </Button>
          <Button
            type="button"
            disabled={selectedCounts.count === 0}
            onClick={() => setStep("confirm")}
          >
            Continue
          </Button>
        </div>
      </div>
    ) : step === "confirm" ? (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setStep("review")}>
          Back
        </Button>
        <Button type="button" disabled={isPending} onClick={confirmSave}>
          {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save to calendar
        </Button>
      </div>
    ) : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={
        step === "goals"
          ? "Choose the planning horizon and intensity."
          : step === "availability"
            ? "Set when you can study. Defaults come from your Studi preferences."
            : step === "review"
              ? "Edit sessions before anything is saved."
              : undefined
      }
      footer={footer}
      className="md:w-[min(760px,calc(100vw-48px))] md:max-h-[min(92svh,900px)]"
    >
      {step === "goals" ? (
        <div className="space-y-4">
          <Field label="Planning period">
            <Segmented
              label="Planning period"
              value={prefs.planning_period}
              onChange={(value) => setPrefs((p) => ({ ...p, planning_period: value }))}
              stretch
              options={PLANNING_PERIODS.map((value) => ({
                value,
                label:
                  value === "until_exam"
                    ? "Until exam"
                    : `${value} days`,
              }))}
            />
          </Field>
          {prefs.planning_period === "until_exam" ? (
            <Field label="Target exam">
              <select
                className="h-10 w-full rounded-[12px] bg-sunken px-3 text-[14px]"
                value={prefs.until_assessment_id ?? ""}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    until_assessment_id: e.target.value || null,
                  }))
                }
              >
                <option value="">Select an exam</option>
                {assessments
                  .filter((a) => !a.completed)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
          <Field label="Intensity">
            <Segmented
              label="Intensity"
              value={prefs.intensity}
              onChange={(value) => setPrefs((p) => ({ ...p, intensity: value }))}
              stretch
              options={PLAN_INTENSITIES.map((value) => ({
                value,
                label: value[0]!.toUpperCase() + value.slice(1),
              }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Max hours / day">
              <Input
                type="number"
                min={0.5}
                max={12}
                step={0.5}
                value={prefs.max_hours_per_day}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    max_hours_per_day: Number(e.target.value) || 1,
                  }))
                }
              />
            </Field>
            <Field label="Session length (min)">
              <Input
                type="number"
                min={15}
                max={180}
                value={prefs.preferred_session_minutes}
                onChange={(e) =>
                  setPrefs((p) => ({
                    ...p,
                    preferred_session_minutes: Number(e.target.value) || 50,
                  }))
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
            <input
              type="checkbox"
              checked={prefs.include_revision}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, include_revision: e.target.checked }))
              }
            />
            Include revision sessions before exams
          </label>
          <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
            <input
              type="checkbox"
              checked={prefs.include_incomplete_tasks}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  include_incomplete_tasks: e.target.checked,
                }))
              }
            />
            Factor in incomplete tasks
          </label>
          <Field label="Subjects to include">
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const selected =
                  !prefs.included_subject_ids ||
                  prefs.included_subject_ids.length === 0 ||
                  prefs.included_subject_ids.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() =>
                      setPrefs((p) => {
                        const current = p.included_subject_ids ?? subjects.map((s) => s.id);
                        const next = current.includes(subject.id)
                          ? current.filter((id) => id !== subject.id)
                          : [...current, subject.id];
                        return {
                          ...p,
                          included_subject_ids:
                            next.length === subjects.length ? null : next,
                        };
                      })
                    }
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
                      selected ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent" : "bg-sunken text-ink-2",
                    )}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      ) : null}

      {step === "availability" ? (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-2">
            Toggle study days and keep default daytime windows. Rest days stay empty.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKDAYS.map((day) => {
              const on = prefs.weekday_availability[day] && !prefs.rest_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setPrefs((p) => {
                      const available = !(p.weekday_availability[day] && !p.rest_days.includes(day));
                      return {
                        ...p,
                        weekday_availability: {
                          ...p.weekday_availability,
                          [day]: available,
                        },
                        rest_days: available
                          ? p.rest_days.filter((d) => d !== day)
                          : [...new Set([...p.rest_days, day])],
                        time_windows: {
                          ...p.time_windows,
                          [day]: available
                            ? p.time_windows[day].length
                              ? p.time_windows[day]
                              : [
                                  { start: "09:00", end: "12:00" },
                                  { start: "14:00", end: "18:00" },
                                ]
                            : [],
                        },
                      };
                    })
                  }
                  className={cn(
                    "rounded-[14px] px-3 py-3 text-left text-[13px] font-semibold",
                    on ? "bg-accent-soft text-accent-text" : "bg-sunken text-ink-3",
                  )}
                >
                  {WEEKDAY_LABELS[day as Weekday]}
                  <span className="mt-1 block text-[11px] font-medium opacity-80">
                    {on ? "Available" : "Rest"}
                  </span>
                </button>
              );
            })}
          </div>
          <Field label="Break between sessions (min)">
            <Input
              type="number"
              min={0}
              max={60}
              value={prefs.break_minutes}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  break_minutes: Number(e.target.value) || 0,
                }))
              }
            />
          </Field>
          {error ? <FormError message={error} /> : null}
          <p className="text-[12.5px] text-ink-3">
            Limit: {limit} AI plan generations per day. Documents are not uploaded for this
            feature.
          </p>
        </div>
      ) : null}

      {step === "generating" ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <LoaderCircle className="size-8 animate-spin text-accent-text" />
          <p className="text-[15px] font-medium text-ink">Balancing exams, topics and free time…</p>
          <p className="max-w-sm text-[13.5px] text-ink-2">
            Gemini prioritizes subjects; Studi schedules sessions without overlapping your calendar.
          </p>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-4">
          {summary ? (
            <p className="rounded-[14px] bg-accent-soft px-3.5 py-3 text-[13.5px] text-accent-text">
              {summary}
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <div className="rounded-[14px] bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-3.5" />
                Notes
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {conflicts.length > 0 ? (
            <div className="rounded-[14px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
              {conflicts.length} conflict warning{conflicts.length === 1 ? "" : "s"} — adjust times before saving.
            </div>
          ) : null}
          <ul className="space-y-2">
            {sessions.map((session) => {
              const subject = subjectMap.get(session.subjectId);
              const topic = topics.find((t) => t.id === session.topicId);
              const conflict = conflicts.find((c) => c.localId === session.localId);
              return (
                <li
                  key={session.localId}
                  className="rounded-[14px] border border-hairline bg-canvas px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={session.selected}
                      disabled={session.locked}
                      onChange={(e) =>
                        setSessions((list) =>
                          list.map((s) =>
                            s.localId === session.localId
                              ? { ...s, selected: e.target.checked }
                              : s,
                          ),
                        )
                      }
                      className="mt-2"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <SubjectDot color={subject?.color} />
                        <span className="text-[14px] font-semibold text-ink">
                          {subject?.name ?? "Subject"}
                        </span>
                        {session.kind === "revision" ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
                            Revision
                          </span>
                        ) : null}
                        {session.locked ? (
                          <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                            Locked
                          </span>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Input
                          type="date"
                          value={session.date}
                          disabled={session.locked}
                          onChange={(e) =>
                            setSessions((list) =>
                              list.map((s) =>
                                s.localId === session.localId
                                  ? { ...s, date: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                        <Input
                          type="time"
                          value={session.startTime}
                          disabled={session.locked}
                          onChange={(e) =>
                            setSessions((list) =>
                              list.map((s) =>
                                s.localId === session.localId
                                  ? { ...s, startTime: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                        <Input
                          type="time"
                          value={session.endTime}
                          disabled={session.locked}
                          onChange={(e) =>
                            setSessions((list) =>
                              list.map((s) =>
                                s.localId === session.localId
                                  ? { ...s, endTime: e.target.value }
                                  : s,
                              ),
                            )
                          }
                        />
                        <select
                          className="h-10 rounded-[12px] bg-sunken px-3 text-[13px]"
                          value={session.subjectId}
                          disabled={session.locked}
                          onChange={(e) =>
                            setSessions((list) =>
                              list.map((s) =>
                                s.localId === session.localId
                                  ? { ...s, subjectId: e.target.value, topicId: null }
                                  : s,
                              ),
                            )
                          }
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[12.5px] text-ink-2">
                        {topic ? topic.title : "No topic"} · {session.durationMinutes} min
                        {session.goal ? ` · ${session.goal}` : ""}
                      </p>
                      {conflict ? (
                        <p className="text-[12.5px] text-danger">{conflict.message}</p>
                      ) : null}
                    </div>
                    {!session.locked ? (
                      <button
                        type="button"
                        className="mt-1 rounded-full p-2 text-ink-3 hover:bg-sunken hover:text-ink"
                        onClick={() =>
                          setSessions((list) =>
                            list.filter((s) => s.localId !== session.localId),
                          )
                        }
                        aria-label="Remove session"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="space-y-3 py-2">
          <p className="text-[15px] text-ink">
            Save{" "}
            <span className="font-semibold tabular-nums">{selectedCounts.count}</span> sessions (
            <span className="font-semibold tabular-nums">
              {Math.round(selectedCounts.minutes / 60)}h {selectedCounts.minutes % 60}m
            </span>
            ) to your Calendar for {periodStart} → {periodEnd}?
          </p>
          <ul className="space-y-1 text-[13.5px] text-ink-2">
            <li>Existing calendar events are not overwritten.</li>
            <li>Sessions are created as planned study blocks.</li>
            <li>You can start Focus from any planned session.</li>
          </ul>
        </div>
      ) : null}
    </ResponsiveDialog>
  );
}

function SubjectDot({ color }: { color?: SubjectColor }) {
  const tone = color ? subjectTone(color) : null;
  return (
    <span
      className="size-2.5 rounded-full"
      style={{ background: tone?.dot ?? "#9C9094" }}
      aria-hidden
    />
  );
}
