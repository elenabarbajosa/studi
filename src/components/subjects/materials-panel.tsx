"use client";

import { useActionState, useTransition } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMaterial,
  deleteMaterial,
  type ActionState,
} from "@/actions/materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RESOURCE_TYPE_META,
  RESOURCE_TYPES,
} from "@/lib/subjects";
import type { Material, Topic } from "@/types/database";

const initial: ActionState = {};

type MaterialsPanelProps = {
  subjectId: string;
  materials: Material[];
  topics: Topic[];
};

export function MaterialsPanel({
  subjectId,
  materials,
  topics,
}: MaterialsPanelProps) {
  const [state, formAction, pending] = useActionState(
    createMaterial.bind(null, subjectId),
    initial,
  );
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl tracking-tight">Materials</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organize external study resources by subject. File uploads will arrive
          in a later phase — for now, use links.
        </p>
      </div>

      <div className="space-y-2">
        {materials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            No materials yet. Add a syllabus link, lecture recording, or reading.
          </div>
        ) : (
          materials.map((material) => (
            <div
              key={material.id}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{material.title}</p>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {RESOURCE_TYPE_META[material.resource_type].label}
                  </span>
                </div>
                {material.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {material.description}
                  </p>
                ) : null}
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                >
                  Open resource
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Remove “${material.title}”?`)) return;
                  startTransition(async () => {
                    const result = await deleteMaterial(subjectId, material.id);
                    if (result.error) toast.error(result.error);
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <form
        action={formAction}
        className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
      >
        <p className="text-sm font-medium">Add material</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Week 3 slides" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource_type">Type</Label>
            <select
              id="resource_type"
              name="resource_type"
              defaultValue="link"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {RESOURCE_TYPE_META[type].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="topic_id">Associated topic (optional)</Label>
          <select
            id="topic_id"
            name="topic_id"
            defaultValue=""
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Whole subject</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.parent_id ? "↳ " : ""}
                {topic.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={2} />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending} className="gap-2">
          <Plus className="size-4" />
          Add material
        </Button>
      </form>
    </div>
  );
}
