"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CircleCheck, ListFilter, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { setTaskStatus } from "@/actions/tasks";
import { NativeSelect } from "@/components/studi/form-controls";
import { PageTitle } from "@/components/studi/page-title";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Segmented } from "@/components/studi/segmented";
import { SubjectChip } from "@/components/studi/subject-chip";
import { QuickAddInput, QuickAddSheet } from "@/components/tasks/quick-add";
import { TaskFormDialog, type TaskDraft } from "@/components/tasks/task-form-dialog";
import { TaskRow } from "@/components/tasks/task-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PRIORITY_LEVELS,
  PRIORITY_META,
  type PriorityLevel,
  type TaskStatus,
} from "@/lib/calendar";
import {
  startOfDay,
  TASK_GROUP_LABEL,
  taskGroup,
  type TaskGroupKey,
} from "@/lib/planning";
import { cn } from "@/lib/utils";
import type { Subject, Subtask, Task, Topic } from "@/types/database";

export type TaskView = "today" | "upcoming" | "all" | "completed";
type SortBy = "due" | "priority";
type PriorityFilter = "" | PriorityLevel;

type TasksBoardProps = {
  tasks: Task[];
  subtasks: Subtask[];
  subjects: Subject[];
  topics: Topic[];
  initialView?: TaskView;
};

const VIEW_OPTIONS: { value: TaskView; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
  { value: "completed", label: "Done" },
];

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const GROUP_ORDER: TaskGroupKey[] = ["overdue", "today", "tomorrow", "week", "later", "none"];

/** How long a just-completed task stays in an open view before it collapses. */
const LINGER_MS = 1200;

function endOfToday() {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() + 1);
  return d.getTime() - 1;
}

function inView(view: TaskView, task: Task, open: boolean) {
  if (view === "completed") return !open;
  if (!open) return false;
  if (view === "all") return true;
  const due = task.due_at ? new Date(task.due_at).getTime() : null;
  if (view === "today") return due !== null && due <= endOfToday();
  return due === null || due > endOfToday();
}

function compareDue(a: Task, b: Task) {
  if (!a.due_at && !b.due_at) return 0;
  if (!a.due_at) return 1;
  if (!b.due_at) return -1;
  return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
}

export function TasksBoard({
  tasks,
  subtasks,
  subjects,
  topics,
  initialView = "today",
}: TasksBoardProps) {
  const [view, setView] = useState<TaskView>(initialView);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("");
  const [sortBy, setSortBy] = useState<SortBy>("due");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [overrides, setOverrides] = useState<ReadonlyMap<string, TaskStatus>>(new Map());
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set());
  const [quickOpen, setQuickOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [, startTransition] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const subtasksByTask = useMemo(() => {
    const map = new Map<string, Subtask[]>();
    for (const s of subtasks) {
      const list = map.get(s.task_id) ?? [];
      list.push(s);
      map.set(s.task_id, list);
    }
    return map;
  }, [subtasks]);

  const statusOf = (task: Task) => overrides.get(task.id) ?? task.status;

  const scoped = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!subjectFilter || t.subject_id === subjectFilter) &&
          (!priorityFilter || t.priority === priorityFilter),
      ),
    [tasks, subjectFilter, priorityFilter],
  );

  const counts = useMemo(() => {
    const out: Record<TaskView, number> = { today: 0, upcoming: 0, all: 0, completed: 0 };
    for (const t of scoped) {
      const open = (overrides.get(t.id) ?? t.status) === "todo";
      for (const v of VIEW_OPTIONS) if (inView(v.value, t, open)) out[v.value] += 1;
    }
    return out;
  }, [scoped, overrides]);

  const visible = useMemo(() => {
    const list = scoped.filter((t) => {
      const open = (overrides.get(t.id) ?? t.status) === "todo";
      if (inView(view, t, open)) return true;
      return view !== "completed" && lingering.has(t.id) && inView(view, t, true);
    });
    if (view === "completed") {
      return list.sort(
        (a, b) =>
          new Date(b.completed_at ?? b.updated_at).getTime() -
          new Date(a.completed_at ?? a.updated_at).getTime(),
      );
    }
    return list.sort((a, b) =>
      sortBy === "priority"
        ? PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority] || compareDue(a, b)
        : compareDue(a, b) || PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority],
    );
  }, [scoped, overrides, lingering, view, sortBy]);

  const groups = useMemo(() => {
    if (view === "completed" || sortBy !== "due") return null;
    const map = new Map<TaskGroupKey, Task[]>();
    for (const t of visible) {
      const key = taskGroup(t.due_at);
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    const ordered = GROUP_ORDER.filter((k) => map.has(k)).map((k) => ({ key: k, tasks: map.get(k)! }));
    return ordered.length > 1 ? ordered : null;
  }, [visible, view, sortBy]);

  const changeView = (next: TaskView) => {
    setView(next);
    setLingering(new Set());
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  };

  const setOverride = (id: string, status: TaskStatus) =>
    setOverrides((prev) => new Map(prev).set(id, status));

  const setLinger = (id: string, on: boolean) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setLingering((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    if (on) {
      timers.current.set(
        id,
        setTimeout(() => setLinger(id, false), LINGER_MS),
      );
    }
  };

  const toggleDone = (task: Task) => {
    const completing = statusOf(task) === "todo";
    const next: TaskStatus = completing ? "completed" : "todo";
    setOverride(task.id, next);
    if (completing) setLinger(task.id, true);
    startTransition(async () => {
      const result = await setTaskStatus(task.id, next);
      if (result.error) {
        setOverride(task.id, completing ? "todo" : "completed");
        toast.error(result.error);
        return;
      }
      if (!completing) {
        toast.success("Task reopened", { description: task.title });
        return;
      }
      toast.success("Task completed", {
        description: task.title,
        action: {
          label: "Undo",
          onClick: () => {
            setOverride(task.id, "todo");
            setLinger(task.id, false);
            startTransition(async () => {
              const undo = await setTaskStatus(task.id, "todo");
              if (undo.error) toast.error(undo.error);
            });
          },
        },
      });
    });
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openEditor = (task: Task | null, nextDraft: TaskDraft | null = null) => {
    setEditing(task);
    setDraft(nextDraft);
    setFormOpen(true);
  };

  const expandQuick = (nextDraft: TaskDraft) => {
    setQuickOpen(false);
    openEditor(null, nextDraft);
  };

  const filtersActive = Boolean(subjectFilter || priorityFilter || sortBy !== "due");
  const quickDefaultDue = view === "today" ? "today" : null;

  const renderRows = (list: Task[]) =>
    list.map((task) => (
      <TaskRow
        key={task.id}
        task={task}
        done={statusOf(task) === "completed"}
        subject={task.subject_id ? (subjectMap.get(task.subject_id) ?? null) : null}
        subtasks={subtasksByTask.get(task.id) ?? []}
        expanded={expanded.has(task.id)}
        onToggleExpanded={() => toggleExpanded(task.id)}
        onToggleDone={() => toggleDone(task)}
        onEdit={() => openEditor(task)}
      />
    ));

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 pb-32 md:pb-10">
      <PageTitle
        title="Tasks"
        actions={
          <>
            <Segmented
              label="Task view"
              value={view}
              onChange={changeView}
              options={VIEW_OPTIONS.map((o) => ({ ...o, count: counts[o.value] }))}
              className="hidden md:inline-flex"
            />
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative flex size-[38px] items-center justify-center rounded-full bg-sunken text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] md:hidden"
            >
              <SlidersHorizontal className="size-[17px]" aria-hidden />
              <span className="sr-only">Filter and sort</span>
              {filtersActive ? (
                <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent" />
              ) : null}
            </button>
          </>
        }
      />

      <div
        role="radiogroup"
        aria-label="Task view"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:hidden"
      >
        {VIEW_OPTIONS.map((o) => {
          const active = view === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => changeView(o.value)}
              className={cn(
                "flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]",
                active ? "bg-ink text-canvas" : "bg-sunken text-ink",
              )}
            >
              {o.label}
              <span className="text-xs tabular-nums opacity-70">{counts[o.value]}</span>
            </button>
          );
        })}
      </div>

      <div className="hidden items-start gap-3 md:flex">
        <SubjectFilter
          subjects={subjects}
          value={subjectFilter}
          onChange={setSubjectFilter}
          className="flex-1"
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] data-popup-open:bg-hover",
              priorityFilter || sortBy !== "due"
                ? "bg-accent-soft text-accent-text"
                : "bg-sunken text-ink hover:bg-hover",
            )}
          >
            <ListFilter className="size-3.5" aria-hidden />
            {sortBy === "priority" ? "By priority" : "By date"}
            {priorityFilter ? ` · ${PRIORITY_META[priorityFilter].label}` : ""}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <DropdownMenuRadioItem value="due" closeOnClick={false}>Due date</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="priority" closeOnClick={false}>Priority</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
              >
                <DropdownMenuRadioItem value="" closeOnClick={false}>Any priority</DropdownMenuRadioItem>
                {[...PRIORITY_LEVELS].reverse().map((p) => (
                  <DropdownMenuRadioItem key={p} value={p} closeOnClick={false}>
                    {PRIORITY_META[p].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {view !== "completed" ? (
        <div className="hidden md:block">
          <QuickAddInput
            subjects={subjects}
            defaultSubjectId={subjectFilter || null}
            defaultDue={quickDefaultDue}
            onExpand={(d) => openEditor(null, d)}
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <EmptyPanel
          icon={CircleCheck}
          title={view === "completed" ? "Nothing completed yet" : "All clear here"}
          body={
            filtersActive
              ? "Nothing matches these filters."
              : view === "today"
                ? "Nothing due today. Add a task or pick one from Upcoming."
                : view === "completed"
                  ? "Completed tasks will collect here."
                  : "Nothing matches this view."
          }
          action={
            filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setSubjectFilter("");
                  setPriorityFilter("");
                  setSortBy("due");
                }}
                className="h-9 rounded-full bg-sunken px-3.5 text-[13.5px] font-medium text-ink outline-none hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
              >
                Clear filters
              </button>
            ) : null
          }
        />
      ) : groups ? (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`group-${g.key}`}>
              <h2
                id={`group-${g.key}`}
                className={cn(
                  "flex items-center gap-2 pb-1 text-[12px] font-semibold tracking-[0.06em] uppercase",
                  g.key === "overdue" ? "text-danger" : "text-ink-3",
                )}
              >
                {TASK_GROUP_LABEL[g.key]}
                <span className="font-medium tabular-nums">{g.tasks.length}</span>
              </h2>
              <ul>{renderRows(g.tasks)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul>{renderRows(visible)}</ul>
      )}

      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        className="fixed right-5 bottom-[calc(88px+env(safe-area-inset-bottom)+16px)] z-30 flex size-14 items-center justify-center rounded-[20px] bg-ink text-canvas shadow-[0_12px_24px_-10px_rgba(36,28,31,0.6)] outline-none transition-transform active:scale-95 focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] md:hidden"
      >
        <Plus className="size-6" aria-hidden />
        <span className="sr-only">New task</span>
      </button>

      <QuickAddSheet
        open={quickOpen}
        onOpenChange={setQuickOpen}
        subjects={subjects}
        defaultSubjectId={subjectFilter || null}
        defaultDue={quickDefaultDue}
        onExpand={expandQuick}
      />

      <ResponsiveDialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Filter and sort">
        <div className="flex flex-col gap-5 pb-2">
          {subjects.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium text-ink-2">Subject</p>
              <SubjectFilter subjects={subjects} value={subjectFilter} onChange={setSubjectFilter} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-medium text-ink-2">Sort by</p>
            <Segmented
              label="Sort by"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "due", label: "Due date" },
                { value: "priority", label: "Priority" },
              ]}
              stretch
            />
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink-2">Priority</span>
            <NativeSelect
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            >
              <option value="">Any priority</option>
              {[...PRIORITY_LEVELS].reverse().map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="h-12 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] dark:bg-accent dark:text-ink-on-accent"
          >
            Show {counts[view]} {counts[view] === 1 ? "task" : "tasks"}
          </button>
        </div>
      </ResponsiveDialog>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        draft={draft}
        subjects={subjects}
        topics={topics}
      />
    </div>
  );
}

function SubjectFilter({
  subjects,
  value,
  onChange,
  className,
}: {
  subjects: Subject[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  if (subjects.length === 0) return null;
  return (
    <div role="group" aria-label="Filter by subject" className={cn("flex flex-wrap gap-1.5", className)}>
      <SubjectChip name="All subjects" color={null} selected={!value} onClick={() => onChange("")} />
      {subjects.map((s) => (
        <SubjectChip
          key={s.id}
          name={s.name}
          color={s.color}
          selected={value === s.id}
          onClick={() => onChange(value === s.id ? "" : s.id)}
        />
      ))}
    </div>
  );
}
