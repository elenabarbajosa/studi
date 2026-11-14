"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import { FinishSessionDialog } from "@/components/focus/finish-session-dialog";
import {
  SoundscapeControls,
  useSoundscapePlayer,
} from "@/components/focus/soundscape-controls";
import { TimerDial } from "@/components/focus/timer-dial";
import { Field, NativeSelect } from "@/components/studi/form-controls";
import { PageTitle } from "@/components/studi/page-title";
import { Segmented } from "@/components/studi/segmented";
import { SubjectChip, SubjectDot, SubjectPicker } from "@/components/studi/subject-chip";
import { Input } from "@/components/ui/input";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { useStudyPresence } from "@/hooks/use-study-presence";
import type { SoundscapeId } from "@/lib/calendar";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
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
  const config = defaultFocusConfig(preferences);
  const timer = useFocusTimer(config);
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

  const { engine } = timer;
  const active = engine.runState === "running" || engine.runState === "paused";
  const finished = engine.runState === "finished";
  const isBreak = engine.phase === "short_break" || engine.phase === "long_break";

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

  const perCycle = engine.intervalsBeforeLong || config.intervalsBeforeLong;
  const inCycle = engine.completedFocusIntervals % perCycle;
  const cycleDone = isBreak && inCycle === 0 && engine.completedFocusIntervals > 0 ? perCycle : inCycle;
  const cycleNumber = engine.phase === "focus" ? inCycle + 1 : Math.max(1, cycleDone);
  const dialLabel =
    engine.mode === "pomodoro"
      ? `${phaseLabel} · cycle ${cycleNumber} of ${perCycle}`
      : finished
        ? "Stopped"
        : engine.runState === "paused"
          ? "Paused"
          : "Stopwatch";
  const dialProgress =
    engine.mode === "pomodoro" ? timer.progress : (timer.displayMs % 3_600_000) / 3_600_000;
  const cycle =
    engine.mode === "pomodoro"
      ? { total: perCycle, done: cycleDone, current: engine.phase === "focus" }
      : undefined;

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

  function handleStart() {
    const clientSessionId = crypto.randomUUID();
    const { engine, meta } = timer.begin({
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
      } else if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        confirmReset();
      } else if (e.key === "Escape" && distractionFree) {
        setDistractionFree(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const immersive = distractionFree || (isPhone && (active || finished) && !phoneMinimized);

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
    weeklyGoalHours && weeklyGoalHours > 0 ? (weeklyGoalHours * 3600) / 7 : null;

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

      <div className="grid gap-4 md:gap-5 min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Hero timer */}
        <Tile variant="hero" className="flex flex-col p-4 sm:p-6 md:rounded-[28px] md:p-7">
          <div className="flex items-center justify-between gap-3">
            <Segmented
              label="Timer mode"
              value={engine.mode}
              onChange={(mode) => timer.switchMode(mode)}
              disabled={active || finished}
              options={[
                { value: "pomodoro", label: "Pomodoro" },
                { value: "stopwatch", label: "Stopwatch" },
              ]}
              className="bg-raised/60 dark:bg-sunken"
            />
            <button
              type="button"
              onClick={() => setDistractionFree(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-2 outline-none transition-colors hover:bg-raised/60 hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            >
              <Maximize2 className="size-4" aria-hidden />
              <span className="hidden sm:inline">Distraction-free</span>
              <span className="sr-only sm:hidden">Distraction-free view</span>
            </button>
          </div>

          <TimerDial
            progress={dialProgress}
            time={timer.display}
            label={dialLabel}
            cycle={cycle}
            className="mt-4 max-w-[300px] md:mt-6 md:max-w-[360px]"
          />

          <div className="mt-4 flex min-h-[44px] flex-col items-center gap-1 text-center md:mt-5">
            {contextLine ? (
              <p className="flex max-w-full justify-center text-[14px] font-semibold text-accent-text">
                {contextLine}
              </p>
            ) : (
              <p className="text-[14px] text-ink-2">Pick a subject to tag this session, or just start.</p>
            )}
            {sessionGoal ? (
              <p className="max-w-md truncate text-[13.5px] text-ink-2">Goal: {sessionGoal}</p>
            ) : null}
          </div>

          <TimerControls
            className="mt-5 md:mt-6"
            runState={engine.runState}
            primaryLabel={primaryLabel}
            pending={isPending}
            onPrimary={togglePrimary}
            onReset={confirmReset}
            onFinish={handleFinish}
          />

          <p className="mt-5 hidden text-center text-[12px] text-ink-3 md:block">
            <Kbd>Space</Kbd> pause · <Kbd>R</Kbd> reset · <Kbd>⌘↵</Kbd> finish & save ·{" "}
            <Kbd>Esc</Kbd> leave full screen
          </p>
        </Tile>

        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          {/* Session setup */}
          <Tile className="p-5">
            <TileHeader title="What are you studying?" />
            {active || finished ? (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {sessionSubject ? (
                    <SubjectChip name={sessionSubject.name} color={sessionSubject.color} />
                  ) : (
                    <SubjectChip name="No subject" color={null} />
                  )}
                  {sessionTopic ? (
                    <span className="text-[13.5px] text-ink-2">{sessionTopic.title}</span>
                  ) : null}
                </div>
                <p className="text-[13px] text-ink-3">
                  Locked while this session runs. Finish or reset to change it.
                </p>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                <SubjectPicker
                  subjects={subjects}
                  value={subjectId}
                  onChange={(id) => {
                    setSubjectId(id);
                    setTopicId("");
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Topic" htmlFor="focus-topic" optional>
                    <NativeSelect
                      id="focus-topic"
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                    >
                      <option value="">None</option>
                      {filteredTopics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Linked task" htmlFor="focus-task" optional>
                    <NativeSelect
                      id="focus-task"
                      value={taskId}
                      onChange={(e) => setTaskId(e.target.value)}
                    >
                      <option value="">None</option>
                      {filteredTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Study goal" htmlFor="focus-goal" optional>
                  <Input
                    id="focus-goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. Finish chapter 3 notes"
                    maxLength={200}
                  />
                </Field>
              </div>
            )}
          </Tile>

          {/* Rhythm */}
          <Tile variant="data" className="p-5">
            <TileHeader
              title="Rhythm"
              action={
                <Link href="/settings" className={tileLinkClass}>
                  Change in Settings
                </Link>
              }
            />
            {engine.mode === "pomodoro" ? (
              <dl className="mt-3 grid grid-cols-4 gap-2">
                <RhythmStat label="Focus" value={`${config.focusMinutes}m`} />
                <RhythmStat label="Break" value={`${config.shortBreakMinutes}m`} />
                <RhythmStat label="Long" value={`${config.longBreakMinutes}m`} />
                <RhythmStat label="Long every" value={`${config.intervalsBeforeLong}`} />
              </dl>
            ) : (
              <p className="mt-2 text-[13.5px] text-ink-2">
                The stopwatch counts up until you finish. Pauses aren’t counted.
              </p>
            )}
            {config.autoStartBreaks && engine.mode === "pomodoro" ? (
              <p className="mt-2.5 text-[12.5px] text-ink-3">Breaks start automatically.</p>
            ) : null}
          </Tile>

          {/* Ambience */}
          <Tile className="p-5">
            <TileHeader title="Ambience" />
            <div className="mt-3">
              <SoundscapeControls {...soundProps} />
            </div>
          </Tile>
        </div>
      </div>

      {/* Today + history */}
      <Tile className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:gap-6">
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
                  style={{ width: `${Math.min(100, (todayFocusSeconds / dailyPaceSeconds) * 100)}%` }}
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

        <Link href="/statistics" className={cn(tileLinkClass, "inline-flex shrink-0 items-center gap-1 self-start md:self-center")}>
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
              onClick={() => (distractionFree ? setDistractionFree(false) : setPhoneMinimized(true))}
              aria-label={distractionFree ? "Leave full screen" : "Minimise timer"}
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
              label={dialLabel}
              cycle={cycle}
              onToggle={active ? togglePrimary : undefined}
              toggleLabel={engine.runState === "running" ? "Pause timer" : "Resume timer"}
              className="max-w-[min(300px,72vw)] md:max-w-[min(420px,52vh)]"
            />

            <div className="mt-5 flex min-h-[44px] flex-col items-center gap-1 text-center">
              {contextLine ? (
                <p className="flex max-w-full justify-center text-[15px] font-semibold text-accent">
                  {contextLine}
                </p>
              ) : null}
              {sessionGoal ? (
                <p className="max-w-sm truncate text-[14px] text-white/60">{sessionGoal}</p>
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
            {dailyPaceSeconds ? ` of ${formatDurationMinutes(dailyPaceSeconds * 1000)}` : ""}
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
  const canFinish = runState === "running" || runState === "paused" || runState === "finished";
  const side = cn(
    "flex size-[52px] items-center justify-center rounded-full outline-none transition-[background-color,opacity] duration-200 ease-studi disabled:opacity-40",
    dark
      ? "bg-white/[0.08] text-white hover:bg-white/[0.14] focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)]"
      : "bg-raised text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--accent-soft),0_0_0_4px_var(--accent)]",
  );
  const PrimaryIcon = runState === "running" ? Pause : runState === "finished" ? Check : Play;

  return (
    <div className={cn("flex items-center justify-center gap-5", className)}>
      <button type="button" onClick={onReset} aria-label="Reset timer" className={side}>
        <RotateCcw className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={pending && runState === "idle"}
        aria-label={primaryLabel}
        className={cn(
          "flex items-center justify-center rounded-full outline-none transition-[background-color,transform] duration-200 ease-studi active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100",
          dark
            ? "size-[88px] bg-accent text-[#241c1f] focus-visible:shadow-[0_0_0_3px_#171315,0_0_0_5px_var(--accent)]"
            : "size-[76px] bg-primary text-primary-foreground hover:bg-accent-ink-hover focus-visible:shadow-[0_0_0_3px_var(--accent-soft),0_0_0_5px_var(--accent-ink)] md:size-[84px] dark:bg-accent dark:text-ink-on-accent",
        )}
      >
        <PrimaryIcon
          className={cn("size-8", PrimaryIcon === Play && "translate-x-[2px] fill-current")}
          aria-hidden
        />
      </button>
      <button
        type="button"
        onClick={onFinish}
        disabled={!canFinish}
        aria-label="Finish and save"
        className={side}
      >
        <Check className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function RhythmStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-raised px-2.5 py-2 text-center">
      <dt className="truncate text-[11.5px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[17px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
        {value}
      </dd>
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
