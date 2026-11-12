"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createAssessment,
  deleteAssessment,
  updateAssessment,
  type ActionState,
} from "@/actions/assessments";
import {
  createPersonalEvent,
  deletePersonalEvent,
  updatePersonalEvent,
} from "@/actions/calendar-events";
import {
  createStudySession,
  deleteStudySession,
  updateStudySession,
} from "@/actions/study-sessions";
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
  ASSESSMENT_TYPE_META,
  ASSESSMENT_TYPES,
  PRIORITY_LEVELS,
  PRIORITY_META,
  STUDY_SESSION_STATUS_META,
  STUDY_SESSION_STATUSES,
  toLocalDateInput,
  toLocalTimeInput,
  type CalendarEventKind,
} from "@/lib/calendar";
import type {
  Assessment,
  CalendarEvent,
  StudySession,
  Subject,
  Task,
  Topic,
} from "@/types/database";

const empty: ActionState = {};

export type CalendarDraft = {
  kind: CalendarEventKind;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  defaultSubjectId?: string;
  assessment?: Assessment;
  personal?: CalendarEvent;
  session?: StudySession;
};

type EventFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CalendarDraft | null;
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
};

export function EventFormDialog({
  open,
  onOpenChange,
  draft,
  subjects,
  topics,
  tasks,
}: EventFormDialogProps) {
  if (!draft) return null;

  const draftKey = [
    draft.kind,
    draft.date,
    draft.assessment?.id ?? draft.personal?.id ?? draft.session?.id ?? "new",
  ].join(":");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {draft.assessment || draft.personal || draft.session
              ? "Edit calendar item"
              : "Create calendar item"}
          </DialogTitle>
        </DialogHeader>
        <EventFormBody
          key={draftKey}
          draft={draft}
          subjects={subjects}
          topics={topics}
          tasks={tasks}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventFormBody({
  draft,
  subjects,
  topics,
  tasks,
  onDone,
}: {
  draft: CalendarDraft;
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  onDone: () => void;
}) {
  const locked =
    Boolean(draft.assessment) ||
    Boolean(draft.personal) ||
    Boolean(draft.session);
  const [kind, setKind] = useState<CalendarEventKind>(draft.kind);

  return (
    <>
      {!locked ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["assessment", "Exam / deadline"],
              ["study_session", "Study session"],
              ["personal", "Personal event"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                kind === value
                  ? "border-primary bg-brand-soft"
                  : "border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {kind === "assessment" ? (
        <AssessmentForm draft={draft} subjects={subjects} onDone={onDone} />
      ) : null}
      {kind === "personal" ? (
        <PersonalForm draft={draft} onDone={onDone} />
      ) : null}
      {kind === "study_session" ? (
        <SessionForm
          draft={draft}
          subjects={subjects}
          topics={topics}
          tasks={tasks}
          onDone={onDone}
        />
      ) : null}
    </>
  );
}

function AssessmentForm({
  draft,
  subjects,
  onDone,
}: {
  draft: CalendarDraft;
  subjects: Subject[];
  onDone: () => void;
}) {
  const existing = draft.assessment;
  const action = existing
    ? updateAssessment.bind(null, existing.id)
    : createAssessment;
  const [state, formAction, pending] = useActionState(action, empty);
  const [allDay, setAllDay] = useState(
    existing?.all_day ?? draft.allDay ?? !draft.startTime,
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Title" name="title" defaultValue={existing?.title ?? ""} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assessment_type">Type</Label>
          <select
            id="assessment_type"
            name="assessment_type"
            defaultValue={existing?.assessment_type ?? "final"}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {ASSESSMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSESSMENT_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject_id">Subject</Label>
          <select
            id="subject_id"
            name="subject_id"
            defaultValue={
              existing?.subject_id ?? draft.defaultSubjectId ?? ""
            }
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
      </div>
      <Field
        label="Date"
        name="date"
        type="date"
        required
        defaultValue={
          existing ? toLocalDateInput(existing.starts_at) : draft.date
        }
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="all_day"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        All-day (no specific time)
      </label>
      {!allDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Start time"
            name="start_time"
            type="time"
            defaultValue={
              existing && !existing.all_day
                ? toLocalTimeInput(existing.starts_at)
                : draft.startTime || "09:00"
            }
          />
          <Field
            label="End time"
            name="end_time"
            type="time"
            defaultValue={
              existing?.ends_at && !existing.all_day
                ? toLocalTimeInput(existing.ends_at)
                : draft.endTime || "10:00"
            }
          />
        </div>
      ) : (
        <input type="hidden" name="all_day" value="true" />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Location"
          name="location"
          defaultValue={existing?.location ?? ""}
        />
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={existing?.priority ?? "medium"}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {PRIORITY_LEVELS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={existing?.description ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="completed"
          defaultChecked={existing?.completed ?? false}
        />
        Mark completed
      </label>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {existing ? (
          <DeleteButton
            label="Delete assessment"
            onDelete={() => deleteAssessment(existing.id)}
            onDone={onDone}
          />
        ) : null}
      </div>
    </form>
  );
}

function PersonalForm({
  draft,
  onDone,
}: {
  draft: CalendarDraft;
  onDone: () => void;
}) {
  const existing = draft.personal;
  const action = existing
    ? updatePersonalEvent.bind(null, existing.id)
    : createPersonalEvent;
  const [state, formAction, pending] = useActionState(action, empty);
  const [allDay, setAllDay] = useState(
    existing?.all_day ?? draft.allDay ?? !draft.startTime,
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Title" name="title" defaultValue={existing?.title ?? ""} required />
      <Field
        label="Date"
        name="date"
        type="date"
        required
        defaultValue={
          existing ? toLocalDateInput(existing.starts_at) : draft.date
        }
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="all_day"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        All-day
      </label>
      {!allDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Start"
            name="start_time"
            type="time"
            defaultValue={
              existing && !existing.all_day
                ? toLocalTimeInput(existing.starts_at)
                : draft.startTime || "12:00"
            }
          />
          <Field
            label="End"
            name="end_time"
            type="time"
            defaultValue={
              existing?.ends_at && !existing.all_day
                ? toLocalTimeInput(existing.ends_at)
                : draft.endTime || "13:00"
            }
          />
        </div>
      ) : (
        <input type="hidden" name="all_day" value="true" />
      )}
      <div className="space-y-2">
        <Label htmlFor="description">Notes</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={existing?.description ?? ""}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {existing ? (
          <DeleteButton
            label="Delete event"
            onDelete={() => deletePersonalEvent(existing.id)}
            onDone={onDone}
          />
        ) : null}
      </div>
    </form>
  );
}

function SessionForm({
  draft,
  subjects,
  topics,
  tasks,
  onDone,
}: {
  draft: CalendarDraft;
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  onDone: () => void;
}) {
  const existing = draft.session;
  const action = existing
    ? updateStudySession.bind(null, existing.id)
    : createStudySession;
  const [state, formAction, pending] = useActionState(action, empty);
  const [subjectId, setSubjectId] = useState(existing?.subject_id ?? "");

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  const filteredTopics = topics.filter((t) =>
    subjectId ? t.subject_id === subjectId : true,
  );

  return (
    <form action={formAction} className="space-y-3">
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
            defaultValue={existing?.topic_id ?? ""}
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
      <div className="space-y-2">
        <Label htmlFor="task_id">Linked task</Label>
        <select
          id="task_id"
          name="task_id"
          defaultValue={existing?.task_id ?? ""}
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">None</option>
          {tasks
            .filter((t) => t.status === "todo")
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
      </div>
      <Field
        label="Date"
        name="date"
        type="date"
        required
        defaultValue={
          existing ? toLocalDateInput(existing.starts_at) : draft.date
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Start"
          name="start_time"
          type="time"
          required
          defaultValue={
            existing
              ? toLocalTimeInput(existing.starts_at)
              : draft.startTime || "10:00"
          }
        />
        <Field
          label="End"
          name="end_time"
          type="time"
          required
          defaultValue={
            existing
              ? toLocalTimeInput(existing.ends_at)
              : draft.endTime || "11:00"
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={existing?.status ?? "planned"}
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          {STUDY_SESSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STUDY_SESSION_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={existing?.notes ?? ""}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {existing ? (
          <DeleteButton
            label="Delete session"
            onDelete={() => deleteStudySession(existing.id)}
            onDone={onDone}
          />
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  );
}

function DeleteButton({
  label,
  onDelete,
  onDone,
}: {
  label: string;
  onDelete: () => Promise<ActionState>;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`${label}?`)) return;
        setPending(true);
        const result = await onDelete();
        setPending(false);
        if (!result.error) onDone();
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
