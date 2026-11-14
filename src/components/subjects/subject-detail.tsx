"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteSubject } from "@/actions/subjects";
import { EventFormDialog, type CalendarDraft } from "@/components/calendar/event-form-dialog";
import { primaryPillClass } from "@/components/studi/page-title";
import { DifficultyBars } from "@/components/studi/progress-bits";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { AssessmentsPanel } from "@/components/subjects/assessments-panel";
import { MaterialsPanel } from "@/components/subjects/materials-panel";
import { SubjectForm } from "@/components/subjects/subject-form";
import { NextExamCard, SubjectProgress, SubjectProgressCard } from "@/components/subjects/subject-progress";
import { SubjectTasksPanel } from "@/components/subjects/subject-tasks-panel";
import { TopicsPanel } from "@/components/subjects/topics-panel";
import { TaskFormDialog, type TaskDraft } from "@/components/tasks/task-form-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toLocalDateInput } from "@/lib/calendar";
import { daysUntil } from "@/lib/dashboard";
import { subjectTone, subjectToneVars, topicProgressSummary } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Assessment, Material, Subject, Subtask, Task, Topic } from "@/types/database";

export const SUBJECT_TABS = ["topics", "materials", "exams", "tasks", "progress"] as const;
export type SubjectTab = (typeof SUBJECT_TABS)[number];

type SubjectDetailProps = {
  subject: Subject;
  subjects: Subject[];
  topics: Topic[];
  materials: Material[];
  assessments: Assessment[];
  tasks: Task[];
  subtasks: Subtask[];
  initialTab: SubjectTab;
};

const tonePillClass =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-raised/85 px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors duration-200 ease-studi hover:bg-raised focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] md:h-9 dark:bg-white/10 dark:hover:bg-white/15 data-popup-open:bg-raised dark:data-popup-open:bg-white/15";

export function SubjectDetail({
  subject,
  subjects,
  topics,
  materials,
  assessments,
  tasks,
  subtasks,
  initialTab,
}: SubjectDetailProps) {
  const [tab, setTab] = useState<SubjectTab>(initialTab);
  const [editOpen, setEditOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<CalendarDraft | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [isPending, startTransition] = useTransition();
  const tabRefs = useRef(new Map<SubjectTab, HTMLButtonElement>());

  const tone = subjectTone(subject.color);
  const summary = topicProgressSummary(topics);
  const openTasks = tasks.filter((t) => t.status === "todo").length;

  const nextExam = useMemo(() => {
    const now = new Date();
    const upcoming = assessments
      .filter((a) => !a.completed && daysUntil(a.starts_at, now) >= 0)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const first = upcoming[0] ?? null;
    return { assessment: first, days: first ? daysUntil(first.starts_at, now) : null };
  }, [assessments]);

  const selectTab = (next: SubjectTab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current.get(next)?.focus();
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  const openEvent = (draft: CalendarDraft) => {
    setEventDraft(draft);
    setEventOpen(true);
  };

  const openTask = (task: Task | null) => {
    setEditingTask(task);
    setTaskDraft(task ? null : { subjectId: subject.id });
    setTaskOpen(true);
  };

  const remove = () => {
    if (!confirm(`Delete “${subject.name}”? Its topics and materials will be removed too.`)) return;
    startTransition(async () => {
      const result = await deleteSubject(subject.id);
      if (result?.error) toast.error(result.error);
    });
  };

  const tabs: { id: SubjectTab; label: string; count?: string }[] = [
    { id: "topics", label: "Topics", count: summary.total ? `${summary.mastered}/${summary.total}` : undefined },
    { id: "materials", label: "Materials", count: materials.length ? String(materials.length) : undefined },
    { id: "exams", label: "Exams", count: assessments.length ? String(assessments.length) : undefined },
    { id: "tasks", label: "Tasks", count: openTasks ? String(openTasks) : undefined },
    { id: "progress", label: "Progress" },
  ];

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    selectTab(tabs[next].id, true);
  };

  return (
    <div className={cn("mx-auto w-full max-w-[1120px]", isPending && "pointer-events-none opacity-70")}>
      <Link
        href="/subjects"
        className="-ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-full pr-3 pl-1.5 text-[13.5px] font-medium text-ink-2 outline-none transition-colors hover:bg-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Subjects
      </Link>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <header
          className="subject-tone flex min-w-0 flex-col rounded-[24px] p-5 md:p-6"
          style={subjectToneVars(subject.color) as React.CSSProperties}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase opacity-80">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: tone.dot }} />
              Subject
            </span>
            <DifficultyBars value={subject.difficulty} color={tone.dot} />
          </div>
          <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.02em] break-words text-ink md:text-[30px]">
            {subject.name}
          </h1>
          {subject.description ? (
            <p className="mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">{subject.description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/focus" className={primaryPillClass}>
              <Play className="size-[15px] fill-current" aria-hidden />
              Focus on this
            </Link>
            <button
              type="button"
              className={tonePillClass}
              onClick={() =>
                openEvent({
                  kind: "study_session",
                  date: toLocalDateInput(new Date().toISOString()),
                  defaultSubjectId: subject.id,
                })
              }
            >
              <CalendarPlus className="size-[15px]" aria-hidden />
              Plan
            </button>
            <button type="button" className={tonePillClass} onClick={() => openTask(null)}>
              <Plus className="size-[15px]" aria-hidden />
              Task
            </button>
            <button type="button" className={tonePillClass} onClick={() => setEditOpen(true)}>
              <Pencil className="size-[14px]" aria-hidden />
              Edit
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(tonePillClass, "w-10 justify-center px-0 md:w-9")}
                aria-label={`More actions for ${subject.name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem variant="destructive" onClick={remove}>
                  <Trash2 aria-hidden />
                  Delete subject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <aside
          aria-label="Subject summary"
          className="grid gap-4 sm:grid-cols-2 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:grid-cols-1"
        >
          <SubjectProgressCard topics={topics} color={subject.color} />
          <NextExamCard
            assessment={nextExam.assessment}
            days={nextExam.days}
            onOpen={
              nextExam.assessment
                ? () =>
                    openEvent({
                      kind: "assessment",
                      date: toLocalDateInput(nextExam.assessment!.starts_at),
                      assessment: nextExam.assessment!,
                    })
                : undefined
            }
          />
        </aside>

        <section className="min-w-0 rounded-[24px] bg-raised shadow-[0_0_0_1px_var(--hairline)] lg:col-start-1">
          <div
            role="tablist"
            aria-label={`${subject.name} sections`}
            className="flex gap-1 overflow-x-auto border-b border-hairline px-3 [scrollbar-width:none] md:px-4 [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((item, index) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    if (node) tabRefs.current.set(item.id, node);
                    else tabRefs.current.delete(item.id);
                  }}
                  type="button"
                  role="tab"
                  id={`subject-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`subject-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(item.id)}
                  onKeyDown={(e) => onTabKey(e, index)}
                  className={cn(
                    "relative inline-flex h-12 shrink-0 items-center gap-1.5 px-2.5 text-[14px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:rounded-[10px] focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]",
                    "after:absolute after:inset-x-2.5 after:bottom-[-1px] after:h-[2px] after:rounded-full after:transition-colors",
                    selected ? "text-ink after:bg-ink dark:after:bg-accent" : "text-ink-2 after:bg-transparent hover:text-ink",
                  )}
                >
                  {item.label}
                  {item.count ? (
                    <span className="text-[12px] font-semibold text-ink-3 tabular-nums">{item.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`subject-panel-${tab}`}
            aria-labelledby={`subject-tab-${tab}`}
            className="p-4 md:p-5"
          >
            {tab === "topics" ? <TopicsPanel subjectId={subject.id} topics={topics} /> : null}
            {tab === "materials" ? (
              <MaterialsPanel subjectId={subject.id} materials={materials} topics={topics} />
            ) : null}
            {tab === "exams" ? (
              <AssessmentsPanel subjectId={subject.id} assessments={assessments} onOpenDraft={openEvent} />
            ) : null}
            {tab === "tasks" ? (
              <SubjectTasksPanel
                subject={subject}
                tasks={tasks}
                subtasks={subtasks}
                onNewTask={() => openTask(null)}
                onEditTask={openTask}
              />
            ) : null}
            {tab === "progress" ? <SubjectProgress topics={topics} /> : null}
          </div>
        </section>
      </div>

      <ResponsiveDialog open={editOpen} onOpenChange={setEditOpen} title="Edit subject">
        {editOpen ? (
          <SubjectForm subject={subject} onCancel={() => setEditOpen(false)} onDone={() => setEditOpen(false)} />
        ) : null}
      </ResponsiveDialog>

      <EventFormDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        draft={eventDraft}
        subjects={subjects}
        topics={topics}
        tasks={tasks.filter((t) => t.status === "todo")}
      />

      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        task={editingTask}
        subjects={subjects}
        topics={topics}
        defaultSubjectId={subject.id}
        draft={taskDraft}
      />
    </div>
  );
}
