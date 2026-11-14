"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createSubject,
  updateSubject,
  type ActionState,
} from "@/actions/subjects";
import { SubjectColorPicker } from "@/components/subjects/color-picker";
import { Field, FormError, PrimaryActions } from "@/components/studi/form-controls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  subjectToneVars,
  type SubjectColorValue,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types/database";

const initial: ActionState = {};

const DIFFICULTY_OPTIONS = ["", "1", "2", "3", "4", "5"] as const;

type SubjectFormProps = {
  subject?: Subject;
  onCancel?: () => void;
  onDone?: () => void;
};

/** Create redirects to the new subject page; edit calls `onDone` on success. */
export function SubjectForm({ subject, onCancel, onDone }: SubjectFormProps) {
  const action = subject ? updateSubject.bind(null, subject.id) : createSubject;
  const [state, formAction, pending] = useActionState(action, initial);
  const [color, setColor] = useState<SubjectColorValue>(subject?.color ?? "teal");
  const [difficulty, setDifficulty] = useState<string>(
    subject?.difficulty ? String(subject.difficulty) : "3",
  );
  const [name, setName] = useState(subject?.name ?? "");

  useEffect(() => {
    if (state.success) onDone?.();
  }, [state.success, onDone]);

  const tone = subjectToneVars(color);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div
        className="subject-tone flex flex-col gap-1.5 rounded-[20px] p-4 transition-colors duration-200"
        style={tone as React.CSSProperties}
      >
        <span
          aria-hidden
          className="size-3 rounded-full"
          style={{ background: "var(--subject-dot)" }}
        />
        <label htmlFor="subject-name" className="sr-only">
          Subject name
        </label>
        <input
          id="subject-name"
          name="name"
          required
          maxLength={80}
          autoFocus={!subject}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject name"
          className="h-10 min-w-0 bg-transparent text-[20px] font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-current placeholder:opacity-50"
        />
        <span className="text-[12.5px]">Preview of the subject tile</span>
      </div>

      <input type="hidden" name="color" value={color} />
      <SubjectColorPicker value={color} onChange={setColor} />

      <fieldset className="flex flex-col">
        <legend className="mb-2 text-[13px] font-medium text-ink-2">Difficulty</legend>
        <input type="hidden" name="difficulty" value={difficulty} />
        <div role="radiogroup" aria-label="Difficulty" className="flex gap-1.5">
          {DIFFICULTY_OPTIONS.map((d) => {
            const selected = difficulty === d;
            return (
              <button
                key={d || "none"}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={d ? `Difficulty ${d} of 5` : "No difficulty"}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "h-11 flex-1 rounded-[12px] text-[14px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-10",
                  !d && "flex-[1.4] text-[13px]",
                  selected
                    ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                    : "bg-sunken text-ink hover:bg-hover",
                )}
              >
                {d || "None"}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Description" htmlFor="subject-description" optional>
        <Textarea
          id="subject-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={subject?.description ?? ""}
          placeholder="What this course covers, the professor, class times…"
        />
      </Field>

      <FormError message={state.error} />

      <PrimaryActions>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending || !name.trim()} className="min-w-32">
          {pending ? "Saving…" : subject ? "Save changes" : "Create subject"}
        </Button>
      </PrimaryActions>
    </form>
  );
}
