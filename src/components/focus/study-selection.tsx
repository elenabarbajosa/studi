"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Tile, TileHeader } from "@/components/dashboard/tile";
import { Field, NativeSelect } from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { SubjectChip, SubjectDot, SubjectPicker } from "@/components/studi/subject-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Subject, Task, Topic } from "@/types/database";

type StudySelectionProps = {
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  subjectId: string;
  topicId: string;
  taskId: string;
  goal: string;
  locked: boolean;
  onSubjectChange: (id: string) => void;
  onTopicChange: (id: string) => void;
  onTaskChange: (id: string) => void;
  onGoalChange: (goal: string) => void;
  className?: string;
};

export function StudySelection({
  subjects,
  topics,
  tasks,
  subjectId,
  topicId,
  taskId,
  goal,
  locked,
  onSubjectChange,
  onTopicChange,
  onTaskChange,
  onGoalChange,
  className,
}: StudySelectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const subject = subjects.find((s) => s.id === subjectId);
  const topic = topics.find((t) => t.id === topicId);
  const task = tasks.find((t) => t.id === taskId);

  const filteredTopics = topics.filter((t) =>
    subjectId ? t.subject_id === subjectId : true,
  );
  const filteredTasks = tasks.filter(
    (t) =>
      t.status === "todo" &&
      (subjectId ? t.subject_id === subjectId || !t.subject_id : true),
  );

  const form = (
    <StudySelectionForm
      subjects={subjects}
      filteredTopics={filteredTopics}
      filteredTasks={filteredTasks}
      subjectId={subjectId}
      topicId={topicId}
      taskId={taskId}
      goal={goal}
      onSubjectChange={onSubjectChange}
      onTopicChange={onTopicChange}
      onTaskChange={onTaskChange}
      onGoalChange={onGoalChange}
    />
  );

  return (
    <>
      {/* Mobile: compact summary → sheet */}
      <Tile className={cn("p-4 md:hidden", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">Studying</p>
            <dl className="mt-2.5 space-y-1.5 text-[13px]">
              <SummaryRow
                label="Subject"
                value={
                  subject ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 font-semibold text-ink">
                      <SubjectDot color={subject.color} />
                      <span className="truncate">{subject.name}</span>
                    </span>
                  ) : (
                    "None"
                  )
                }
              />
              <SummaryRow label="Topic" value={topic?.title ?? "None"} />
              <SummaryRow label="Task" value={task?.title ?? "None"} />
              <SummaryRow
                label="Goal"
                value={goal.trim() ? goal.trim() : "None"}
              />
            </dl>
            {locked ? (
              <p className="mt-2 text-[12px] text-ink-3">
                Locked while this session runs.
              </p>
            ) : null}
          </div>
          {!locked ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-full"
              onClick={() => setSheetOpen(true)}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          ) : null}
        </div>
      </Tile>

      {/* Desktop: full compact panel */}
      <Tile className={cn("hidden p-5 md:block", className)}>
        <TileHeader title="What are you studying?" />
        {locked ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {subject ? (
                <SubjectChip name={subject.name} color={subject.color} />
              ) : (
                <SubjectChip name="No subject" color={null} />
              )}
              {topic ? (
                <span className="text-[13.5px] text-ink-2">{topic.title}</span>
              ) : null}
            </div>
            {goal.trim() ? (
              <p className="text-[13.5px] text-ink-2">Goal: {goal.trim()}</p>
            ) : null}
            <p className="text-[13px] text-ink-3">
              Locked while this session runs. Finish or reset to change it.
            </p>
          </div>
        ) : (
          <div className="mt-3">{form}</div>
        )}
      </Tile>

      <ResponsiveDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="What are you studying?"
        description="Optional — you can start without tagging a subject."
        footer={
          <Button type="button" className="w-full" onClick={() => setSheetOpen(false)}>
            Done
          </Button>
        }
      >
        {form}
      </ResponsiveDialog>
    </>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-14 shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-ink-2">{value}</dd>
    </div>
  );
}

function StudySelectionForm({
  subjects,
  filteredTopics,
  filteredTasks,
  subjectId,
  topicId,
  taskId,
  goal,
  onSubjectChange,
  onTopicChange,
  onTaskChange,
  onGoalChange,
}: {
  subjects: Subject[];
  filteredTopics: Topic[];
  filteredTasks: Task[];
  subjectId: string;
  topicId: string;
  taskId: string;
  goal: string;
  onSubjectChange: (id: string) => void;
  onTopicChange: (id: string) => void;
  onTaskChange: (id: string) => void;
  onGoalChange: (goal: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SubjectPicker
        subjects={subjects}
        value={subjectId}
        onChange={(id) => {
          onSubjectChange(id);
          onTopicChange("");
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Topic" htmlFor="focus-topic" optional>
          <NativeSelect
            id="focus-topic"
            value={topicId}
            onChange={(e) => onTopicChange(e.target.value)}
          >
            <option value="">None</option>
            {filteredTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Linked task" htmlFor="focus-task" optional>
          <NativeSelect
            id="focus-task"
            value={taskId}
            onChange={(e) => onTaskChange(e.target.value)}
          >
            <option value="">None</option>
            {filteredTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Study goal" htmlFor="focus-goal" optional>
        <Input
          id="focus-goal"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="e.g. Finish chapter 3 notes"
          maxLength={200}
        />
      </Field>
    </div>
  );
}
