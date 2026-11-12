"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";
import { toast } from "sonner";

import {
  endRoom,
  kickMember,
  leaveRoom,
  saveStudyTogetherSession,
  transferHost,
} from "@/actions/study-together";
import { SoundscapeControls } from "@/components/focus/soundscape-controls";
import { RoomChat } from "@/components/study-together/room-chat";
import { RoomInvitePanel } from "@/components/study-together/room-invite-panel";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRoomPresence } from "@/hooks/use-room-presence";
import { useRoomTimer } from "@/hooks/use-room-timer";
import type { SoundscapeId } from "@/lib/calendar";
import type { FriendListItem } from "@/lib/data/friends";
import type { FocusPreferences } from "@/lib/focus/types";
import {
  accruePersonalFocusMs,
  derivePersonalPresence,
} from "@/lib/study-together/timer-sync";
import {
  isBreakPhase,
  phaseLabel,
  type RoomMemberProfile,
  type StudyRoom,
  type StudyRoomMessage,
  type StudyRoomTimerState,
} from "@/lib/study-together/types";
import type { AccentColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type {
  AvatarPreference,
  Subject,
  Task,
  Topic,
} from "@/types/database";

type StudyRoomBoardProps = {
  room: StudyRoom;
  userId: string;
  isHost: boolean;
  canInvite: boolean;
  timer: StudyRoomTimerState;
  members: RoomMemberProfile[];
  messages: StudyRoomMessage[];
  serverNow: string;
  friends: FriendListItem[];
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  preferences: FocusPreferences;
};

export function StudyRoomBoard({
  room,
  userId,
  isHost,
  canInvite,
  timer: initialTimer,
  members,
  messages,
  serverNow,
  friends,
  subjects,
  topics,
  tasks,
  preferences,
}: StudyRoomBoardProps) {
  const router = useRouter();
  const roomTimer = useRoomTimer({
    roomId: room.id,
    initialTimer,
    serverNowIso: serverNow,
    enabled: room.status === "active",
  });

  const [personallyFocusing, setPersonallyFocusing] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [goal, setGoal] = useState("");
  const [distractionFree, setDistractionFree] = useState(false);
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
  const [personalFocusSec, setPersonalFocusSec] = useState(0);

  const clientSessionId = useRef(crypto.randomUUID());
  const startedAtIso = useRef<string | null>(null);
  const focusMsRef = useRef(0);
  const breakMsRef = useRef(0);
  const lastTickRef = useRef(0);
  const cyclesRef = useRef(0);

  const phase = roomTimer.timer?.phase ?? "idle";
  const runState = roomTimer.timer?.run_state ?? "idle";
  const presenceStatus = derivePersonalPresence(
    phase,
    runState,
    personallyFocusing,
  );

  const presence = useRoomPresence({
    roomId: room.id,
    userId,
    enabled: room.status === "active",
    status: presenceStatus,
    isHost,
  });

  // Personal focus accrual (local only; never trusts host alone)
  useEffect(() => {
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const prev = lastTickRef.current || now;
      const delta = now - prev;
      lastTickRef.current = now;
      const gained = accruePersonalFocusMs({
        roomPhase: phase,
        roomRun: runState,
        personallyFocusing,
        connected: presence.connected,
        deltaMs: delta,
      });
      focusMsRef.current += gained;
      if (gained > 0) {
        setPersonalFocusSec(Math.round(focusMsRef.current / 1000));
      }
      if (isBreakPhase(phase) && runState === "running") {
        breakMsRef.current += delta;
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, runState, personallyFocusing, presence.connected]);

  useEffect(() => {
    if (
      phase === "focus" &&
      runState === "running" &&
      personallyFocusing &&
      !startedAtIso.current
    ) {
      startedAtIso.current = new Date().toISOString();
    }
  }, [phase, runState, personallyFocusing]);

  useEffect(() => {
    const prev = roomTimer.timer?.completed_focus_intervals ?? 0;
    if (prev > cyclesRef.current) cyclesRef.current = prev;
  }, [roomTimer.timer?.completed_focus_intervals]);

  // Local cue on phase change
  const lastPhaseRef = useRef(phase);
  useEffect(() => {
    if (lastPhaseRef.current === phase) return;
    lastPhaseRef.current = phase;
    if (!preferences.focus_sound_enabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = isBreakPhase(phase) ? 523 : 440;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      /* autoplay */
    }
    toast.message(
      phase === "focus"
        ? "Focus interval"
        : phase === "idle"
          ? "Room idle"
          : "Break time",
    );
  }, [phase, preferences.focus_sound_enabled]);

  const ringStyle = {
    background: `conic-gradient(var(--primary) ${roomTimer.progress * 360}deg, color-mix(in oklch, var(--muted) 80%, transparent) 0deg)`,
  };

  function runHost(action: Parameters<typeof roomTimer.command>[0]) {
    startTransition(async () => {
      const result = await roomTimer.command(action);
      if (result.error) toast.error(result.error);
    });
  }

  async function savePersonal(): Promise<boolean> {
    const focusSeconds = Math.round(focusMsRef.current / 1000);
    if (focusSeconds < 30) {
      toast.error("Need at least 30 seconds of personal focus time to save.");
      return false;
    }
    const started =
      startedAtIso.current ??
      new Date(Date.now() - focusMsRef.current).toISOString();
    const result = await saveStudyTogetherSession({
      client_session_id: clientSessionId.current,
      room_id: room.id,
      subject_id: subjectId || null,
      topic_id: topicId || null,
      task_id: taskId || null,
      goal,
      focus_seconds: focusSeconds,
      break_seconds: Math.round(breakMsRef.current / 1000),
      pomodoro_cycles: cyclesRef.current,
      started_at: started,
      ended_at: new Date().toISOString(),
    });
    if (result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.success ?? "Saved");
    clientSessionId.current = crypto.randomUUID();
    focusMsRef.current = 0;
    breakMsRef.current = 0;
    setPersonalFocusSec(0);
    startedAtIso.current = null;
    setPersonallyFocusing(false);
    return true;
  }

  const filteredTopics = topics.filter((t) =>
    subjectId ? t.subject_id === subjectId : true,
  );
  const filteredTasks = tasks.filter(
    (t) =>
      t.status === "todo" &&
      (subjectId ? t.subject_id === subjectId || !t.subject_id : true),
  );

  const liveIds = new Set(presence.participants.map((p) => p.userId));
  const statusById = new Map(
    presence.participants.map((p) => [p.userId, p.status]),
  );

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
            onClick={() => setDistractionFree(false)}
          >
            <Minimize2 className="size-4" />
            Exit focus view
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">{room.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {room.description || "Shared Pomodoro room"} ·{" "}
            {presence.connected ? "Connected" : "Reconnecting…"} ·{" "}
            {presence.participants.length} live
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/study-together"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Hub
          </Link>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                if (focusMsRef.current >= 30_000) {
                  await savePersonal();
                }
                const result = await leaveRoom(room.id);
                if (result.error) toast.error(result.error);
                else router.push("/study-together");
              })
            }
          >
            Leave
          </Button>
          {isHost ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                if (!confirm("End this room for everyone?")) return;
                startTransition(async () => {
                  const result = await endRoom(room.id);
                  if (result.error) toast.error(result.error);
                  else router.push("/study-together");
                });
              }}
            >
              End room
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6",
          distractionFree
            ? "mx-auto max-w-xl flex-1 content-center"
            : "xl:grid-cols-[1.2fr_0.8fr]",
        )}
      >
        <section className="studi-panel flex flex-col items-center gap-6 p-6 sm:p-10">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {phaseLabel(phase)}
            {roomTimer.timer
              ? ` · Cycle ${Math.max(1, roomTimer.timer.cycle_number || (phase === "focus" ? 1 : 0))}`
              : null}
          </p>

          <div
            className="relative flex size-56 items-center justify-center rounded-full sm:size-64"
            style={phase !== "idle" ? ringStyle : undefined}
          >
            <div className="flex size-[85%] flex-col items-center justify-center rounded-full border border-border bg-card">
              <p className="font-display text-5xl tracking-tight tabular-nums sm:text-6xl">
                {roomTimer.display}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                rev {roomTimer.timer?.revision ?? "—"}
              </p>
            </div>
          </div>

          {isHost ? (
            <div className="flex flex-wrap justify-center gap-2">
              {runState === "idle" || phase === "idle" ? (
                <Button type="button" className="gap-1.5" onClick={() => runHost("start")}>
                  <Play className="size-4" />
                  Start
                </Button>
              ) : null}
              {runState === "running" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => runHost("pause")}
                >
                  <Pause className="size-4" />
                  Pause
                </Button>
              ) : null}
              {runState === "paused" ? (
                <Button type="button" className="gap-1.5" onClick={() => runHost("resume")}>
                  <Play className="size-4" />
                  Resume
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => runHost("skip")}
              >
                <SkipForward className="size-4" />
                Skip
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => runHost("reset")}
              >
                <RotateCcw className="size-4" />
                Reset
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only the host controls the shared timer.
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant={personallyFocusing ? "default" : "outline"}
              size="sm"
              onClick={() => setPersonallyFocusing((v) => !v)}
            >
              {personallyFocusing ? "Focusing (you)" : "Start personal focus"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await savePersonal();
                })
              }
            >
              <Square className="size-4" />
              Save my time
            </Button>
            {!distractionFree ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setDistractionFree(true)}
              >
                <Maximize2 className="size-4" />
                Focus view
              </Button>
            ) : null}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Personal focus tracked: {personalFocusSec}s (breaks excluded).
            Subject/goal stay private.
          </p>
        </section>

        {!distractionFree ? (
          <div className="space-y-4">
            <section className="studi-panel space-y-3 p-4">
              <h3 className="font-medium">Participants</h3>
              <ul className="space-y-2">
                {members.map((m) => {
                  const live = liveIds.has(m.id);
                  const status = statusById.get(m.id) ?? "idle";
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <StudiAvatar
                          profile={{
                            display_name: m.display_name,
                            username: m.username,
                            accent_color: m.accent_color as AccentColor,
                            avatar_preference:
                              m.avatar_preference as AvatarPreference,
                            avatar_path: null,
                            google_avatar_url: null,
                          }}
                          src={m.avatarSrc}
                          size="sm"
                          showOnline
                          online={live}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {m.display_name || m.username}
                            {m.isHost ? " · Host" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {live ? status.replace("_", " ") : "offline"}
                          </p>
                        </div>
                      </div>
                      {isHost && m.id !== userId ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              startTransition(async () => {
                                const result = await transferHost(room.id, m.id);
                                if (result.error) toast.error(result.error);
                                else toast.success("Host transferred");
                              })
                            }
                          >
                            Make host
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              startTransition(async () => {
                                const result = await kickMember(room.id, m.id);
                                if (result.error) toast.error(result.error);
                              })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="studi-panel space-y-3 p-4">
              <h3 className="font-medium">Your study (private)</h3>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="st-subject">Subject</Label>
                  <select
                    id="st-subject"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">None</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="st-topic">Topic</Label>
                  <select
                    id="st-topic"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                  >
                    <option value="">None</option>
                    {filteredTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="st-task">Task</Label>
                  <select
                    id="st-task"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">None</option>
                    {filteredTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="st-goal">Goal</Label>
                  <Input
                    id="st-goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    maxLength={200}
                    placeholder="Only you can see this"
                  />
                </div>
              </div>
            </section>

            <SoundscapeControls
              primary={primary}
              secondary={secondary}
              volume={volume}
              secondaryVolume={secondaryVolume}
              onPrimaryChange={setPrimary}
              onSecondaryChange={setSecondary}
              onVolumeChange={setVolume}
              onSecondaryVolumeChange={setSecondaryVolume}
              enabled={preferences.focus_sound_enabled}
            />

            <RoomInvitePanel
              roomId={room.id}
              friends={friends}
              memberIds={members.map((m) => m.id)}
              canInvite={canInvite}
            />

            <RoomChat
              roomId={room.id}
              userId={userId}
              enabled={room.chat_enabled}
              hidden={phase === "focus" && runState !== "idle"}
              initialMessages={messages}
              members={members}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  return shell;
}
