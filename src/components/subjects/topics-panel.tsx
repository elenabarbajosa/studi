"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
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
  Sparkles,
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
import { ImportSyllabusDialog } from "@/components/subjects/import-syllabus/import-syllabus-dialog";
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
  type TopicStatus,
} from "@/lib/subjects";
import {
  childrenByParentId,
  effectiveStatusByTopicId,
  topicHasChildren,
  topicProgressSummary,
} from "@/lib/topic-progress";
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
  subjectName: string;
  topics: Topic[];
  dailyAiLimit: number;
};

export function TopicsPanel({ subjectId, subjectName, topics, dailyAiLimit }: TopicsPanelProps) {
  const router = useRouter();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TopicStatus>>({});
  // Optimistic leaf edits; once server props match, the override is a no-op.
  const resolvedTopics = useMemo(
    () =>
      topics.map((t) => {
        const override = statusOverrides[t.id];
        if (!override || override === t.status) return t;
        return { ...t, status: override };
      }),
    [topics, statusOverrides],
  );

  const roots = useMemo(
    () => resolvedTopics.filter((t) => t.parent_id === null),
    [resolvedTopics],
  );
  const childrenByParent = useMemo(
    () => childrenByParentId(resolvedTopics),
    [resolvedTopics],
  );
  const effective = useMemo(
    () => effectiveStatusByTopicId(resolvedTopics),
    [resolvedTopics],
  );
  const summary = topicProgressSummary(resolvedTopics);
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

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
      else router.refresh();
    });
  }

  function onStatusChange(topicId: string, next: TopicStatus) {
    setStatusOverrides((prev) => ({ ...prev, [topicId]: next }));
    startTransition(async () => {
      const result = await updateTopicStatus(subjectId, topicId, next);
      if (result.error) {
        toast.error(result.error);
        setStatusOverrides((prev) => {
          const copy = { ...prev };
          delete copy[topicId];
          return copy;
        });
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="topics-title" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-2">
        <div className="min-w-0">
          <h2 id="topics-title" className="sr-only">
            Topics
          </h2>
          {summary.total > 0 ? (
            <p className="text-[12.5px] text-ink-2">
              {summary.mastered} of {summary.total} mastered · top-level topics; parents
              follow their children
            </p>
          ) : (
            <p className="text-[12.5px] text-ink-2">Build the syllabus manually or import with AI.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-8"
        >
          <Sparkles className="size-[15px] text-accent-text" aria-hidden />
          Import with AI
        </button>
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
              depth={0}
              childrenByParent={childrenByParent}
              effectiveById={effective}
              onStatusChange={onStatusChange}
              onMoveUp={index > 0 ? () => moveRoot(topic.id, -1) : undefined}
              onMoveDown={index < roots.length - 1 ? () => moveRoot(topic.id, 1) : undefined}
              onTreeChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      <AddTopicInline
        subjectId={subjectId}
        parentId={null}
        label="Add topic"
        onCreated={() => router.refresh()}
      />

      <ImportSyllabusDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        subjectId={subjectId}
        subjectName={subjectName}
        dailyAiLimit={dailyAiLimit}
      />
    </section>
  );
}

function StatusIcon({ status, className }: { status: TopicStatus; className?: string }) {
  const { icon: Icon, icon_cls } = TOPIC_STATUS_STYLE[status];
  return <Icon className={cn("size-4 shrink-0", icon_cls, className)} aria-hidden />;
}

function StatusMenu({
  topic,
  effectiveStatus,
  derived,
  onChange,
}: {
  topic: Topic;
  effectiveStatus: TopicStatus;
  derived: boolean;
  onChange: (next: TopicStatus) => void;
}) {
  if (derived) {
    return (
      <span
        title="Status follows subtopics"
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-full pr-2.5 pl-2.5 text-[11.5px] font-semibold",
          TOPIC_STATUS_STYLE[effectiveStatus].pill,
        )}
      >
        {TOPIC_STATUS_META[effectiveStatus].label}
        <span className="text-[10px] font-medium opacity-70">Auto</span>
      </span>
    );
  }

  const change = (next: TopicStatus) => {
    if (next === topic.status) return;
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Status of “${topic.title}”: ${TOPIC_STATUS_META[effectiveStatus].label}. Change status`}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1 rounded-full pr-2 pl-2.5 text-[11.5px] font-semibold outline-none transition-[filter] hover:brightness-95 focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-60 dark:hover:brightness-110",
          TOPIC_STATUS_STYLE[effectiveStatus].pill,
        )}
      >
        {TOPIC_STATUS_META[effectiveStatus].label}
        <ChevronDown className="size-3 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup
          value={effectiveStatus}
          onValueChange={(v) => change(v as TopicStatus)}
        >
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
  depth,
  childrenByParent,
  effectiveById,
  onStatusChange,
  onMoveUp,
  onMoveDown,
  onTreeChanged,
}: {
  subjectId: string;
  topic: Topic;
  depth: number;
  childrenByParent: Map<string, Topic[]>;
  effectiveById: Map<string, TopicStatus>;
  onStatusChange: (topicId: string, next: TopicStatus) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onTreeChanged: () => void;
}) {
  const isChild = topic.parent_id !== null;
  const subtopics = childrenByParent.get(topic.id) ?? [];
  const derived = topicHasChildren(topic.id, childrenByParent);
  const effectiveStatus = effectiveById.get(topic.id) ?? topic.status;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const remove = () => {
    const extra = derived ? " and its subtopics" : "";
    if (!confirm(`Delete “${topic.title}”${extra}?`)) return;
    startTransition(async () => {
      const result = await deleteTopic(subjectId, topic.id);
      if (result.error) toast.error(result.error);
      else onTreeChanged();
    });
  };

  return (
    <li className={cn(isPending && "opacity-60")}>
      {editing ? (
        <EditTopicForm
          subjectId={subjectId}
          topic={topic}
          onDone={() => {
            setEditing(false);
            onTreeChanged();
          }}
        />
      ) : (
        <div
          className={cn(
            "flex min-h-[46px] items-center gap-2.5 border-b border-hairline",
            isChild && "min-h-10",
          )}
          style={depth > 0 ? { paddingLeft: 26 + (depth - 1) * 18 } : undefined}
        >
          <StatusIcon status={effectiveStatus} />
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
          <StatusMenu
            topic={topic}
            effectiveStatus={effectiveStatus}
            derived={derived}
            onChange={(next) => onStatusChange(topic.id, next)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(iconButton, "-mr-1.5")} aria-label={`Actions for “${topic.title}”`}>
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAdding(true)}>
                <Plus aria-hidden />
                Add subtopic
              </DropdownMenuItem>
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

      {subtopics.length > 0 ? (
        <ul>
          {subtopics.map((child) => (
            <TopicItem
              key={child.id}
              subjectId={subjectId}
              topic={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              effectiveById={effectiveById}
              onStatusChange={onStatusChange}
              onTreeChanged={onTreeChanged}
            />
          ))}
        </ul>
      ) : null}

      {adding ? (
        <AddTopicInline
          subjectId={subjectId}
          parentId={topic.id}
          label={`Add subtopic to ${topic.title}`}
          autoFocus
          depth={depth + 1}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            onTreeChanged();
          }}
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
  depth = 0,
  onClose,
  onCreated,
}: {
  subjectId: string;
  parentId: string | null;
  label: string;
  autoFocus?: boolean;
  depth?: number;
  onClose?: () => void;
  onCreated?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createTopic.bind(null, subjectId), initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onCreated?.();
    }
    if (state.error) toast.error(state.error);
    // Intentionally depend on action state only — onCreated is a refresh callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex min-h-11 items-center gap-2.5 border-b border-hairline"
      style={parentId ? { paddingLeft: 26 + Math.max(depth - 1, 0) * 18 } : undefined}
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
