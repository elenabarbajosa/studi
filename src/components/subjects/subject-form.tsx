"use client";

import { useActionState } from "react";

import {
  createSubject,
  updateSubject,
  type ActionState,
} from "@/actions/subjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SUBJECT_COLOR_META,
  SUBJECT_COLORS,
  type SubjectColor,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";
import { useState } from "react";

const initial: ActionState = {};

type SubjectFormProps = {
  subject?: Subject;
  onCancel?: () => void;
};

export function SubjectForm({ subject, onCancel }: SubjectFormProps) {
  const action = subject
    ? updateSubject.bind(null, subject.id)
    : createSubject;
  const [state, formAction, pending] = useActionState(action, initial);
  const [color, setColor] = useState<SubjectColor>(subject?.color ?? "pink");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={subject?.name ?? ""}
          placeholder="Linear Algebra"
        />
      </div>

      <input type="hidden" name="color" value={color} />
      <div>
        <p className="mb-2 text-sm font-medium">Color</p>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "size-7 rounded-full border-2",
                color === c ? "border-foreground" : "border-transparent",
              )}
              style={{ background: SUBJECT_COLOR_META[c].swatch }}
              aria-label={SUBJECT_COLOR_META[c].label}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="difficulty">Difficulty (optional)</Label>
        <select
          id="difficulty"
          name="difficulty"
          defaultValue={subject?.difficulty ?? ""}
          className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">None</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={subject?.description ?? ""}
          placeholder="What this course covers…"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-primary" role="status">
          {state.success}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : subject
              ? "Save changes"
              : "Create subject"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
