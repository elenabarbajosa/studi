"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import {
  discardFocusSession,
  heartbeatFocusSession,
  startFocusSession,
} from "@/actions/focus";
import { FinishSessionDialog } from "@/components/focus/finish-session-dialog";
import { SoundscapeControls } from "@/components/focus/soundscape-controls";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import type { SoundscapeId } from "@/lib/calendar";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
import {
  defaultFocusConfig,
  type FocusPreferences,
} from "@/lib/focus/types";
import { cn } from "@/lib/utils";
import type { Subject, StudySession, Task, Topic } from "@/types/database";

type FocusBoardProps = {
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  preferences: FocusPreferences;
  todayFocusSeconds: number;
  recentSessions: StudySession[];
};

export function FocusBoard({
  subjects,
  topics,
  tasks,
  preferences,
  todayFocusSeconds,
  recentSessions,
}: FocusBoardProps) {
  const config = defaultFocusConfig(preferences);
  const timer = useFocusTimer(config);

  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [goal, setGoal] = useState("");
  const [distractionFree, setDistractionFree] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishPayload, setFinishPayload] = useState<
    React.ComponentProps<typeof FinishSessionDialog>["payload"] | null
  >(null);
  const [primary, setPrimary] = useState<SoundscapeId>(
    preferences.soundscape_primary,
  );
  const [secondary, setSecondary] = useState<SoundscapeId>(
    preferences.soundscape_secondary,
  );
  const [volume, setVolume] = useState(preferences.soundscape_volume);
  const [secondaryVolume, setSecondaryVolume] = useState(
    preferences.soundscape_secondary_volume,
  );
  const [isPending, startTransition] = useTransition();

  const filteredTopics = useMemo(
    () => topics.filter((t) => (subjectId ? t.subject_id === subjectId : true)),
    [topics, subjectId],
  );
  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "todo" &&
          (subjectId ? t.subject_id === subjectId || !t.subject_id : true),
      ),
    [tasks, subjectId],
  );

  const subjectName = subjects.find((s) => s.id === subjectId)?.name;
  const phaseLabel =
    timer.engine.phase === "focus"
      ? "Focus"
      : timer.engine.phase === "short_break"
        ? "Short break"
        : timer.engine.phase === "long_break"
          ? "Long break"
          : "Stopwatch";

  const active = timer.engine.runState === "running" || timer.engine.runState === "paused";

  useEffect(() => {
    timer.setOnPhaseComplete((phase) => {
      if (preferences.focus_sound_enabled) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = phase.includes("break") ? 523 : 440;
          gain.gain.value = 0.08;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } catch {
          /* autoplay / audio blocked */
        }
      }
      toast.message(
        phase === "focus" ? "Focus interval complete" : "Break complete",
      );
    });
  }, [preferences.focus_sound_enabled, timer]);

  // Heartbeat every 20s while a session is active
  useEffect(() => {
    if (!timer.clientSessionId || !active) return;
    const id = window.setInterval(() => {
      void heartbeatFocusSession({
        client_session_id: timer.clientSessionId!,
        engine_state: timer.engine as unknown as Record<string, unknown>,
        focus_seconds: Math.round(timer.engine.totalFocusMs / 1000),
        break_seconds: Math.round(timer.engine.totalBreakMs / 1000),
      });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [timer.clientSessionId, active, timer.engine]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (timer.engine.runState === "running") timer.pause();
        else if (timer.engine.runState === "paused") timer.resume();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer]);

  function handleStart() {
    const clientSessionId = crypto.randomUUID();
    const { engine, meta } = timer.begin({
      subjectId: subjectId || null,
      topicId: topicId || null,
      taskId: taskId || null,
      goal: goal.trim(),
      clientSessionId,
    });
    startTransition(async () => {
      const result = await startFocusSession({
        client_session_id: clientSessionId,
        timer_mode: engine.mode,
        subject_id: meta.subjectId,
        topic_id: meta.topicId,
        task_id: meta.taskId,
        goal: meta.goal,
        engine_state: engine as unknown as Record<string, unknown>,
      });
      if (result.error) {
        toast.error(result.error);
        timer.reset();
      }
    });
  }

  function handleFinish() {
    const finished = timer.finish();
    if (!timer.clientSessionId || !timer.meta) {
      toast.error("No active session to save.");
      return;
    }
    setFinishPayload({
      clientSessionId: timer.clientSessionId,
      subjectId: timer.meta.subjectId,
      topicId: timer.meta.topicId,
      taskId: timer.meta.taskId,
      goal: timer.meta.goal,
      focusMs: finished.totalFocusMs,
      breakMs: finished.totalBreakMs,
      timerMode: finished.mode,
      pomodoroCycles: finished.completedFocusIntervals,
      startedAtIso: timer.meta.startedAtIso,
      subjectName: subjects.find((s) => s.id === timer.meta?.subjectId)?.name,
      topicTitle: topics.find((t) => t.id === timer.meta?.topicId)?.title,
    });
    setFinishOpen(true);
  }

  function handleReset() {
    const id = timer.clientSessionId;
    timer.reset();
    if (id) {
      startTransition(async () => {
        await discardFocusSession(id);
      });
    }
  }

  const ringStyle = {
    background: `conic-gradient(var(--primary) ${timer.progress * 360}deg, color-mix(in oklch, var(--muted) 80%, transparent) 0deg)`,
  };

  const shell = (
    <div
      className={cn(
        distractionFree
          ? "fixed inset-0 z-50 flex flex-col bg-background/95 p-6 backdrop-blur-md"
          : "space-y-6",
      )}
    >
      {distractionFree ? (
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDistractionFree(false)}
          >
            <Minimize2 className="size-4" />
            Exit focus view
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-6",
          distractionFree ? "mx-auto max-w-xl flex-1 content-center" : "lg:grid-cols-[1.2fr_0.8fr]",
        )}
      >
        <section className="studi-panel flex flex-col items-center gap-6 p-6 sm:p-10">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(["pomodoro", "stopwatch"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={timer.engine.mode === mode ? "default" : "outline"}
                disabled={active}
                onClick={() => timer.switchMode(mode)}
                className="capitalize"
              >
                {mode}
              </Button>
            ))}
          </div>

          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {phaseLabel}
            {timer.engine.mode === "pomodoro"
              ? ` · Cycle ${timer.engine.completedFocusIntervals + (timer.engine.phase === "focus" ? 1 : 0)}`
              : null}
          </p>

          <div
            className="relative flex size-56 items-center justify-center rounded-full sm:size-64"
            style={timer.engine.mode === "pomodoro" ? ringStyle : undefined}
            aria-hidden={timer.engine.mode === "stopwatch"}
          >
            <div
              className={cn(
                "flex size-[85%] flex-col items-center justify-center rounded-full bg-card",
                timer.engine.mode === "stopwatch" && "border border-border",
              )}
            >
              <p
                className="font-display text-5xl tracking-tight tabular-nums sm:text-6xl"
                aria-live="polite"
                aria-atomic
              >
                {timer.display}
              </p>
              {subjectName ? (
                <p className="mt-2 max-w-[12rem] truncate text-sm text-muted-foreground">
                  {subjectName}
                </p>
              ) : null}
            </div>
          </div>

          {goal || timer.meta?.goal ? (
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              Goal: {timer.meta?.goal || goal}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!active && timer.engine.runState !== "finished" ? (
              <Button
                type="button"
                className="gap-1.5"
                disabled={isPending}
                onClick={handleStart}
              >
                <Play className="size-4" />
                Start
              </Button>
            ) : null}
            {timer.engine.runState === "running" ? (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={timer.pause}
              >
                <Pause className="size-4" />
                Pause
              </Button>
            ) : null}
            {timer.engine.runState === "paused" ? (
              <Button
                type="button"
                className="gap-1.5"
                onClick={timer.resume}
              >
                <Play className="size-4" />
                Resume
              </Button>
            ) : null}
            {active || timer.engine.runState === "finished" ? (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={handleFinish}
              >
                <Square className="size-4" />
                Finish
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5"
              onClick={handleReset}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            {!distractionFree ? (
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => setDistractionFree(true)}
              >
                <Maximize2 className="size-4" />
                Focus view
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Space to pause/resume · Today{" "}
            {formatDurationMinutes(todayFocusSeconds * 1000)} focused
          </p>
        </section>

        {!distractionFree ? (
          <div className="space-y-4">
            <section className="studi-panel space-y-4 p-5">
              <h2 className="font-display text-xl tracking-tight">Session</h2>
              <div className="space-y-2">
                <Label htmlFor="focus-subject">Subject</Label>
                <select
                  id="focus-subject"
                  value={subjectId}
                  disabled={active}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setTopicId("");
                  }}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="focus-topic">Topic</Label>
                <select
                  id="focus-topic"
                  value={topicId}
                  disabled={active}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="focus-task">Linked task</Label>
                <select
                  id="focus-task"
                  value={taskId}
                  disabled={active}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  <option value="">None</option>
                  {filteredTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="focus-goal">Study goal</Label>
                <Input
                  id="focus-goal"
                  value={goal}
                  disabled={active}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Finish chapter 3 notes"
                  maxLength={200}
                />
              </div>
            </section>

            <section className="studi-panel space-y-3 p-5">
              <h2 className="font-display text-xl tracking-tight">Sounds</h2>
              <SoundscapeControls
                primary={primary}
                secondary={secondary}
                volume={volume}
                secondaryVolume={secondaryVolume}
                enabled={preferences.focus_sound_enabled}
                onPrimaryChange={setPrimary}
                onSecondaryChange={setSecondary}
                onVolumeChange={setVolume}
                onSecondaryVolumeChange={setSecondaryVolume}
              />
            </section>

            <section className="studi-panel space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl tracking-tight">History</h2>
                <Link
                  href="/statistics"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Statistics
                </Link>
              </div>
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved focus sessions yet. Finish a timer to start your
                  history.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentSessions.slice(0, 6).map((s) => (
                    <li key={s.id} className="text-sm">
                      <span className="font-medium">
                        {formatDurationMinutes(s.focus_seconds * 1000)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        ·{" "}
                        {subjects.find((x) => x.id === s.subject_id)?.name ??
                          "No subject"}{" "}
                        · {new Date(s.starts_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <SoundscapeControls
              compact
              primary={primary}
              secondary={secondary}
              volume={volume}
              secondaryVolume={secondaryVolume}
              enabled={preferences.focus_sound_enabled}
              onPrimaryChange={setPrimary}
              onSecondaryChange={setSecondary}
              onVolumeChange={setVolume}
              onSecondaryVolumeChange={setSecondaryVolume}
            />
          </div>
        )}
      </div>

      {finishPayload ? (
        <FinishSessionDialog
          open={finishOpen}
          onOpenChange={setFinishOpen}
          payload={finishPayload}
          onSaved={() => {
            timer.clearSession();
            timer.reset();
            toast.success("Focus session saved");
          }}
        />
      ) : null}
    </div>
  );

  return shell;
}
