"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createSubtask,
  deleteSubtask,
  deleteTask,
  setTaskStatus,
  toggleSubtask,
} from "@/actions/tasks";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRIORITY_META,
  toLocalDateInput,
  type PriorityLevel,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import type { Subject, Subtask, Task, Topic } from "@/types/database";

export type TaskView = "today" | "upcoming" | "all" | "completed";

type TasksBoardProps = {
  tasks: Task[];
  subtasks: Subtask[];
  subjects: Subject[];
  topics: Topic[];
  initialView?: TaskView;
};

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
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
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortBy, setSortBy] = useState<"due" | "priority">("due");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const subjectMap = useMemo(() => {
    const map = new Map(subjects.map((s) => [s.id, s]));
    return map;
  }, [subjects]);

  const subtasksByTask = useMemo(() => {
    const map = new Map<string, Subtask[]>();
    for (const s of subtasks) {
      const list = map.get(s.task_id) ?? [];
      list.push(s);
      map.set(s.task_id, list);
    }
    return map;
  }, [subtasks]);

  const filtered = useMemo(() => {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    let list = [...tasks];

    if (view === "completed") {
      list = list.filter((t) => t.status === "completed");
    } else {
      list = list.filter((t) => t.status === "todo");
      if (view === "today") {
        list = list.filter((t) => {
          if (!t.due_at) return false;
          const due = new Date(t.due_at);
          return due >= todayStart && due <= todayEnd;
        });
      } else if (view === "upcoming") {
        list = list.filter((t) => {
          if (!t.due_at) return true;
          return new Date(t.due_at) > todayEnd;
        });
      }
    }

    if (subjectFilter) {
      list = list.filter((t) => t.subject_id === subjectFilter);
    }
    if (priorityFilter) {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "priority") {
        return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      }
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    return list;
  }, [tasks, view, subjectFilter, priorityFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["today", "Today"],
            ["upcoming", "Upcoming"],
            ["all", "All"],
            ["completed", "Completed"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={view === value ? "default" : "outline"}
            onClick={() => setView(value)}
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          className="ml-auto gap-1"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          New task
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="Filter by subject"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "due" | "priority")}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          aria-label="Sort tasks"
        >
          <option value="due">Sort by due date</option>
          <option value="priority">Sort by priority</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="studi-panel px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {view === "completed"
              ? "No completed tasks yet."
              : view === "today"
                ? "Nothing due today."
                : "No tasks match these filters."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((task) => {
            const subject = task.subject_id
              ? subjectMap.get(task.subject_id)
              : null;
            const taskSubs = subtasksByTask.get(task.id) ?? [];
            const overdue =
              task.status === "todo" &&
              task.due_at &&
              new Date(task.due_at) < startOfDay();

            return (
              <li key={task.id} className="studi-panel p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border",
                      task.status === "completed"
                        ? "border-primary bg-brand-soft text-primary"
                        : "border-border hover:bg-muted",
                    )}
                    aria-label={
                      task.status === "completed"
                        ? "Reopen task"
                        : "Complete task"
                    }
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await setTaskStatus(
                          task.id,
                          task.status === "completed" ? "todo" : "completed",
                        );
                        if (result.error) toast.error(result.error);
                      });
                    }}
                  >
                    {task.status === "completed" ? (
                      <RotateCcw className="size-3.5" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => {
                        setEditing(task);
                        setFormOpen(true);
                      }}
                    >
                      <p
                        className={cn(
                          "font-medium",
                          task.status === "completed" &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </p>
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {PRIORITY_META[task.priority].label}
                      {subject ? ` · ${subject.name}` : ""}
                      {task.due_at
                        ? ` · Due ${toLocalDateInput(task.due_at)}`
                        : " · No due date"}
                      {task.estimated_minutes
                        ? ` · ${task.estimated_minutes}m`
                        : ""}
                      {overdue ? " · Overdue" : ""}
                    </p>

                    <button
                      type="button"
                      className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() =>
                        setExpanded(expanded === task.id ? null : task.id)
                      }
                    >
                      {taskSubs.length} subtask
                      {taskSubs.length === 1 ? "" : "s"}
                    </button>

                    {expanded === task.id ? (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {taskSubs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={sub.completed}
                              onChange={() => {
                                startTransition(async () => {
                                  const result = await toggleSubtask(
                                    sub.id,
                                    !sub.completed,
                                  );
                                  if (result.error) toast.error(result.error);
                                });
                              }}
                            />
                            <span
                              className={cn(
                                "flex-1",
                                sub.completed &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {sub.title}
                            </span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Delete subtask"
                              onClick={() => {
                                if (!confirm("Delete this subtask?")) return;
                                startTransition(async () => {
                                  const result = await deleteSubtask(sub.id);
                                  if (result.error) toast.error(result.error);
                                });
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                        <form
                          className="flex gap-2"
                          action={(fd) => {
                            startTransition(async () => {
                              const result = await createSubtask(
                                task.id,
                                {},
                                fd,
                              );
                              if (result.error) toast.error(result.error);
                            });
                          }}
                        >
                          <Input
                            name="title"
                            placeholder="Add subtask"
                            required
                            className="h-8"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Add
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete task"
                    onClick={() => {
                      if (!confirm(`Delete “${task.title}”?`)) return;
                      startTransition(async () => {
                        const result = await deleteTask(task.id);
                        if (result.error) toast.error(result.error);
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        subjects={subjects}
        topics={topics}
      />
    </div>
  );
}
