"use client";

import { useState, useTransition } from "react";
import { ArrowUp, CalendarDays, CornerDownLeft, Flag, Maximize2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createTask } from "@/actions/tasks";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { SubjectChip, SubjectPicker } from "@/components/studi/subject-chip";
import type { TaskDraft } from "@/components/tasks/task-form-dialog";
import { PRIORITY_META, type PriorityLevel } from "@/lib/calendar";
import { PRIORITY_MARK } from "@/lib/dashboard";
import {
  parseQuickAdd,
  quickDueDate,
  type QuickAddDue,
} from "@/lib/planning";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

const DUE_TEXT: Record<QuickAddDue, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
};

async function submitTask(fields: {
  title: string;
  subjectId: string | null;
  priority: PriorityLevel | null;
  dueDate: string | null;
}) {
  const fd = new FormData();
  fd.set("title", fields.title);
  fd.set("subject_id", fields.subjectId ?? "");
  fd.set("priority", fields.priority ?? "medium");
  fd.set("due_date", fields.dueDate ?? "");
  return createTask({}, fd);
}

/** Desktop one-line add: `@subject`, `!`–`!!!` and `today / tomorrow / week` tokens. */
export function QuickAddInput({
  subjects,
  defaultSubjectId,
  defaultDue,
  onExpand,
}: {
  subjects: Subject[];
  defaultSubjectId: string | null;
  defaultDue: QuickAddDue | null;
  onExpand: (draft: TaskDraft) => void;
}) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const parsed = parseQuickAdd(text, subjects);
  const subjectId = parsed.subjectId ?? defaultSubjectId;
  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const due = parsed.due ?? defaultDue;
  const showPreview = parsed.title.length > 0;

  const draft = (): TaskDraft => ({
    title: parsed.title || text.trim(),
    subjectId,
    priority: parsed.priority,
    dueDate: due ? quickDueDate(due) : undefined,
  });

  const submit = () => {
    if (!parsed.title) {
      toast.error("Give the task a title first");
      return;
    }
    startTransition(async () => {
      const result = await submitTask({
        title: parsed.title,
        subjectId,
        priority: parsed.priority,
        dueDate: due ? quickDueDate(due) : null,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setText("");
      toast.success("Task added", { description: parsed.title });
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex h-[50px] items-center gap-2.5 rounded-[14px] bg-sunken pr-2 pl-3.5 transition-shadow focus-within:bg-raised focus-within:shadow-[0_0_0_1px_var(--hairline),0_0_0_4px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
      >
        <Plus className="size-[17px] shrink-0 text-ink-3" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isPending}
          aria-label="New task"
          aria-describedby="quick-add-hint"
          placeholder="New task — @subject !!! today / tomorrow / week, then Enter"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onClick={() => onExpand(draft())}
          title="More options"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          <span className="sr-only">Open the full task form</span>
        </button>
        <button
          type="submit"
          disabled={isPending || !parsed.title}
          className="flex h-7 shrink-0 items-center gap-1 rounded-[7px] border border-hairline px-1.5 text-xs text-ink-3 outline-none transition-colors enabled:hover:bg-hover enabled:hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-60"
        >
          <CornerDownLeft className="size-3" aria-hidden />
          <span className="sr-only">Add task</span>
        </button>
      </form>
      <p id="quick-add-hint" className="sr-only">
        Type @ and a subject name, one to three exclamation marks for priority, and today, tomorrow or week for the due date.
      </p>
      {showPreview ? (
        <div className="-mt-0.5 flex flex-wrap items-center gap-2 pl-1 text-[12.5px] text-ink-2" aria-live="polite">
          <span>Will add:</span>
          <SubjectChip
            name={subject?.name ?? "No subject"}
            color={subject?.color ?? null}
            size="sm"
          />
          <span className="font-semibold">{due ? DUE_TEXT[due] : "No date"}</span>
          {parsed.priority ? (
            <span className="font-bold text-accent-text">
              {PRIORITY_MARK[parsed.priority] || PRIORITY_META[parsed.priority].label}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const DUE_CHOICES: (QuickAddDue | null)[] = ["today", "tomorrow", "week", null];
const PRIORITY_CHOICES: PriorityLevel[] = ["low", "medium", "high", "critical"];

/** Phone sheet: one line, chips for subject, date and priority, round send button. */
export function QuickAddSheet({
  open,
  onOpenChange,
  subjects,
  defaultSubjectId,
  defaultDue,
  onExpand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
  defaultSubjectId: string | null;
  defaultDue: QuickAddDue | null;
  onExpand: (draft: TaskDraft) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="New task" hideTitle>
      {open ? (
        <QuickAddSheetBody
          subjects={subjects}
          defaultSubjectId={defaultSubjectId}
          defaultDue={defaultDue}
          onExpand={onExpand}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </ResponsiveDialog>
  );
}

function QuickAddSheetBody({
  subjects,
  defaultSubjectId,
  defaultDue,
  onExpand,
  onDone,
}: {
  subjects: Subject[];
  defaultSubjectId: string | null;
  defaultDue: QuickAddDue | null;
  onExpand: (draft: TaskDraft) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [due, setDue] = useState<QuickAddDue | null>(defaultDue);
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [isPending, startTransition] = useTransition();
  const trimmed = title.trim();
  const dueDate = due ? quickDueDate(due) : null;

  const submit = () => {
    if (!trimmed) return;
    startTransition(async () => {
      const result = await submitTask({ title: trimmed, subjectId: subjectId || null, priority, dueDate });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task added", { description: trimmed });
      onDone();
    });
  };

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
      active ? "bg-ink text-canvas" : "bg-sunken text-ink hover:bg-hover",
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3.5 pb-1"
    >
      <div className="flex min-h-12 items-center gap-3 pr-11">
        <span aria-hidden className="size-6 shrink-0 rounded-full border-[1.8px] border-ink-4" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
          maxLength={200}
          aria-label="Task title"
          placeholder="What needs doing?"
          className="h-12 min-w-0 flex-1 bg-transparent text-[18px] font-medium text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {subjects.length > 0 ? (
        <SubjectPicker subjects={subjects} value={subjectId} onChange={setSubjectId} />
      ) : null}

      <div role="group" aria-label="Due" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {DUE_CHOICES.map((choice) => (
          <button
            key={choice ?? "none"}
            type="button"
            aria-pressed={due === choice}
            onClick={() => setDue(choice)}
            className={chip(due === choice)}
          >
            {choice === due && choice ? <CalendarDays className="size-3.5" aria-hidden /> : null}
            {choice ? DUE_TEXT[choice] : "No date"}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Priority" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {PRIORITY_CHOICES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={priority === p}
            onClick={() => setPriority(p)}
            className={chip(priority === p)}
          >
            {priority === p ? <Flag className="size-3.5" aria-hidden /> : null}
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() =>
            onExpand({ title: trimmed, subjectId: subjectId || null, priority, dueDate: dueDate ?? undefined })
          }
          className="flex h-11 items-center gap-1.5 rounded-full px-1 text-[13.5px] font-medium text-ink-2 outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          More options
        </button>
        <button
          type="submit"
          disabled={!trimmed || isPending}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-[transform,opacity] active:scale-95 focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-40 dark:bg-accent dark:text-ink-on-accent"
        >
          <ArrowUp className="size-[22px]" aria-hidden />
          <span className="sr-only">Add task</span>
        </button>
      </div>
    </form>
  );
}
