"use client";

import { useState, useTransition } from "react";

import { finishFocusSession } from "@/actions/focus";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session summary</DialogTitle>
        </DialogHeader>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Subject</dt>
            <dd>{payload.subjectName || "None"}</dd>
          </div>
          {payload.topicTitle ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Topic</dt>
              <dd>{payload.topicTitle}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Focus time</dt>
            <dd className="font-medium">
              {formatDurationMinutes(payload.focusMs)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Break time</dt>
            <dd>{formatDurationMinutes(payload.breakMs)}</dd>
          </div>
          {payload.goal ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Goal</dt>
              <dd className="text-right">{payload.goal}</dd>
            </div>
          ) : null}
        </dl>

        {payload.goal ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={goalCompleted}
              onChange={(e) => setGoalCompleted(e.target.checked)}
            />
            Mark goal completed
          </label>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="session-notes">Notes</Label>
          <Textarea
            id="session-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you cover?"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Keep editing
          </Button>
          <Button type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
