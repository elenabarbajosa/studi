"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createTopic,
  deleteTopic,
  reorderTopics,
  updateTopic,
  updateTopicStatus,
  type ActionState,
} from "@/actions/topics";
import { FormError } from "@/components/studi/form-controls";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TOPIC_STATUS_META,
  TOPIC_STATUSES,
  topicProgressSummary,
  type TopicStatus,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Topic } from "@/types/database";

const initial: ActionState = {};

export const TOPIC_STATUS_STYLE: Record<
  TopicStatus,
  { icon: React.ComponentType<{ className?: string }>; icon_cls: string; pill: string }
> = {
  not_started: { icon: Circle, icon_cls: "text-ink-3", pill: "bg-sunken text-ink-2" },
  studying: { icon: CircleDashed, icon_cls: "text-accent-text", pill: "bg-accent-soft text-accent-text" },
  practicing: { icon: CircleDot, icon_cls: "text-warning", pill: "bg-warning-soft text-warning" },
  mastered: { icon: CircleCheck, icon_cls: "text-success", pill: "bg-success-soft text-success" },
};

const iconButton =
  "flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] data-popup-open:bg-sunken";

type TopicsPanelProps = {
  subjectId: string;
  topics: Topic[];
};

export function TopicsPanel({ subjectId, topics }: TopicsPanelProps) {
  const roots = useMemo(() => topics.filter((t) => t.parent_id === null), [topics]);
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
  const summary = topicProgressSummary(topics);
  const [isPending, startTransition] = useTransition();

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
    <section aria-labelledby="topics-title" className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pb-2">
        <h2 id="topics-title" className="sr-only">
          Topics
        </h2>
        {summary.total > 0 ? (
          <p className="text-[12.5px] text-ink-2">
            {summary.mastered} of {summary.total} mastered · progress counts top-level topics
          </p>
        ) : null}
      </div>

      {roots.length === 0 ? (
        <EmptyPanel
          compact
          icon={ListTree}
          title="No topics yet"
          body="Add the first chapter of the syllabus. Subtopics can go underneath it."
        />
      ) : (
        <ul className={cn(isPending && "opacity-70")}>
          {roots.map((topic, index) => (
            <TopicItem
              key={topic.id}
              subjectId={subjectId}
              topic={topic}
              subtopics={childrenByParent.get(topic.id) ?? []}
              onMoveUp={index > 0 ? () => moveRoot(topic.id, -1) : undefined}
              onMoveDown={index < roots.length - 1 ? () => moveRoot(topic.id, 1) : undefined}
            />
          ))}
        </ul>
      )}

      <AddTopicInline subjectId={subjectId} parentId={null} label="Add topic" />
    </section>
  );
}

function StatusIcon({ status, className }: { status: TopicStatus; className?: string }) {
  const { icon: Icon, icon_cls } = TOPIC_STATUS_STYLE[status];
  return <Icon className={cn("size-4 shrink-0", icon_cls, className)} aria-hidden />;
}

function StatusMenu({ subjectId, topic }: { subjectId: string; topic: Topic }) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<TopicStatus | null>(null);
  const status = optimistic ?? topic.status;

  const change = (next: TopicStatus) => {
    if (next === topic.status) return;
    setOptimistic(next);
    startTransition(async () => {
      const result = await updateTopicStatus(subjectId, topic.id, next);
      if (result.error) toast.error(result.error);
      setOptimistic(null);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        aria-label={`Status of “${topic.title}”: ${TOPIC_STATUS_META[status].label}. Change status`}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-full pr-2 pl-2.5 text-[11.5px] font-semibold outline-none transition-[filter] hover:brightness-95 focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-60 dark:hover:brightness-110",
          TOPIC_STATUS_STYLE[status].pill,
        )}
      >
        {TOPIC_STATUS_META[status].label}
        <ChevronDown className="size-3 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => change(v as TopicStatus)}>
          {TOPIC_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s} closeOnClick>
              <StatusIcon status={s} />
              {TOPIC_STATUS_META[s].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopicItem({
  subjectId,
  topic,
  subtopics,
  onMoveUp,
  onMoveDown,
}: {
  subjectId: string;
  topic: Topic;
  subtopics?: Topic[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const isChild = topic.parent_id !== null;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const remove = () => {
    const extra = !isChild && subtopics?.length ? " and its subtopics" : "";
    if (!confirm(`Delete “${topic.title}”${extra}?`)) return;
    startTransition(async () => {
      const result = await deleteTopic(subjectId, topic.id);
      if (result.error) toast.error(result.error);
    });
  };

  return (
    <li className={cn(isPending && "opacity-60")}>
      {editing ? (
        <EditTopicForm subjectId={subjectId} topic={topic} onDone={() => setEditing(false)} />
      ) : (
        <div
          className={cn(
            "flex min-h-[46px] items-center gap-2.5 border-b border-hairline",
            isChild && "min-h-10 pl-[26px]",
          )}
        >
          <StatusIcon status={topic.status} />
          <div className="min-w-0 flex-1 py-2">
            <p
              className={cn(
                "break-words",
                isChild ? "text-[13.5px] text-ink-2" : "text-[14.5px] font-medium text-ink",
              )}
            >
              {topic.title}
            </p>
            {topic.notes ? (
              <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{topic.notes}</p>
            ) : null}
          </div>
          <StatusMenu subjectId={subjectId} topic={topic} />
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(iconButton, "-mr-1.5")} aria-label={`Actions for “${topic.title}”`}>
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              {!isChild ? (
                <DropdownMenuItem onClick={() => setAdding(true)}>
                  <Plus aria-hidden />
                  Add subtopic
                </DropdownMenuItem>
              ) : null}
              {onMoveUp || onMoveDown ? <DropdownMenuSeparator /> : null}
              {onMoveUp ? (
                <DropdownMenuItem onClick={onMoveUp}>
                  <ArrowUp aria-hidden />
                  Move up
                </DropdownMenuItem>
              ) : null}
              {onMoveDown ? (
                <DropdownMenuItem onClick={onMoveDown}>
                  <ArrowDown aria-hidden />
                  Move down
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
      )}

      {subtopics && subtopics.length > 0 ? (
        <ul>
          {subtopics.map((child) => (
            <TopicItem key={child.id} subjectId={subjectId} topic={child} />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddTopicInline
          subjectId={subjectId}
          parentId={topic.id}
          label={`Add subtopic to ${topic.title}`}
          autoFocus
          onClose={() => setAdding(false)}
        />
      ) : null}
    </li>
  );
}

function EditTopicForm({
  subjectId,
  topic,
  onDone,
}: {
  subjectId: string;
  topic: Topic;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateTopic.bind(null, subjectId, topic.id),
    initial,
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form
      action={formAction}
      className={cn(
        "my-2 flex flex-col gap-2.5 rounded-[16px] bg-sunken p-3",
        topic.parent_id && "ml-[26px]",
      )}
    >
      <input type="hidden" name="status" value={topic.status} />
      <Input name="title" defaultValue={topic.title} required maxLength={200} aria-label="Topic title" autoFocus />
      <Textarea
        name="notes"
        defaultValue={topic.notes ?? ""}
        rows={2}
        placeholder="Notes (optional)"
        aria-label="Notes"
      />
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function AddTopicInline({
  subjectId,
  parentId,
  label,
  autoFocus,
  onClose,
}: {
  subjectId: string;
  parentId: string | null;
  label: string;
  autoFocus?: boolean;
  onClose?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createTopic.bind(null, subjectId), initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={cn(
        "flex min-h-11 items-center gap-2.5 border-b border-hairline",
        parentId && "pl-[26px]",
      )}
    >
      <input type="hidden" name="parent_id" value={parentId ?? ""} />
      <Plus className="size-4 shrink-0 text-ink-3" aria-hidden />
      <input
        name="title"
        required
        maxLength={200}
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={parentId ? "Add subtopic" : "Add topic"}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onClose) onClose();
        }}
        className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
      />
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-medium text-ink-2 outline-none hover:bg-sunken focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          Done
        </button>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold text-accent-text outline-none hover:bg-sunken focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
