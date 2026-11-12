"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createTask,
  updateTask,
  type ActionState,
} from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_LEVELS,
  PRIORITY_META,
  toLocalDateInput,
  toLocalTimeInput,
} from "@/lib/calendar";
import type { Subject, Task, Topic } from "@/types/database";

const empty: ActionState = {};

type TaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  subjects: Subject[];
  topics: Topic[];
  defaultSubjectId?: string;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  subjects,
  topics,
  defaultSubjectId,
}: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <TaskFormFields
            key={task?.id ?? `new-${defaultSubjectId ?? "blank"}`}
            task={task}
            subjects={subjects}
            topics={topics}
            defaultSubjectId={defaultSubjectId}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskFormFields({
  task,
  subjects,
  topics,
  defaultSubjectId,
  onDone,
}: {
  task?: Task | null;
  subjects: Subject[];
  topics: Topic[];
  defaultSubjectId?: string;
  onDone: () => void;
}) {
  const action = task ? updateTask.bind(null, task.id) : createTask;
  const [state, formAction, pending] = useActionState(action, empty);
  const [subjectId, setSubjectId] = useState(
    task?.subject_id ?? defaultSubjectId ?? "",
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  const filteredTopics = topics.filter((t) =>
    subjectId ? t.subject_id === subjectId : true,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={task?.title ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Notes</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={task?.description ?? ""}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="subject_id">Subject</Label>
          <select
            id="subject_id"
            name="subject_id"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic_id">Topic</Label>
          <select
            id="topic_id"
            name="topic_id"
            defaultValue={task?.topic_id ?? ""}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">None</option>
            {filteredTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="due_date">Due date</Label>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={task?.due_at ? toLocalDateInput(task.due_at) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_time">Due time</Label>
          <Input
            id="due_time"
            name="due_time"
            type="time"
            defaultValue={task?.due_at ? toLocalTimeInput(task.due_at) : ""}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="scheduled_date">Study date</Label>
          <Input
            id="scheduled_date"
            name="scheduled_date"
            type="date"
            defaultValue={
              task?.scheduled_start
                ? toLocalDateInput(task.scheduled_start)
                : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduled_start_time">Start</Label>
          <Input
            id="scheduled_start_time"
            name="scheduled_start_time"
            type="time"
            defaultValue={
              task?.scheduled_start
                ? toLocalTimeInput(task.scheduled_start)
                : ""
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduled_end_time">End</Label>
          <Input
            id="scheduled_end_time"
            name="scheduled_end_time"
            type="time"
            defaultValue={
              task?.scheduled_end ? toLocalTimeInput(task.scheduled_end) : ""
            }
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={task?.priority ?? "medium"}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {PRIORITY_LEVELS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimated_minutes">Est. minutes</Label>
          <Input
            id="estimated_minutes"
            name="estimated_minutes"
            type="number"
            min={5}
            defaultValue={task?.estimated_minutes ?? ""}
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save task"}
      </Button>
    </form>
  );
}
