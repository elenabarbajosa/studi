"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import {
  ChevronDown,
  Clock,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { createSubtask, deleteSubtask, deleteTask, toggleSubtask } from "@/actions/tasks";
import { RoundCheckbox } from "@/components/studi/round-checkbox";
import { SubjectDot } from "@/components/studi/subject-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PriorityLevel } from "@/lib/calendar";
import { PRIORITY_MARK } from "@/lib/dashboard";
import { dueLabel, type DueLabel } from "@/lib/planning";
import { cn } from "@/lib/utils";
import type { Subject, Subtask, Task } from "@/types/database";

const PRIORITY_TEXT: Record<PriorityLevel, string> = {
  critical: "text-danger",
  high: "text-warning",
  medium: "text-ink-3",
  low: "text-ink-3",
};

const DUE_TONE: Record<DueLabel["tone"], string> = {
  overdue: "font-semibold text-danger",
  today: "font-semibold text-accent-text",
  soon: "text-ink-2",
  later: "text-ink-2",
};

export function PriorityMark({ priority }: { priority: PriorityLevel }) {
  const mark = PRIORITY_MARK[priority];
  if (!mark) return null;
  return (
    <span className={cn("shrink-0 text-xs font-bold tabular-nums", PRIORITY_TEXT[priority])}>
      <span aria-hidden>{mark}</span>
      <span className="sr-only">{priority} priority</span>
    </span>
  );
}

export function TaskRow({
  task,
  done,
  subject,
  subtasks,
  expanded,
  onToggleExpanded,
  onToggleDone,
  onEdit,
}: {
  task: Task;
  done: boolean;
  subject: Subject | null;
  subtasks: Subtask[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleDone: () => void;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const subDone = subtasks.filter((s) => s.completed).length;
  const due = task.due_at && !done ? dueLabel(task.due_at) : null;

  const remove = () => {
    if (!confirm(`Delete “${task.title}”?`)) return;
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (result.error) toast.error(result.error);
      else toast.success("Task deleted");
    });
  };

  return (
    <li className={cn("border-b border-hairline", isPending && "opacity-60")}>
      <div className="flex min-h-[60px] items-center gap-3 py-2 md:min-h-[58px]">
        <RoundCheckbox
          checked={done}
          onToggle={onToggleDone}
          size="lg"
          label={done ? `Reopen “${task.title}”` : `Complete “${task.title}”`}
        />
        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 flex-1 flex-col gap-[3px] rounded-[10px] py-1 text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
        >
          <span
            className={cn(
              "truncate text-[15px] transition-colors duration-200",
              done ? "text-ink-3 line-through" : "text-ink",
            )}
          >
            {task.title}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-ink-2">
            <span className="inline-flex min-w-0 items-center gap-[5px]">
              <SubjectDot color={subject?.color} />
              <span className="max-w-[180px] truncate">{subject?.name ?? "No subject"}</span>
            </span>
            {due ? <span className={DUE_TONE[due.tone]}>{due.label}</span> : null}
            {subtasks.length > 0 ? (
              <span className="inline-flex items-center gap-[3px] tabular-nums">
                <ListChecks className="size-3" aria-hidden />
                {subDone}/{subtasks.length}
                <span className="sr-only"> subtasks done</span>
              </span>
            ) : null}
            {task.estimated_minutes ? (
              <span className="inline-flex items-center gap-[3px] tabular-nums">
                <Clock className="size-3" aria-hidden />
                {task.estimated_minutes}m
              </span>
            ) : null}
          </span>
        </button>

        <PriorityMark priority={task.priority} />

        {subtasks.length > 0 ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
          >
            <ChevronDown
              className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")}
              aria-hidden
            />
            <span className="sr-only">{expanded ? "Hide subtasks" : "Show subtasks"}</span>
          </button>
        ) : null}

        {!done ? (
          <Link
            href={`/focus?task=${task.id}${task.subject_id ? `&subject=${task.subject_id}` : ""}`}
            title="Focus on this"
            aria-label={`Focus on “${task.title}”`}
            className="hidden size-[34px] shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] md:flex"
          >
            <Play className="size-3.5" aria-hidden />
          </Link>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] data-popup-open:bg-sunken"
            aria-label={`Actions for “${task.title}”`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil aria-hidden />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => !expanded && onToggleExpanded()}>
              <Plus aria-hidden />
              Add subtask
            </DropdownMenuItem>
            {!done ? (
              <DropdownMenuItem
                render={
                  <Link
                    href={`/focus?task=${task.id}${task.subject_id ? `&subject=${task.subject_id}` : ""}`}
                  />
                }
              >
                <Play aria-hidden />
                Focus on this
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded ? <SubtaskList taskId={task.id} subtasks={subtasks} /> : null}
    </li>
  );
}

function SubtaskList({ taskId, subtasks }: { taskId: string; subtasks: Subtask[] }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
    });

  return (
    <div className="mb-3 ml-[34px] flex flex-col rounded-[14px] bg-sunken/60 px-3 py-1.5">
      <ul aria-label="Subtasks">
        {subtasks.map((sub) => (
          <li key={sub.id} className="flex min-h-10 items-center gap-2.5">
            <RoundCheckbox
              size="sm"
              checked={sub.completed}
              disabled={isPending}
              onToggle={() => run(() => toggleSubtask(sub.id, !sub.completed))}
              label={sub.completed ? `Reopen “${sub.title}”` : `Complete “${sub.title}”`}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[14px]",
                sub.completed ? "text-ink-3 line-through" : "text-ink",
              )}
            >
              {sub.title}
            </span>
            <button
              type="button"
              aria-label={`Delete subtask “${sub.title}”`}
              onClick={() => {
                if (!confirm("Delete this subtask?")) return;
                run(() => deleteSubtask(sub.id));
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-hover hover:text-danger focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form
        ref={formRef}
        className="flex min-h-10 items-center gap-2.5"
        action={(fd) =>
          startTransition(async () => {
            const result = await createSubtask(taskId, {}, fd);
            if (result.error) toast.error(result.error);
            else formRef.current?.reset();
          })
        }
      >
        <Plus className="mx-[3px] size-4 shrink-0 text-ink-3" aria-hidden />
        <input
          name="title"
          required
          maxLength={200}
          autoFocus={subtasks.length === 0}
          placeholder="Add a subtask"
          aria-label="New subtask"
          className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold text-accent-text outline-none hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)] disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
