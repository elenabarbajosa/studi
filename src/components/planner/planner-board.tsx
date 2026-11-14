"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Lock,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  adjustStudyPlan,
  saveStudyPlan,
  togglePlanSessionLock,
} from "@/actions/ai-planner";
import { GeneratePlanWizard } from "@/components/planner/generate-plan-wizard";
import { PageTitle, primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { Button } from "@/components/ui/button";
import { daysUntil } from "@/lib/dashboard";
import type { PlannerPreferencesInput } from "@/lib/planner/schemas";
import type { ProposedSession } from "@/lib/planner/types";
import { addLocalDays, localDateKey, startOfLocalWeekKey } from "@/lib/progress/timezone";
import { subjectTone, WEEKDAY_LABELS, type Weekday } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type {
  Assessment,
  Subject,
  StudyPlan,
  StudySession,
  Task,
  Topic,
} from "@/types/database";

type PlannerBoardProps = {
  timeZone: string;
  preferences: PlannerPreferencesInput;
  subjects: Subject[];
  topics: Topic[];
  assessments: Assessment[];
  tasks: Task[];
  activePlan: StudyPlan | null;
  planSessions: {
    link: { id: string; study_session_id: string; locked: boolean; user_edited: boolean };
    session: StudySession;
  }[];
  plannedMinutesThisWeek: number;
  completedFocusMinutesThisWeek: number;
  recommendations: string[];
  dailyAiLimit: number;
};

export function PlannerBoard({
  timeZone,
  preferences,
  subjects,
  topics,
  assessments,
  tasks,
  activePlan,
  planSessions,
  plannedMinutesThisWeek,
  completedFocusMinutesThisWeek,
  recommendations,
  dailyAiLimit,
}: PlannerBoardProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSessions, setAdjustSessions] = useState<ProposedSession[] | null>(null);
  const [adjustMeta, setAdjustMeta] = useState<{
    sessionId: string;
    periodStart: string;
    periodEnd: string;
    summary: string;
    recommendations: string[];
    warnings: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const now = new Date();
  const todayKey = localDateKey(now, timeZone);
  const weekStart = startOfLocalWeekKey(todayKey, timeZone);
  const weekDays = Array.from({ length: 7 }, (_, i) => addLocalDays(weekStart, i));

  const upcomingExams = assessments
    .filter((a) => !a.completed && daysUntil(a.starts_at, now) >= 0)
    .slice(0, 5);

  const todaySession = planSessions
    .filter((p) => localDateKey(p.session.starts_at, timeZone) === todayKey)
    .sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at))[0];

  const missed = planSessions.filter((p) => {
    if (p.session.status !== "planned") return false;
    return new Date(p.session.ends_at ?? p.session.starts_at).getTime() < now.getTime();
  });

  const workload = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of planSessions) {
      if (!item.session.subject_id) continue;
      map.set(
        item.session.subject_id,
        (map.get(item.session.subject_id) ?? 0) +
          (item.session.planned_duration_minutes ?? 0),
      );
    }
    return [...map.entries()]
      .map(([id, minutes]) => ({ subject: subjectMap.get(id), minutes }))
      .filter((x) => x.subject)
      .sort((a, b) => b.minutes - a.minutes);
  }, [planSessions, subjectMap]);

  const runAdjust = () => {
    if (!activePlan) return;
    startTransition(async () => {
      const result = await adjustStudyPlan({
        planId: activePlan.id,
        preserveLocked: true,
        reason: missed.length > 0 ? "missed_sessions" : "manual",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAdjustSessions(result.sessions);
      setAdjustMeta({
        sessionId: result.sessionId,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        summary: result.summary,
        recommendations: result.recommendations,
        warnings: result.warnings,
      });
      setAdjustOpen(true);
    });
  };

  const confirmAdjust = () => {
    if (!adjustMeta || !adjustSessions) return;
    startTransition(async () => {
      const result = await saveStudyPlan({
        sessionId: adjustMeta.sessionId,
        title: "Updated study plan",
        periodStart: adjustMeta.periodStart,
        periodEnd: adjustMeta.periodEnd,
        intensity: preferences.intensity,
        timezone: timeZone,
        summary: adjustMeta.summary,
        recommendations: adjustMeta.recommendations,
        warnings: adjustMeta.warnings,
        sessions: adjustSessions.filter((s) => s.selected && !s.locked),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Updated plan with ${result.savedSessions} new sessions`);
      setAdjustOpen(false);
      setAdjustSessions(null);
      setAdjustMeta(null);
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageTitle
        title="Study Planner"
        subtitle="Personalized schedules from your subjects, exams and availability."
        actions={
          <div className="flex flex-wrap gap-2">
            {activePlan ? (
              <button
                type="button"
                className={softPillClass}
                disabled={isPending}
                onClick={runAdjust}
              >
                <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
                Adjust my plan
              </button>
            ) : null}
            <button
              type="button"
              className={primaryPillClass}
              onClick={() => setWizardOpen(true)}
            >
              <Sparkles className="size-4" />
              Generate study plan
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="rounded-[24px] bg-raised p-4 shadow-[0_0_0_1px_var(--hairline)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">This week</h2>
            <p className="text-[12.5px] text-ink-3 tabular-nums">
              Planned {formatHours(plannedMinutesThisWeek)} · Done{" "}
              {formatHours(completedFocusMinutesThisWeek)}
            </p>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day) => {
              const items = planSessions.filter(
                (p) => localDateKey(p.session.starts_at, timeZone) === day,
              );
              const isToday = day === todayKey;
              return (
                <div
                  key={day}
                  className={cn(
                    "min-h-[110px] rounded-[14px] bg-sunken/70 p-1.5",
                    isToday && "ring-2 ring-accent",
                  )}
                >
                  <p className="px-1 text-[11px] font-semibold text-ink-3">
                    {WEEKDAY_LABELS[
                      (["mon", "tue", "wed", "thu", "fri", "sat", "sun"][
                        weekDays.indexOf(day)
                      ] ?? "mon") as Weekday
                    ]}{" "}
                    <span className="tabular-nums">{day.slice(8)}</span>
                  </p>
                  <ul className="mt-1 space-y-1">
                    {items.slice(0, 3).map((item) => {
                      const subject = item.session.subject_id
                        ? subjectMap.get(item.session.subject_id)
                        : null;
                      const tone = subject ? subjectTone(subject.color) : null;
                      return (
                        <li
                          key={item.session.id}
                          className="rounded-[8px] px-1.5 py-1 text-[10px] font-semibold leading-tight text-ink"
                          style={
                            tone
                              ? {
                                  background: tone.tint,
                                  color: tone.text,
                                }
                              : undefined
                          }
                          title={subject?.name}
                        >
                          {subject?.name?.slice(0, 8) ?? "Study"}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {activePlan ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-ink">{activePlan.title}</h3>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success">
                  Active
                </span>
              </div>
              {activePlan.summary ? (
                <p className="text-[13.5px] text-ink-2">{activePlan.summary}</p>
              ) : null}
              <ul className="divide-y divide-hairline">
                {planSessions
                  .slice()
                  .sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at))
                  .slice(0, 8)
                  .map((item) => {
                    const subject = item.session.subject_id
                      ? subjectMap.get(item.session.subject_id)
                      : null;
                    const topic = topics.find((t) => t.id === item.session.topic_id);
                    const start = new Date(item.session.starts_at);
                    return (
                      <li
                        key={item.session.id}
                        className="flex flex-wrap items-center gap-2 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-ink">
                            {subject?.name ?? "Study"}
                            {topic ? (
                              <span className="font-normal text-ink-2"> · {topic.title}</span>
                            ) : null}
                          </p>
                          <p className="text-[12.5px] text-ink-3">
                            {localDateKey(item.session.starts_at, timeZone)} ·{" "}
                            {start.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {item.session.planned_duration_minutes ?? "?"} min
                            {item.link.locked ? " · locked" : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={softPillClass}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await togglePlanSessionLock(
                                item.link.id,
                                !item.link.locked,
                              );
                              if ("error" in result && result.error) toast.error(result.error);
                            })
                          }
                        >
                          <Lock className="size-3.5" />
                          {item.link.locked ? "Unlock" : "Lock"}
                        </button>
                        {item.session.subject_id ? (
                          <Link
                            href={`/focus?subject=${item.session.subject_id}${
                              item.session.topic_id ? `&topic=${item.session.topic_id}` : ""
                            }`}
                            className={primaryPillClass}
                          >
                            <Play className="size-3.5" />
                            Focus
                          </Link>
                        ) : null}
                        <Link href="/calendar" className={softPillClass}>
                          <CalendarDays className="size-3.5" />
                          Calendar
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : (
            <div className="mt-6 rounded-[18px] bg-sunken px-4 py-6 text-center">
              <p className="text-[15px] font-semibold text-ink">No active plan yet</p>
              <p className="mt-1 text-[13.5px] text-ink-2">
                Generate a plan from your real subjects, exams and free time.
              </p>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-[24px] bg-raised p-4 shadow-[0_0_0_1px_var(--hairline)]">
            <h2 className="text-[15px] font-semibold text-ink">Today</h2>
            {todaySession ? (
              <div className="mt-3 space-y-2">
                <p className="text-[14px] text-ink">
                  {subjectMap.get(todaySession.session.subject_id ?? "")?.name ?? "Study session"}
                </p>
                <p className="text-[12.5px] text-ink-2">
                  {todaySession.session.planned_duration_minutes ?? 50} min planned
                </p>
                {todaySession.session.subject_id ? (
                  <Link
                    href={`/focus?subject=${todaySession.session.subject_id}${
                      todaySession.session.topic_id
                        ? `&topic=${todaySession.session.topic_id}`
                        : ""
                    }`}
                    className={cn(primaryPillClass, "w-full justify-center")}
                  >
                    <Play className="size-4" />
                    Start Focus
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[13.5px] text-ink-2">Nothing scheduled for today.</p>
            )}
          </section>

          <section className="rounded-[24px] bg-raised p-4 shadow-[0_0_0_1px_var(--hairline)]">
            <h2 className="text-[15px] font-semibold text-ink">Upcoming exams</h2>
            <ul className="mt-3 space-y-2">
              {upcomingExams.length === 0 ? (
                <li className="text-[13.5px] text-ink-3">No upcoming exams.</li>
              ) : (
                upcomingExams.map((exam) => (
                  <li key={exam.id} className="text-[13.5px] text-ink">
                    <span className="font-semibold">{exam.title}</span>
                    <span className="text-ink-3">
                      {" "}
                      · {daysUntil(exam.starts_at, now)}d
                      {exam.subject_id
                        ? ` · ${subjectMap.get(exam.subject_id)?.name ?? ""}`
                        : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-[24px] bg-raised p-4 shadow-[0_0_0_1px_var(--hairline)]">
            <h2 className="text-[15px] font-semibold text-ink">Subject workload</h2>
            <ul className="mt-3 space-y-2">
              {workload.length === 0 ? (
                <li className="text-[13.5px] text-ink-3">No planned hours yet.</li>
              ) : (
                workload.map((row) => (
                  <li key={row.subject!.id} className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-medium text-ink">{row.subject!.name}</span>
                    <span className="text-[12.5px] tabular-nums text-ink-3">
                      {formatHours(row.minutes)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-[24px] bg-raised p-4 shadow-[0_0_0_1px_var(--hairline)]">
            <h2 className="text-[15px] font-semibold text-ink">AI recommendations</h2>
            <ul className="mt-3 space-y-2">
              {(activePlan
                ? Array.isArray(activePlan.recommendations)
                  ? (activePlan.recommendations as string[])
                  : recommendations
                : recommendations
              )
                .slice(0, 5)
                .map((line) => (
                  <li key={line} className="text-[13px] text-ink-2">
                    {line}
                  </li>
                ))}
              {missed.length > 0 ? (
                <li className="flex items-start gap-1.5 text-[13px] text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {missed.length} planned session{missed.length === 1 ? "" : "s"} passed unfinished.
                </li>
              ) : null}
              {tasks.filter((t) => t.status === "todo").length > 0 ? (
                <li className="text-[13px] text-ink-2">
                  {tasks.filter((t) => t.status === "todo").length} open tasks can influence the next plan.
                </li>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>

      <GeneratePlanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initialPreferences={preferences}
        subjects={subjects}
        topics={topics}
        assessments={assessments}
        timeZone={timeZone}
        dailyAiLimit={dailyAiLimit}
      />

      {adjustOpen && adjustSessions && adjustMeta ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(36,28,31,0.32)] p-4 md:items-center">
          <div className="max-h-[85svh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-raised p-5 shadow-pop">
            <h2 className="type-section text-ink">Adjust plan</h2>
            <p className="mt-2 text-[13.5px] text-ink-2">{adjustMeta.summary}</p>
            <p className="mt-2 text-[12.5px] text-ink-3">
              Locked sessions stay. New selected sessions will be saved as a fresh active plan.
            </p>
            <ul className="mt-4 max-h-60 space-y-2 overflow-y-auto">
              {adjustSessions.map((s) => (
                <li key={s.localId} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    disabled={s.locked}
                    onChange={(e) =>
                      setAdjustSessions((list) =>
                        (list ?? []).map((x) =>
                          x.localId === s.localId ? { ...x, selected: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <span className="text-ink">
                    {s.date} {s.startTime} · {subjectMap.get(s.subjectId)?.name ?? "Subject"}
                    {s.locked ? " (locked)" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdjustOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={isPending} onClick={confirmAdjust}>
                Confirm new sessions
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
