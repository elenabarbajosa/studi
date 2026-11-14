"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTask,
  deleteTask,
  updateTask,
  type ActionState,
} from "@/actions/tasks";
import {
  Field,
  FormError,
  MoreOptions,
  NativeSelect,
  PrimaryActions,
} from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Segmented } from "@/components/studi/segmented";
import { SubjectPicker } from "@/components/studi/subject-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_LEVELS,
  PRIORITY_META,
  toLocalDateInput,
  toLocalTimeInput,
  type PriorityLevel,
} from "@/lib/calendar";
import { hasDueTime } from "@/lib/planning";
import type { Subject, Task, Topic } from "@/types/database";

const empty: ActionState = {};

export type TaskDraft = {
  title?: string;
  subjectId?: string | null;
  dueDate?: string;
  priority?: PriorityLevel | null;
};

type TaskFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  subjects: Subject[];
  topics: Topic[];
  defaultSubjectId?: string;
  draft?: TaskDraft | null;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  subjects,
  topics,
  defaultSubjectId,
  draft,
}: TaskFormDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Edit task" : "New task"}
    >
      {open ? (
        <TaskFormFields
          key={task?.id ?? `new-${defaultSubjectId ?? "blank"}-${draft?.title ?? ""}`}
          task={task}
          subjects={subjects}
          topics={topics}
          defaultSubjectId={defaultSubjectId}
          draft={draft}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </ResponsiveDialog>
  );
}

const PRIORITY_OPTIONS = PRIORITY_LEVELS.map((p) => ({
  value: p,
  label: PRIORITY_META[p].label,
}));

function TaskFormFields({
  task,
  subjects,
  topics,
  defaultSubjectId,
  draft,
  onDone,
}: {
  task?: Task | null;
  subjects: Subject[];
  topics: Topic[];
  defaultSubjectId?: string;
  draft?: TaskDraft | null;
  onDone: () => void;
}) {
  const action = task ? updateTask.bind(null, task.id) : createTask;
  const [state, formAction, pending] = useActionState(action, empty);
  const [deleting, startDelete] = useTransition();
  const [subjectId, setSubjectId] = useState(
    task?.subject_id ?? draft?.subjectId ?? defaultSubjectId ?? "",
  );
  const [topicId, setTopicId] = useState(task?.topic_id ?? "");
  const [priority, setPriority] = useState<PriorityLevel>(
    task?.priority ?? draft?.priority ?? "medium",
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);
  const hasExtras = Boolean(
    task?.description ||
      task?.topic_id ||
      task?.estimated_minutes ||
      task?.scheduled_start,
  );

  const remove = () => {
    if (!task || !confirm(`Delete “${task.title}”?`)) return;
    startDelete(async () => {
      const result = await deleteTask(task.id);
      if (result.error) toast.error(result.error);
      else onDone();
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {task ? <input type="hidden" name="status" value={task.status} /> : null}
      <Field label="Task" htmlFor="task-title">
        <Input
          id="task-title"
          name="title"
          required
          maxLength={200}
          autoFocus={!task}
          placeholder="Review eigenvectors"
          defaultValue={task?.title ?? draft?.title ?? ""}
          className="h-12 text-[17px] md:h-11 md:text-[15px]"
        />
      </Field>

      {subjects.length > 0 ? (
        <Field label="Subject">
          <SubjectPicker
            name="subject_id"
            subjects={subjects}
            value={subjectId}
            onChange={(id) => {
              setSubjectId(id);
              setTopicId("");
            }}
          />
        </Field>
      ) : (
        <input type="hidden" name="subject_id" value="" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date" htmlFor="due_date" optional>
          <Input
            id="due_date"
            name="due_date"
            type="date"
            defaultValue={task?.due_at ? toLocalDateInput(task.due_at) : (draft?.dueDate ?? "")}
          />
        </Field>
        <Field label="Time" htmlFor="due_time" optional>
          <Input
            id="due_time"
            name="due_time"
            type="time"
            defaultValue={
              task?.due_at && hasDueTime(task.due_at) ? toLocalTimeInput(task.due_at) : ""
            }
          />
        </Field>
      </div>

      <Field label="Priority">
        <input type="hidden" name="priority" value={priority} />
        <Segmented
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
          stretch
        />
      </Field>

      <MoreOptions label="Notes, topic and study block" defaultOpen={hasExtras}>
        <Field label="Notes" htmlFor="description" optional>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={task?.description ?? ""}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Topic" htmlFor="topic_id" optional>
            <NativeSelect
              id="topic_id"
              name="topic_id"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!subjectId}
            >
              <option value="">{subjectId ? "No topic" : "Pick a subject first"}</option>
              {subjectTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.parent_id ? `— ${t.title}` : t.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Estimate (minutes)" htmlFor="estimated_minutes" optional>
            <Input
              id="estimated_minutes"
              name="estimated_minutes"
              type="number"
              inputMode="numeric"
              min={5}
              step={5}
              defaultValue={task?.estimated_minutes ?? ""}
            />
          </Field>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-3">
          <Field label="Study on" htmlFor="scheduled_date" optional>
            <Input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              defaultValue={task?.scheduled_start ? toLocalDateInput(task.scheduled_start) : ""}
            />
          </Field>
          <Field label="From" htmlFor="scheduled_start_time">
            <Input
              id="scheduled_start_time"
              name="scheduled_start_time"
              type="time"
              defaultValue={task?.scheduled_start ? toLocalTimeInput(task.scheduled_start) : ""}
            />
          </Field>
          <Field label="To" htmlFor="scheduled_end_time">
            <Input
              id="scheduled_end_time"
              name="scheduled_end_time"
              type="time"
              defaultValue={task?.scheduled_end ? toLocalTimeInput(task.scheduled_end) : ""}
            />
          </Field>
        </div>
      </MoreOptions>

      <FormError message={state.error} />

      <PrimaryActions className="justify-between">
        {task ? (
          <Button
            type="button"
            variant="ghost"
            onClick={remove}
            disabled={deleting || pending}
            className="mr-auto gap-1.5 text-danger hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || deleting} className="ml-auto min-w-28">
          {pending ? "Saving…" : task ? "Save changes" : "Add task"}
        </Button>
      </PrimaryActions>
    </form>
  );
}
