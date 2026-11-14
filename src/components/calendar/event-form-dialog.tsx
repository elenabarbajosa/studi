"use client";

import { useActionState, useEffect, useState } from "react";
import { GraduationCap, Timer, Trash2, User } from "lucide-react";

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
import {
  Field,
  FormError,
  MoreOptions,
  NativeSelect,
  PrimaryActions,
  SwitchRow,
} from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Segmented } from "@/components/studi/segmented";
import { SubjectPicker } from "@/components/studi/subject-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type AssessmentType,
  type CalendarEventKind,
} from "@/lib/calendar";
import { EXAM_TYPES } from "@/lib/calendar-items";
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
  defaultTitle?: string;
  defaultAssessmentType?: AssessmentType;
  defaultTopicId?: string;
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

type FormKind = Exclude<CalendarEventKind, "task">;

function titleFor(draft: CalendarDraft) {
  if (draft.assessment) {
    return EXAM_TYPES.includes(draft.assessment.assessment_type) ? "Edit exam" : "Edit deadline";
  }
  if (draft.personal) return "Edit event";
  if (draft.session) return "Edit study session";
  return "New calendar entry";
}

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
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={titleFor(draft)}>
      <EventFormBody
        key={draftKey}
        draft={draft}
        subjects={subjects}
        topics={topics}
        tasks={tasks}
        onDone={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}

const KIND_OPTIONS = [
  { value: "study_session" as const, label: "Study", icon: Timer },
  { value: "assessment" as const, label: "Exam or deadline", icon: GraduationCap },
  { value: "personal" as const, label: "Personal", icon: User },
];

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
  const [kind, setKind] = useState<FormKind>(
    draft.kind === "task" ? "assessment" : draft.kind,
  );

  return (
    <div className="flex flex-col gap-4">
      {!locked ? (
        <Segmented
          label="Entry type"
          value={kind}
          onChange={setKind}
          options={KIND_OPTIONS}
          stretch
        />
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
    </div>
  );
}

function TimeRange({
  allDay,
  startName = "start_time",
  endName = "end_time",
  startDefault,
  endDefault,
  required,
}: {
  allDay: boolean;
  startName?: string;
  endName?: string;
  startDefault: string;
  endDefault: string;
  required?: boolean;
}) {
  if (allDay) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Starts" htmlFor={startName}>
        <Input id={startName} name={startName} type="time" required={required} defaultValue={startDefault} />
      </Field>
      <Field label="Ends" htmlFor={endName}>
        <Input id={endName} name={endName} type="time" required={required} defaultValue={endDefault} />
      </Field>
    </div>
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
  const [subjectId, setSubjectId] = useState(
    existing?.subject_id ?? draft.defaultSubjectId ?? "",
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Title" htmlFor="a-title">
        <Input
          id="a-title"
          name="title"
          required
          maxLength={120}
          placeholder="Midterm 2"
          defaultValue={existing?.title ?? draft.defaultTitle ?? ""}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <Field label="Type" htmlFor="assessment_type">
          <NativeSelect
            id="assessment_type"
            name="assessment_type"
            defaultValue={existing?.assessment_type ?? draft.defaultAssessmentType ?? "final"}
          >
            {ASSESSMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSESSMENT_TYPE_META[t].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Date" htmlFor="a-date">
          <Input
            id="a-date"
            name="date"
            type="date"
            required
            defaultValue={existing ? toLocalDateInput(existing.starts_at) : draft.date}
          />
        </Field>
      </div>
      <SwitchRow
        name="all_day"
        label="All day"
        checked={allDay}
        onChange={setAllDay}
      />
      {allDay ? <input type="hidden" name="all_day" value="true" /> : null}
      <TimeRange
        allDay={allDay}
        startDefault={
          existing && !existing.all_day
            ? toLocalTimeInput(existing.starts_at)
            : draft.startTime || "09:00"
        }
        endDefault={
          existing?.ends_at && !existing.all_day
            ? toLocalTimeInput(existing.ends_at)
            : draft.endTime || "10:00"
        }
      />
      {subjects.length > 0 ? (
        <Field label="Subject">
          <SubjectPicker
            name="subject_id"
            subjects={subjects}
            value={subjectId}
            onChange={setSubjectId}
          />
        </Field>
      ) : (
        <input type="hidden" name="subject_id" value="" />
      )}
      <MoreOptions
        label="More details"
        defaultOpen={Boolean(
          existing?.location || existing?.description || existing?.completed,
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Location" htmlFor="a-location" optional>
            <Input id="a-location" name="location" maxLength={200} defaultValue={existing?.location ?? ""} />
          </Field>
          <Field label="Priority" htmlFor="a-priority">
            <NativeSelect id="a-priority" name="priority" defaultValue={existing?.priority ?? "medium"}>
              {PRIORITY_LEVELS.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Description" htmlFor="a-description" optional>
          <Textarea id="a-description" name="description" rows={3} defaultValue={existing?.description ?? ""} />
        </Field>
        <SwitchRow
          name="completed"
          label="Mark as done"
          defaultChecked={existing?.completed ?? false}
        />
      </MoreOptions>
      <FormError message={state.error} />
      <PrimaryActions>
        {existing ? (
          <DeleteButton
            label="Delete this exam or deadline"
            onDelete={() => deleteAssessment(existing.id)}
            onDone={onDone}
          />
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Create"}
        </Button>
      </PrimaryActions>
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
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Title" htmlFor="p-title">
        <Input
          id="p-title"
          name="title"
          required
          maxLength={120}
          placeholder="Dentist"
          defaultValue={existing?.title ?? draft.defaultTitle ?? ""}
        />
      </Field>
      <Field label="Date" htmlFor="p-date">
        <Input
          id="p-date"
          name="date"
          type="date"
          required
          defaultValue={existing ? toLocalDateInput(existing.starts_at) : draft.date}
        />
      </Field>
      <SwitchRow name="all_day" label="All day" checked={allDay} onChange={setAllDay} />
      {allDay ? <input type="hidden" name="all_day" value="true" /> : null}
      <TimeRange
        allDay={allDay}
        startDefault={
          existing && !existing.all_day
            ? toLocalTimeInput(existing.starts_at)
            : draft.startTime || "12:00"
        }
        endDefault={
          existing?.ends_at && !existing.all_day
            ? toLocalTimeInput(existing.ends_at)
            : draft.endTime || "13:00"
        }
      />
      <MoreOptions label="Notes" defaultOpen={Boolean(existing?.description)}>
        <Field label="Notes" htmlFor="p-description" optional>
          <Textarea id="p-description" name="description" rows={3} defaultValue={existing?.description ?? ""} />
        </Field>
      </MoreOptions>
      <FormError message={state.error} />
      <PrimaryActions>
        {existing ? (
          <DeleteButton
            label="Delete this event"
            onDelete={() => deletePersonalEvent(existing.id)}
            onDone={onDone}
          />
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Create"}
        </Button>
      </PrimaryActions>
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
  const [subjectId, setSubjectId] = useState(
    existing?.subject_id ?? draft.defaultSubjectId ?? "",
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  const filteredTopics = topics.filter((t) =>
    subjectId ? t.subject_id === subjectId : true,
  );
  const openTasks = tasks.filter(
    (t) => t.status === "todo" || t.id === existing?.task_id,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {subjects.length > 0 ? (
        <Field label="Subject">
          <SubjectPicker
            name="subject_id"
            subjects={subjects}
            value={subjectId}
            onChange={setSubjectId}
          />
        </Field>
      ) : (
        <input type="hidden" name="subject_id" value="" />
      )}
      <Field label="Date" htmlFor="s-date">
        <Input
          id="s-date"
          name="date"
          type="date"
          required
          defaultValue={existing ? toLocalDateInput(existing.starts_at) : draft.date}
        />
      </Field>
      <TimeRange
        allDay={false}
        required
        startDefault={existing ? toLocalTimeInput(existing.starts_at) : draft.startTime || "10:00"}
        endDefault={
          existing?.ends_at ? toLocalTimeInput(existing.ends_at) : draft.endTime || "11:00"
        }
      />
      <Field label="Status" htmlFor="s-status">
        <NativeSelect id="s-status" name="status" defaultValue={existing?.status ?? "planned"}>
          {STUDY_SESSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STUDY_SESSION_STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <MoreOptions
        label="Topic, task and notes"
        defaultOpen={Boolean(
          existing?.topic_id || existing?.task_id || existing?.notes || draft.defaultTopicId || draft.defaultTitle,
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Topic" htmlFor="s-topic" optional>
            <NativeSelect
              id="s-topic"
              name="topic_id"
              defaultValue={existing?.topic_id ?? draft.defaultTopicId ?? ""}
            >
              <option value="">None</option>
              {filteredTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.parent_id ? "↳ " : ""}
                  {t.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Linked task" htmlFor="s-task" optional>
            <NativeSelect id="s-task" name="task_id" defaultValue={existing?.task_id ?? ""}>
              <option value="">None</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Notes" htmlFor="s-notes" optional>
          <Textarea
            id="s-notes"
            name="notes"
            rows={2}
            defaultValue={existing?.notes ?? draft.defaultTitle ?? ""}
          />
        </Field>
      </MoreOptions>
      <FormError message={state.error} />
      <PrimaryActions>
        {existing ? (
          <DeleteButton
            label="Delete this study session"
            onDelete={() => deleteStudySession(existing.id)}
            onDone={onDone}
          />
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Create"}
        </Button>
      </PrimaryActions>
    </form>
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
      variant="destructive"
      className="mr-auto"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`${label}?`)) return;
        setPending(true);
        const result = await onDelete();
        setPending(false);
        if (!result.error) onDone();
      }}
    >
      <Trash2 aria-hidden />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}

