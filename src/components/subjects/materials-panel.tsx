"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  File,
  FileText,
  Link2,
  Newspaper,
  NotebookPen,
  Paperclip,
  PlayCircle,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { getMaterialSignedUrl } from "@/actions/canvas-import";
import { createMaterial, deleteMaterial, type ActionState } from "@/actions/materials";
import { ImportCanvasDialog } from "@/components/subjects/import-canvas/import-canvas-dialog";
import { Field, FormError, NativeSelect, PrimaryActions } from "@/components/studi/form-controls";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RESOURCE_TYPE_META, RESOURCE_TYPES, type ResourceType } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Material, Topic } from "@/types/database";

const initial: ActionState = {};

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  link: Link2,
  pdf: FileText,
  video: PlayCircle,
  article: Newspaper,
  notes: NotebookPen,
  other: File,
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function materialSubtitle(material: Material) {
  const typeLabel = RESOURCE_TYPE_META[material.resource_type].label;
  if (material.url) {
    return `${typeLabel} · ${hostOf(material.url)}${
      material.description ? ` · ${material.description}` : ""
    }`;
  }
  if (material.original_filename) {
    return `${typeLabel} · ${material.original_filename}${
      material.description ? ` · ${material.description}` : ""
    }`;
  }
  return `${typeLabel}${material.description ? ` · ${material.description}` : ""}`;
}

/** Roots in position order, each followed by its subtopics. */
function topicTree(topics: Topic[]) {
  return topics
    .filter((t) => t.parent_id === null)
    .flatMap((root) => [root, ...topics.filter((t) => t.parent_id === root.id)]);
}

type MaterialsPanelProps = {
  subjectId: string;
  subjectName: string;
  materials: Material[];
  topics: Topic[];
};

export function MaterialsPanel({
  subjectId,
  subjectName,
  materials,
  topics,
}: MaterialsPanelProps) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const groups = useMemo(() => {
    const byTopic = new Map<string | null, Material[]>();
    for (const m of materials) {
      const key = m.topic_id && topics.some((t) => t.id === m.topic_id) ? m.topic_id : null;
      const list = byTopic.get(key) ?? [];
      list.push(m);
      byTopic.set(key, list);
    }
    const ordered: { id: string | null; title: string; items: Material[] }[] = [];
    if (byTopic.has(null)) ordered.push({ id: null, title: "Whole subject", items: byTopic.get(null)! });
    for (const t of topicTree(topics)) {
      const items = byTopic.get(t.id);
      if (items) ordered.push({ id: t.id, title: t.title, items });
    }
    return ordered;
  }, [materials, topics]);

  return (
    <section aria-labelledby="materials-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="materials-title" className="text-[15px] font-semibold text-ink">
          Materials
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-8"
          >
            <Upload className="size-[15px]" aria-hidden />
            Import from Canvas
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-8"
          >
            <Plus className="size-[15px]" aria-hidden />
            Add material
          </button>
        </div>
      </div>

      {materials.length === 0 ? (
        <EmptyPanel
          compact
          icon={Paperclip}
          title="No materials yet"
          body="Keep the syllabus, slides, recordings and readings one tap away — or import a Canvas course export."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.id ?? "subject"}>
              {groups.length > 1 || group.id ? (
                <h3 className="pb-1 text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                  {group.title}
                </h3>
              ) : null}
              <ul>
                {group.items.map((m) => (
                  <MaterialRow key={m.id} subjectId={subjectId} material={m} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ResponsiveDialog open={adding} onOpenChange={setAdding} title="Add material">
        {adding ? (
          <AddMaterialForm subjectId={subjectId} topics={topics} onDone={() => setAdding(false)} />
        ) : null}
      </ResponsiveDialog>

      <ImportCanvasDialog
        open={importing}
        onOpenChange={setImporting}
        subjectId={subjectId}
        subjectName={subjectName}
        topics={topics}
      />
    </section>
  );
}

function MaterialRow({ subjectId, material }: { subjectId: string; material: Material }) {
  const [isPending, startTransition] = useTransition();
  const Icon = TYPE_ICON[material.resource_type] ?? File;

  const openMaterial = () => {
    startTransition(async () => {
      const result = await getMaterialSignedUrl(subjectId, material.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <li className={cn("flex min-h-[58px] items-center gap-3 border-b border-hairline py-2", isPending && "opacity-60")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-ink-2">
        <Icon className="size-4" aria-hidden />
      </span>
      <button
        type="button"
        onClick={openMaterial}
        className="group/link flex min-w-0 flex-1 flex-col gap-0.5 rounded-[8px] text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
      >
        <span className="flex items-center gap-1 text-[14.5px] font-medium text-ink">
          <span className="truncate group-hover/link:underline">{material.title}</span>
          <ArrowUpRight className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </span>
        <span className="truncate text-[12.5px] text-ink-2">{materialSubtitle(material)}</span>
      </button>
      <button
        type="button"
        aria-label={`Remove “${material.title}”`}
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Remove “${material.title}”?`)) return;
          startTransition(async () => {
            const result = await deleteMaterial(subjectId, material.id);
            if (result.error) toast.error(result.error);
          });
        }}
        className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 outline-none transition-colors hover:bg-sunken hover:text-danger focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

function AddMaterialForm({
  subjectId,
  topics,
  onDone,
}: {
  subjectId: string;
  topics: Topic[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(createMaterial.bind(null, subjectId), initial);
  const options = useMemo(() => topicTree(topics), [topics]);

  useEffect(() => {
    if (state.success) {
      toast.success("Material added");
      onDone();
    }
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Title" htmlFor="material-title">
        <Input id="material-title" name="title" required maxLength={200} autoFocus placeholder="Week 3 slides" />
      </Field>
      <Field label="Link" htmlFor="material-url">
        <Input id="material-url" name="url" type="url" inputMode="url" required placeholder="https://…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="material-type">
          <NativeSelect id="material-type" name="resource_type" defaultValue="link">
            {RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {RESOURCE_TYPE_META[type].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Topic" htmlFor="material-topic" optional>
          <NativeSelect id="material-topic" name="topic_id" defaultValue="">
            <option value="">Whole subject</option>
            {options.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.parent_id ? `— ${topic.title}` : topic.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Description" htmlFor="material-description" optional>
        <Textarea id="material-description" name="description" rows={2} />
      </Field>
      <FormError message={state.error} />
      <PrimaryActions>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="min-w-28">
          {pending ? "Adding…" : "Add material"}
        </Button>
      </PrimaryActions>
    </form>
  );
}
