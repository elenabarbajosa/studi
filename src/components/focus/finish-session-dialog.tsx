"use client";

import { useState, useTransition } from "react";

import { finishFocusSession } from "@/actions/focus";
import { Field, FormError, PrimaryActions, SwitchRow } from "@/components/studi/form-controls";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
import type { FocusTimerMode } from "@/lib/calendar";

type FinishSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  payload: {
    clientSessionId: string;
    subjectId: string | null;
    topicId: string | null;
    taskId: string | null;
    goal: string;
    focusMs: number;
    breakMs: number;
    timerMode: FocusTimerMode;
    pomodoroCycles: number;
    startedAtIso: string;
    subjectName?: string;
    topicTitle?: string;
  };
};

export function FinishSessionDialog({
  open,
  onOpenChange,
  onSaved,
  payload,
}: FinishSessionDialogProps) {
  const [notes, setNotes] = useState("");
  const [goalCompleted, setGoalCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await finishFocusSession({
        client_session_id: payload.clientSessionId,
        subject_id: payload.subjectId,
        topic_id: payload.topicId,
        task_id: payload.taskId,
        goal: payload.goal,
        notes,
        goal_completed: payload.goal ? goalCompleted : undefined,
        focus_seconds: Math.round(payload.focusMs / 1000),
        break_seconds: Math.round(payload.breakMs / 1000),
        timer_mode: payload.timerMode,
        pomodoro_cycles: payload.pomodoroCycles,
        started_at: payload.startedAtIso,
        ended_at: new Date().toISOString(),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onOpenChange(false);
    });
  }

  const context = [payload.subjectName, payload.topicTitle].filter(Boolean).join(" · ");

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Session summary"
      description={context || "No subject"}
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-[20px] bg-accent-soft px-5 py-4">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-accent-text uppercase">
            Verified focus
          </p>
          <p className="mt-1 text-[40px] leading-none font-semibold tracking-[-0.04em] text-ink tabular-nums">
            {formatDurationMinutes(payload.focusMs)}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
            <div className="flex gap-1.5">
              <dt>Breaks</dt>
              <dd className="font-semibold text-ink tabular-nums">
                {formatDurationMinutes(payload.breakMs)}
              </dd>
            </div>
            {payload.timerMode === "pomodoro" ? (
              <div className="flex gap-1.5">
                <dt>Cycles</dt>
                <dd className="font-semibold text-ink tabular-nums">{payload.pomodoroCycles}</dd>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <dt>Mode</dt>
                <dd className="font-semibold text-ink">Stopwatch</dd>
              </div>
            )}
          </dl>
        </div>

        {payload.goal ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-ink-2">
              Goal: <span className="font-medium text-ink">{payload.goal}</span>
            </p>
            <SwitchRow label="I reached this goal" checked={goalCompleted} onChange={setGoalCompleted} />
          </div>
        ) : null}

        <Field label="Notes" htmlFor="session-notes" optional>
          <Textarea
            id="session-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you cover?"
          />
        </Field>

        <FormError message={error ?? undefined} />

        <PrimaryActions>
          <button
            type="button"
            className={softPillClass}
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Not yet
          </button>
          <button type="button" className={primaryPillClass} disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save session"}
          </button>
        </PrimaryActions>
      </div>
    </ResponsiveDialog>
  );
}
