"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import {
  discardFocusSession,
  heartbeatFocusSession,
  startFocusSession,
} from "@/actions/focus";
import { Tile, tileLinkClass } from "@/components/dashboard/tile";
import { FinishSessionDialog } from "@/components/focus/finish-session-dialog";
import { FocusPresetChips } from "@/components/focus/focus-preset-chips";
import { RhythmSummary } from "@/components/focus/rhythm-summary";
import {
  SoundscapeControls,
  useSoundscapePlayer,
} from "@/components/focus/soundscape-controls";
import { StudySelection } from "@/components/focus/study-selection";
import {
  FOCUS_DURATION_MAX,
  snapFocusMinutes,
  TimerDial,
} from "@/components/focus/timer-dial";
import { PageTitle } from "@/components/studi/page-title";
import { Segmented } from "@/components/studi/segmented";
import { SubjectDot } from "@/components/studi/subject-chip";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useStudyPresence } from "@/hooks/use-study-presence";
import type { SoundscapeId } from "@/lib/calendar";
import { formatDurationMinutes, formatTimer } from "@/lib/focus/timer-engine";
import {
  defaultFocusConfig,
  type FocusPreferences,
} from "@/lib/focus/types";
import type { PresenceStatus } from "@/lib/social";
import { cn } from "@/lib/utils";
import type { Subject, StudySession, Task, Topic } from "@/types/database";

type FocusBoardProps = {
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  preferences: FocusPreferences;
  weeklyGoalHours: number | null;
  todayFocusSeconds: number;
  recentSessions: StudySession[];
  /** Deep-link preselect from Tasks / Subjects. Ignored once a session is active. */
  initialSubjectId?: string;
  initialTaskId?: string;
  initialTopicId?: string;
};

function resolveInitialSelection(input: {
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  initialSubjectId?: string;
  initialTaskId?: string;
  initialTopicId?: string;
}) {
  const task = input.initialTaskId
    ? input.tasks.find((t) => t.id === input.initialTaskId)
    : undefined;
  const subjectId =
    (task?.subject_id &&
    input.subjects.some((s) => s.id === task.subject_id)
      ? task.subject_id
      : null) ||
    (input.initialSubjectId &&
    input.subjects.some((s) => s.id === input.initialSubjectId)
      ? input.initialSubjectId
      : "") ||
    "";
  const topicId =
    input.initialTopicId &&
    input.topics.some(
      (t) =>
        t.id === input.initialTopicId &&
        (!subjectId || t.subject_id === subjectId),
    )
      ? input.initialTopicId
      : task?.topic_id &&
          input.topics.some((t) => t.id === task.topic_id)
        ? task.topic_id
        : "";
  const taskId = task ? task.id : "";
  return { subjectId, topicId, taskId };
}

const PHONE_QUERY = "(max-width: 767px)";

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function FocusBoard({
  subjects,
  topics,
  tasks,
  preferences,
  weeklyGoalHours,
  todayFocusSeconds,
  recentSessions,
  initialSubjectId,
  initialTaskId,
  initialTopicId,
}: FocusBoardProps) {
  const configDefaults = defaultFocusConfig(preferences);
  const timer = useFocusTimer(configDefaults);
  const isPhone = useIsPhone();

  const initial = resolveInitialSelection({
    subjects,
    topics,
    tasks,
    initialSubjectId,
    initialTaskId,
    initialTopicId,
  });
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [topicId, setTopicId] = useState(initial.topicId);
  const [taskId, setTaskId] = useState(initial.taskId);
  const [goal, setGoal] = useState("");
  const [distractionFree, setDistractionFree] = useState(false);
  const [phoneMinimized, setPhoneMinimized] = useState(false);
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
  const player = useSoundscapePlayer({
    enabled: preferences.focus_sound_enabled,
    volume,
    secondaryVolume,
  });

  const { engine } = timer;
  const active = engine.runState === "running" || engine.runState === "paused";
  const finished = engine.runState === "finished";
  const idle = engine.runState === "idle";
  const isBreak = engine.phase === "short_break" || engine.phase === "long_break";
  const canCustomize =
    idle && engine.mode === "pomodoro" && !finished;

  const sessionSubjectId = timer.meta?.subjectId ?? subjectId;
  const sessionSubject = subjects.find((s) => s.id === sessionSubjectId);
  const sessionTopic = topics.find((t) => t.id === (timer.meta?.topicId ?? topicId));
  const sessionGoal = timer.meta?.goal || goal.trim();

  const phaseLabel =
    engine.phase === "focus"
      ? "Focus"
      : engine.phase === "short_break"
        ? "Short break"
        : engine.phase === "long_break"
          ? "Long break"
          : "Stopwatch";

  const perCycle = engine.intervalsBeforeLong || timer.config.intervalsBeforeLong;
  const inCycle = engine.completedFocusIntervals % perCycle;
  const cycleDone =
    isBreak && inCycle === 0 && engine.completedFocusIntervals > 0
      ? perCycle
      : inCycle;
  const cycleNumber =
    engine.phase === "focus" ? inCycle + 1 : Math.max(1, cycleDone);
  const dialLabel =
    engine.mode === "pomodoro"
      ? canCustomize
        ? "Ready"
        : `${phaseLabel} · cycle ${cycleNumber} of ${perCycle}`
      : finished
        ? "Stopped"
        : engine.runState === "paused"
          ? "Paused"
          : "Stopwatch";
  const dialProgress =
    engine.mode === "pomodoro"
      ? timer.progress
      : (timer.displayMs % 3_600_000) / 3_600_000;
  const cycle =
    engine.mode === "pomodoro" && !canCustomize
      ? { total: perCycle, done: cycleDone, current: engine.phase === "focus" }
      : undefined;

  const displayTime = canCustomize
    ? formatTimer(timer.config.focusMinutes * 60_000)
    : timer.display;

  const presenceStatus: PresenceStatus =
    !active
      ? "offline"
      : timer.engine.phase === "short_break" ||
          timer.engine.phase === "long_break"
        ? "on_break"
        : "focusing";

  useStudyPresence({
    enabled: active,
    status: presenceStatus,
    activityLabel:
      presenceStatus === "focusing"
        ? "Focusing"
        : presenceStatus === "on_break"
          ? "On break"
          : null,
  });

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

  function setFocusMinutes(minutes: number) {
    if (!canCustomize) return;
    timer.applyConfig({ focusMinutes: snapFocusMinutes(minutes) });
  }

  function handlePresetSelect(value: number | "custom") {
    if (!canCustomize) return;
    if (value === "custom") {
      // Custom is selected automatically when the ring is scrubbed.
      // If already on a named preset, nudge once so the Custom chip activates.
      const current = timer.config.focusMinutes;
      if ([25, 45, 60].includes(current)) {
        setFocusMinutes(Math.min(FOCUS_DURATION_MAX, current === 60 ? 55 : current + 5));
      }
      return;
    }
    setFocusMinutes(value);
  }

  function handleStart() {
    const clientSessionId = crypto.randomUUID();
    const { engine: started, meta } = timer.begin({
      subjectId: subjectId || null,
      topicId: topicId || null,
      taskId: taskId || null,
      goal: goal.trim(),
      clientSessionId,
    });
    setPhoneMinimized(false);
    startTransition(async () => {
      const result = await startFocusSession({
        client_session_id: clientSessionId,
        timer_mode: started.mode,
        subject_id: meta.subjectId,
        topic_id: meta.topicId,
        task_id: meta.taskId,
        goal: meta.goal,
        engine_state: started as unknown as Record<string, unknown>,
      });
      if (result.error) {
        toast.error(result.error);
        timer.reset();
      }
    });
  }

  function handleFinish() {
    const finishedEngine = timer.finish();
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
      focusMs: finishedEngine.totalFocusMs,
      breakMs: finishedEngine.totalBreakMs,
      timerMode: finishedEngine.mode,
      pomodoroCycles: finishedEngine.completedFocusIntervals,
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

  function confirmReset() {
    if (
      (active || finished) &&
      !window.confirm("Reset the timer? This session will not be saved.")
    ) {
      return;
    }
    handleReset();
  }

  function togglePrimary() {
    if (engine.runState === "running") timer.pause();
    else if (engine.runState === "paused") timer.resume();
    else if (finished) handleFinish();
    else if (!isPending) handleStart();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || finishOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (timer.engine.runState === "running") timer.pause();
        else if (timer.engine.runState === "paused") timer.resume();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        const state = timer.engine.runState;
        if (state === "running" || state === "paused" || state === "finished") {
          e.preventDefault();
          handleFinish();
        }
      } else if (
        (e.key === "r" || e.key === "R") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        confirmReset();
      } else if (e.key === "Escape" && distractionFree) {
        setDistractionFree(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const immersive =
    distractionFree || (isPhone && (active || finished) && !phoneMinimized);

  useEffect(() => {
    if (!immersive) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [immersive]);

  const primaryLabel =
    engine.runState === "running"
      ? "Pause"
      : engine.runState === "paused"
        ? "Resume"
        : finished
          ? "Save session"
          : "Start focus";

  const todayLabel = formatDurationMinutes(todayFocusSeconds * 1000);
  const dailyPaceSeconds =
    weeklyGoalHours && weeklyGoalHours > 0
      ? (weeklyGoalHours * 3600) / 7
      : null;

  const soundProps = {
    player,
    primary,
    secondary,
    volume,
    secondaryVolume,
    enabled: preferences.focus_sound_enabled,
    onPrimaryChange: setPrimary,
    onSecondaryChange: setSecondary,
    onVolumeChange: setVolume,
    onSecondaryVolumeChange: setSecondaryVolume,
  };

  const contextLine = sessionSubject ? (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <SubjectDot color={sessionSubject.color} />
      <span className="truncate">
        {sessionSubject.name}
        {sessionTopic ? ` · ${sessionTopic.title}` : ""}
      </span>
    </span>
  ) : sessionTopic ? (
    <span className="truncate">{sessionTopic.title}</span>
  ) : null;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageTitle
        title="Focus"
        subtitle={`Only active focus time is saved · ${todayLabel} today`}
      />

      <div className="grid gap-3 md:gap-5 min-[1100px]:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
        {/* Hero timer */}
        <Tile
          variant="hero"
          className="relative flex flex-col overflow-hidden p-4 sm:p-5 md:rounded-[28px] md:p-7"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_-10%,color-mix(in_srgb,var(--accent)_28%,transparent),transparent_65%)]"
          />

          <div className="relative flex items-center justify-between gap-3">
            <Segmented
              label="Timer mode"
              value={engine.mode}
              onChange={(mode) => timer.switchMode(mode)}
              disabled={active || finished}
              options={[
                { value: "pomodoro", label: "Pomodoro" },
                { value: "stopwatch", label: "Stopwatch" },
              ]}
              className="bg-raised/70 dark:bg-sunken"
            />
            <button
              type="button"
              onClick={() => setDistractionFree(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-2 outline-none transition-colors hover:bg-raised/70 hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            >
              <Maximize2 className="size-4" aria-hidden />
              <span className="hidden sm:inline">Distraction-free</span>
              <span className="sr-only sm:hidden">Distraction-free view</span>
            </button>
          </div>

          <TimerDial
            progress={dialProgress}
            time={displayTime}
            label={dialLabel}
            cycle={cycle}
            interactive={canCustomize}
            durationMinutes={
              canCustomize ? timer.config.focusMinutes : undefined
            }
            onDurationChange={canCustomize ? setFocusMinutes : undefined}
            className="relative mt-3 max-w-[260px] sm:max-w-[280px] md:mt-5 md:max-w-[340px]"
          />

          {engine.mode === "pomodoro" ? (
            <FocusPresetChips
              className="relative mt-3 md:mt-4"
              focusMinutes={timer.config.focusMinutes}
              disabled={!canCustomize}
              onSelect={handlePresetSelect}
            />
          ) : null}

          <div className="relative mt-3 flex min-h-[40px] flex-col items-center gap-1 text-center md:mt-4">
            {contextLine ? (
              <p className="flex max-w-full justify-center text-[13.5px] font-semibold text-accent-text md:text-[14px]">
                {contextLine}
              </p>
            ) : (
              <p className="text-[13.5px] text-ink-2">
                Start untagged, or pick a subject beside the timer.
              </p>
            )}
            {sessionGoal ? (
              <p className="max-w-md truncate text-[13px] text-ink-2">
                Goal: {sessionGoal}
              </p>
            ) : null}
          </div>

          <TimerControls
            className="relative mt-4 md:mt-5"
            runState={engine.runState}
            primaryLabel={primaryLabel}
            pending={isPending}
            onPrimary={togglePrimary}
            onReset={confirmReset}
            onFinish={handleFinish}
          />

          <p className="relative mt-4 hidden text-center text-[12px] text-ink-3 md:block">
            <Kbd>Space</Kbd> pause · <Kbd>R</Kbd> reset · <Kbd>⌘↵</Kbd> finish &
            save · <Kbd>Esc</Kbd> leave full screen
          </p>
        </Tile>

        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          <StudySelection
            subjects={subjects}
            topics={topics}
            tasks={tasks}
            subjectId={subjectId}
            topicId={topicId}
            taskId={taskId}
            goal={goal}
            locked={active || finished}
            onSubjectChange={(id) => {
              setSubjectId(id);
              setTopicId("");
            }}
            onTopicChange={setTopicId}
            onTaskChange={setTaskId}
            onGoalChange={setGoal}
          />

          <RhythmSummary
            mode={engine.mode}
            focusMinutes={timer.config.focusMinutes}
            shortBreakMinutes={timer.config.shortBreakMinutes}
            longBreakMinutes={timer.config.longBreakMinutes}
            intervalsBeforeLong={timer.config.intervalsBeforeLong}
            autoStartBreaks={timer.config.autoStartBreaks}
          />

          <SoundscapeControls {...soundProps} variant="card" />
        </div>
      </div>

      {/* Today + history */}
      <Tile className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-5">
        <div className="min-w-0 md:w-[min(320px,34%)] md:shrink-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink-2">Today</p>
            <p className="text-[13px] text-ink-2">
              <span className="text-[18px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
                {todayLabel}
              </span>
              {dailyPaceSeconds ? (
                <> of {formatDurationMinutes(dailyPaceSeconds * 1000)}</>
              ) : null}
            </p>
          </div>
          {dailyPaceSeconds ? (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-accent-ink transition-[width] duration-500 ease-studi dark:bg-accent"
                  style={{
                    width: `${Math.min(100, (todayFocusSeconds / dailyPaceSeconds) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-ink-3">
                Daily pace for your {weeklyGoalHours}h weekly goal
              </p>
            </>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[13px] font-medium text-ink-2">Earlier</p>
          {recentSessions.length === 0 ? (
            <p className="text-[13.5px] text-ink-3">
              No saved sessions yet. Finish a timer to start your history.
            </p>
          ) : (
            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {recentSessions.slice(0, 6).map((s) => {
                const subject = subjects.find((x) => x.id === s.subject_id);
                return (
                  <li
                    key={s.id}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-sunken py-1.5 pr-3.5 pl-3 text-[13px]"
                  >
                    <SubjectDot color={subject?.color} />
                    <span className="max-w-[140px] truncate font-medium text-ink">
                      {subject?.name ?? "No subject"}
                    </span>
                    <span className="font-semibold text-ink tabular-nums">
                      {formatDurationMinutes(s.focus_seconds * 1000)}
                    </span>
                    <span className="text-ink-3">
                      {new Date(s.starts_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Link
          href="/statistics"
          className={cn(
            tileLinkClass,
            "inline-flex shrink-0 items-center gap-1 self-start md:self-center",
          )}
        >
          Statistics
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Tile>

      {immersive ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Focus timer, full screen"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_0%,#3A2830_0%,#171315_70%)] px-5 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] text-white"
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                distractionFree
                  ? setDistractionFree(false)
                  : setPhoneMinimized(true)
              }
              aria-label={
                distractionFree ? "Leave full screen" : "Minimise timer"
              }
              className="flex size-11 items-center justify-center rounded-full bg-white/[0.08] text-white/80 outline-none hover:bg-white/[0.14] focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)]"
            >
              <ChevronDown className="size-5" aria-hidden />
            </button>
            <p className="text-[13px] font-semibold tracking-[0.08em] text-white/60 uppercase">
              {engine.mode === "pomodoro" ? "Pomodoro" : "Stopwatch"}
            </p>
            <span className="size-11" aria-hidden />
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center py-6">
            <TimerDial
              tone="dark"
              progress={dialProgress}
              time={timer.display}
              label={
                engine.mode === "pomodoro"
                  ? `${phaseLabel} · cycle ${cycleNumber} of ${perCycle}`
                  : dialLabel
              }
              cycle={
                engine.mode === "pomodoro"
                  ? {
                      total: perCycle,
                      done: cycleDone,
                      current: engine.phase === "focus",
                    }
                  : undefined
              }
              onToggle={active ? togglePrimary : undefined}
              toggleLabel={
                engine.runState === "running" ? "Pause timer" : "Resume timer"
              }
              className="max-w-[min(300px,72vw)] md:max-w-[min(420px,52vh)]"
            />

            <div className="mt-5 flex min-h-[44px] flex-col items-center gap-1 text-center">
              {contextLine ? (
                <p className="flex max-w-full justify-center text-[15px] font-semibold text-accent">
                  {contextLine}
                </p>
              ) : null}
              {sessionGoal ? (
                <p className="max-w-sm truncate text-[14px] text-white/60">
                  {sessionGoal}
                </p>
              ) : null}
            </div>

            <div className="mt-6">
              <SoundscapeControls {...soundProps} variant="immersive" />
            </div>

            <TimerControls
              tone="dark"
              className="mt-7"
              runState={engine.runState}
              primaryLabel={primaryLabel}
              pending={isPending}
              onPrimary={togglePrimary}
              onReset={confirmReset}
              onFinish={handleFinish}
            />
          </div>

          <p className="text-center text-[13px] text-white/50">
            Today {todayLabel}
            {dailyPaceSeconds
              ? ` of ${formatDurationMinutes(dailyPaceSeconds * 1000)}`
              : ""}
            {isBreak ? " · on a break" : ""}
            <span className="hidden md:inline"> · Esc leaves full screen</span>
          </p>
        </div>
      ) : null}

      {finishPayload ? (
        <FinishSessionDialog
          key={finishPayload.clientSessionId}
          open={finishOpen}
          onOpenChange={setFinishOpen}
          payload={finishPayload}
          onSaved={() => {
            timer.clearSession();
            timer.reset();
            setDistractionFree(false);
            toast.success("Focus session saved");
          }}
        />
      ) : null}
    </div>
  );
}

function TimerControls({
  runState,
  primaryLabel,
  pending,
  onPrimary,
  onReset,
  onFinish,
  tone = "light",
  className,
}: {
  runState: "idle" | "running" | "paused" | "finished";
  primaryLabel: string;
  pending: boolean;
  onPrimary: () => void;
  onReset: () => void;
  onFinish: () => void;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  const canFinish =
    runState === "running" || runState === "paused" || runState === "finished";
  const side = cn(
    "flex size-[52px] items-center justify-center rounded-full outline-none transition-[background-color,opacity] duration-200 ease-studi disabled:opacity-40",
    dark
      ? "bg-white/[0.08] text-white hover:bg-white/[0.14] focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)]"
      : "bg-raised/80 text-ink-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent-soft),0_0_0_4px_var(--accent)]",
  );
  const PrimaryIcon =
    runState === "running" ? Pause : runState === "finished" ? Check : Play;

  return (
    <div className={cn("flex items-center justify-center gap-5", className)}>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        className={cn(side, runState === "idle" && "opacity-55 hover:opacity-100")}
      >
        <RotateCcw className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={pending && runState === "idle"}
        aria-label={primaryLabel}
        className={cn(
          "flex items-center justify-center rounded-full outline-none transition-[background-color,transform,box-shadow] duration-200 ease-studi active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100",
          dark
            ? "size-[88px] bg-accent text-[#241c1f] shadow-[0_16px_36px_-14px_rgba(0,0,0,0.55)] focus-visible:shadow-[0_0_0_3px_#171315,0_0_0_5px_var(--accent)]"
            : "size-[76px] bg-primary text-primary-foreground shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--accent)_75%,transparent)] hover:bg-accent-ink-hover focus-visible:shadow-[0_0_0_3px_var(--accent-soft),0_0_0_5px_var(--accent-ink)] md:size-[84px] dark:bg-accent dark:text-ink-on-accent",
        )}
      >
        <PrimaryIcon
          className={cn(
            "size-8",
            PrimaryIcon === Play && "translate-x-[2px] fill-current",
          )}
          aria-hidden
        />
      </button>
      {canFinish ? (
        <button
          type="button"
          onClick={onFinish}
          aria-label="Finish and save"
          className={side}
        >
          <Check className="size-5" aria-hidden />
        </button>
      ) : (
        <span className="size-[52px]" aria-hidden />
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[6px] bg-raised/70 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-ink-2 dark:bg-sunken">
      {children}
    </kbd>
  );
}
