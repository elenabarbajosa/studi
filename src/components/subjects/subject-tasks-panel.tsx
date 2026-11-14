"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";

import { setTaskStatus } from "@/actions/tasks";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { TaskRow } from "@/components/tasks/task-row";
import type { TaskStatus } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Subject, Subtask, Task } from "@/types/database";

type SubjectTasksPanelProps = {
  subject: Subject;
  tasks: Task[];
  subtasks: Subtask[];
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
};

function dueTime(task: Task) {
  return task.due_at ? new Date(task.due_at).getTime() : Number.POSITIVE_INFINITY;
}

export function SubjectTasksPanel({ subject, tasks, subtasks, onNewTask, onEditTask }: SubjectTasksPanelProps) {
  const [overrides, setOverrides] = useState<ReadonlyMap<string, TaskStatus>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showDone, setShowDone] = useState(false);
  const [, startTransition] = useTransition();

  const statusOf = (task: Task) => overrides.get(task.id) ?? task.status;

  const subtasksByTask = useMemo(() => {
    const map = new Map<string, Subtask[]>();
    for (const s of subtasks) {
      const list = map.get(s.task_id) ?? [];
      list.push(s);
      map.set(s.task_id, list);
    }
    return map;
  }, [subtasks]);

  const open = tasks
    .filter((t) => statusOf(t) === "todo")
    .sort((a, b) => dueTime(a) - dueTime(b));
  const done = tasks
    .filter((t) => statusOf(t) === "completed")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const setOverride = (id: string, status: TaskStatus) =>
    setOverrides((prev) => new Map(prev).set(id, status));

  const toggleDone = (task: Task) => {
    const completing = statusOf(task) === "todo";
    const next: TaskStatus = completing ? "completed" : "todo";
    setOverride(task.id, next);
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

  const renderRow = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      done={statusOf(task) === "completed"}
      subject={subject}
      subtasks={subtasksByTask.get(task.id) ?? []}
      expanded={expanded.has(task.id)}
      onToggleExpanded={() => toggleExpanded(task.id)}
      onToggleDone={() => toggleDone(task)}
      onEdit={() => onEditTask(task)}
    />
  );

  return (
    <section aria-labelledby="subject-tasks-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="subject-tasks-title" className="text-[15px] font-semibold text-ink">
          Tasks
        </h2>
        <button
          type="button"
          onClick={onNewTask}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-8"
        >
          <Plus className="size-[15px]" aria-hidden />
          New task
        </button>
      </div>

      {tasks.length === 0 ? (
        <EmptyPanel
          compact
          icon={ListChecks}
          title="No tasks for this subject"
          body="Break the next study step into something you can tick off."
        />
      ) : (
        <>
          {open.length > 0 ? (
            <ul>{open.map(renderRow)}</ul>
          ) : (
            <p className="rounded-[16px] bg-sunken px-4 py-3 text-[13.5px] text-ink-2">
              All caught up for {subject.name}.
            </p>
          )}
          {done.length > 0 ? (
            <div>
              <button
                type="button"
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
                className="-ml-2 inline-flex h-9 items-center gap-1 rounded-full px-2 text-[13px] font-semibold text-ink-2 outline-none hover:bg-sunken focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
              >
                <ChevronDown
                  className={cn("size-4 transition-transform duration-200", !showDone && "-rotate-90")}
                  aria-hidden
                />
                Completed · {done.length}
              </button>
              {showDone ? <ul>{done.map(renderRow)}</ul> : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
