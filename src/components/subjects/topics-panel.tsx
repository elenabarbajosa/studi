"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createTopic,
  deleteTopic,
  reorderTopics,
  updateTopic,
  updateTopicStatus,
  type ActionState,
} from "@/actions/topics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TOPIC_STATUS_META,
  TOPIC_STATUSES,
  type TopicStatus,
} from "@/lib/subjects";
import type { Topic } from "@/types/database";

const initial: ActionState = {};

type TopicsPanelProps = {
  subjectId: string;
  topics: Topic[];
};

export function TopicsPanel({ subjectId, topics }: TopicsPanelProps) {
  const roots = useMemo(
    () => topics.filter((t) => t.parent_id === null),
    [topics],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Topic[]>();
    for (const topic of topics) {
      if (!topic.parent_id) continue;
      const list = map.get(topic.parent_id) ?? [];
      list.push(topic);
      map.set(topic.parent_id, list);
    }
    return map;
  }, [topics]);

  const [createState, createAction, createPending] = useActionState(
    createTopic.bind(null, subjectId),
    initial,
  );
  const [isPending, startTransition] = useTransition();
  const [parentForNew, setParentForNew] = useState<string>("");

  function moveRoot(topicId: string, direction: -1 | 1) {
    const ids = roots.map((t) => t.id);
    const index = ids.indexOf(topicId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    const ordered = [...ids];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    startTransition(async () => {
      const result = await reorderTopics(subjectId, ordered);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl tracking-tight">
          Topics & checklist
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Build a hierarchy of topics and subtopics. Progress uses real status
          only — nothing is invented.
        </p>
      </div>

      <div className="space-y-3">
        {roots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No topics yet. Add your first syllabus section below.
          </div>
        ) : (
          roots.map((topic, index) => (
            <TopicRow
              key={topic.id}
              subjectId={subjectId}
              topic={topic}
              subtopics={childrenByParent.get(topic.id) ?? []}
              canMoveUp={index > 0}
              canMoveDown={index < roots.length - 1}
              onMoveUp={() => moveRoot(topic.id, -1)}
              onMoveDown={() => moveRoot(topic.id, 1)}
              disabled={isPending}
            />
          ))
        )}
      </div>

      <form
        action={createAction}
        className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
      >
        <p className="text-sm font-medium">Add topic or subtopic</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Derivatives" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent_id">Parent topic</Label>
            <select
              id="parent_id"
              name="parent_id"
              value={parentForNew}
              onChange={(e) => setParentForNew(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">Top-level topic</option>
              {roots.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  Under: {topic.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
        {createState.error ? (
          <p className="text-sm text-destructive">{createState.error}</p>
        ) : null}
        <Button type="submit" disabled={createPending} className="gap-2">
          <Plus className="size-4" />
          Add
        </Button>
      </form>
    </div>
  );
}

function TopicRow({
  subjectId,
  topic,
  subtopics,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  subjectId: string;
  topic: Topic;
  subtopics: Topic[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateTopic.bind(null, subjectId, topic.id),
    initial,
  );
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form action={formAction} className="space-y-3">
              <Input name="title" defaultValue={topic.title} required />
              <Textarea
                name="notes"
                defaultValue={topic.notes ?? ""}
                rows={2}
                placeholder="Optional notes"
              />
              <input type="hidden" name="status" value={topic.status} />
              {state.error ? (
                <p className="text-sm text-destructive">{state.error}</p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <button
                type="button"
                className="text-left font-medium hover:underline"
                onClick={() => setEditing(true)}
              >
                {topic.title}
              </button>
              {topic.notes ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {topic.notes}
                </p>
              ) : null}
            </>
          )}
        </div>

        <select
          value={topic.status}
          disabled={disabled || isPending}
          onChange={(e) => {
            const status = e.target.value as TopicStatus;
            startTransition(async () => {
              const result = await updateTopicStatus(
                subjectId,
                topic.id,
                status,
              );
              if (result.error) toast.error(result.error);
            });
          }}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
        >
          {TOPIC_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TOPIC_STATUS_META[status].label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!canMoveUp || disabled}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={!canMoveDown || disabled}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={disabled || isPending}
            onClick={() => {
              if (!confirm(`Delete “${topic.title}” and its subtopics?`)) return;
              startTransition(async () => {
                const result = await deleteTopic(subjectId, topic.id);
                if (result.error) toast.error(result.error);
              });
            }}
            aria-label="Delete topic"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {subtopics.length > 0 ? (
        <ul className="mt-3 space-y-2 border-l border-border pl-4">
          {subtopics.map((child) => (
            <li key={child.id}>
              <SubtopicRow subjectId={subjectId} topic={child} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubtopicRow({
  subjectId,
  topic,
}: {
  subjectId: string;
  topic: Topic;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <span className="min-w-0 flex-1 text-sm">{topic.title}</span>
      <select
        value={topic.status}
        disabled={isPending}
        onChange={(e) => {
          const status = e.target.value as TopicStatus;
          startTransition(async () => {
            const result = await updateTopicStatus(subjectId, topic.id, status);
            if (result.error) toast.error(result.error);
          });
        }}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
      >
        {TOPIC_STATUSES.map((status) => (
          <option key={status} value={status}>
            {TOPIC_STATUS_META[status].label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Delete “${topic.title}”?`)) return;
          startTransition(async () => {
            const result = await deleteTopic(subjectId, topic.id);
            if (result.error) toast.error(result.error);
          });
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
