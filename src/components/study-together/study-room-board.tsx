"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Crown,
  Lock,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  SkipForward,
  SlidersHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  endRoom,
  kickMember,
  transferHost,
} from "@/actions/study-together";
import { SoundscapeControls } from "@/components/focus/soundscape-controls";
import { TimerDial } from "@/components/focus/timer-dial";
import { useStudyTogetherSession } from "@/components/session/study-together-session-provider";
import { RoomChat } from "@/components/study-together/room-chat";
import { RoomInvitePanel } from "@/components/study-together/room-invite-panel";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { Field, NativeSelect } from "@/components/studi/form-controls";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { SubjectDot, SubjectPicker } from "@/components/studi/subject-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { FriendListItem } from "@/lib/data/friends";
import type { FocusPreferences } from "@/lib/focus/types";
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

const darkRing = "focus-visible:shadow-[0_0_0_2px_#1F1A1C,0_0_0_4px_var(--accent)]";
const darkPill = cn(
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 text-[13.5px] font-medium text-[#F3ECEE] outline-none transition-colors hover:bg-white/[0.14] disabled:opacity-40",
  darkRing,
);
const darkIcon = cn(
  "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#F3ECEE] outline-none transition-colors hover:bg-white/[0.14] disabled:opacity-40",
  darkRing,
);

const STATUS_STYLE: Record<string, { label: string; dot: string; ring: string }> = {
  focusing: { label: "Focusing", dot: "bg-accent", ring: "var(--accent)" },
  on_break: { label: "On break", dot: "bg-[#E0A84F]", ring: "#E0A84F" },
  idle: { label: "Here", dot: "bg-white/40", ring: "rgba(255,255,255,0.25)" },
};

function formatSeconds(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

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
  const { live: sessionLive, attach } = useStudyTogetherSession();
  const live = sessionLive?.room.id === room.id ? sessionLive : null;

  const [distractionFree, setDistractionFree] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    attach({
      room,
      isHost,
      initialTimer,
      serverNow,
      preferences,
    });
  }, [
    attach,
    room,
    isHost,
    initialTimer,
    serverNow,
    preferences,
  ]);

  useEffect(() => {
    if (!distractionFree) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDistractionFree(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [distractionFree]);

  if (!live) {
    return (
      <div
        aria-busy
        className="-mx-4 -mt-[max(18px,env(safe-area-inset-top))] -mb-6 flex min-h-[calc(100svh-76px)] items-center justify-center bg-[#1F1A1C] sm:-mx-5 md:m-0 md:rounded-[22px]"
      >
        <Skeleton className="size-[300px] rounded-full bg-white/[0.06]" />
      </div>
    );
  }

  const {
    roomTimer,
    presence,
    personallyFocusing,
    setPersonallyFocusing,
    personalFocusSec,
    meta,
    setMeta,
    player,
    soundscape,
    setPrimary,
    setSecondary,
    setVolume,
    setSecondaryVolume,
    savePersonal,
    leave: leaveSession,
    clearWithoutLeave,
  } = live;

  const subjectId = meta.subjectId;
  const topicId = meta.topicId;
  const taskId = meta.taskId;
  const goal = meta.goal;

  const phase = roomTimer.timer?.phase ?? "idle";
  const runState = roomTimer.timer?.run_state ?? "idle";

  function runHost(action: Parameters<typeof roomTimer.command>[0]) {
    startTransition(async () => {
      const result = await roomTimer.command(action);
      if (result.error) toast.error(result.error);
    });
  }

  function leave() {
    startTransition(async () => {
      await leaveSession();
    });
  }

  /** Keep membership + runtime; return to the normal Studi shell with mini-player. */
  function minimize() {
    setDistractionFree(false);
    router.push("/dashboard");
  }

  function end() {
    if (!confirm("End this room for everyone?")) return;
    startTransition(async () => {
      const result = await endRoom(room.id);
      if (result.error) toast.error(result.error);
      else {
        clearWithoutLeave();
        router.push("/study-together");
      }
    });
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

  const host = members.find((m) => m.isHost);
  const perCycle = room.intervals_before_long;
  const completed = roomTimer.timer?.completed_focus_intervals ?? 0;
  const inCycle = completed % perCycle;
  const cycleDone = isBreakPhase(phase) && inCycle === 0 && completed > 0 ? perCycle : inCycle;
  const cycleNumber = Math.max(1, roomTimer.timer?.cycle_number || (phase === "focus" ? 1 : 0));
  const dialLabel =
    phase === "idle"
      ? "Waiting for the host"
      : `${phaseLabel(phase)}${runState === "paused" ? " · paused" : ""} · cycle ${((cycleNumber - 1) % perCycle) + 1} of ${perCycle}`;
  const chatLocked = phase === "focus" && runState !== "idle";
  const subject = subjects.find((s) => s.id === subjectId);

  const soundProps = {
    player,
    primary: soundscape.primary,
    secondary: soundscape.secondary,
    volume: soundscape.volume,
    secondaryVolume: soundscape.secondaryVolume,
    enabled: soundscape.enabled,
    onPrimaryChange: setPrimary,
    onSecondaryChange: setSecondary,
    onVolumeChange: setVolume,
    onSecondaryVolumeChange: setSecondaryVolume,
  };

  const PrimaryIcon = runState === "running" ? Pause : Play;
  const primaryLabel =
    runState === "running" ? "Pause for everyone" : runState === "paused" ? "Resume for everyone" : "Start the shared timer";
  const primaryAction = runState === "running" ? "pause" : runState === "paused" ? "resume" : "start";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-[#1F1A1C] text-[#F3ECEE] [color-scheme:dark] xl:flex-row",
        distractionFree
          ? "fixed inset-0 z-50"
          : "-mx-4 -mt-[max(18px,env(safe-area-inset-top))] -mb-6 min-h-[calc(100svh-76px)] sm:-mx-5 md:m-0 md:rounded-[22px]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,#33242A_0%,#1F1A1C_70%)] px-4 pt-[max(16px,env(safe-area-inset-top))] pb-5 sm:px-6 md:px-7 md:pt-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {!distractionFree ? (
            <Link
              href="/study-together"
              className={cn(
                "-ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-1.5 text-[13.5px] text-white/70 outline-none hover:text-white",
                darkRing,
              )}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Rooms
            </Link>
          ) : null}
          <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-[-0.02em] md:text-[22px]">
            {room.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-1 text-[12.5px] font-semibold text-white/70">
            {room.visibility === "private" ? (
              <Lock className="size-3" aria-hidden />
            ) : (
              <Users className="size-3" aria-hidden />
            )}
            {room.visibility === "private" ? "Private" : "Friends only"} · {members.length} of{" "}
            {room.max_participants}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className={darkPill}
              onClick={minimize}
              aria-label="Minimize room and return to Studi"
            >
              <Minimize2 className="size-4" aria-hidden />
              Minimize
            </button>
            {canInvite && !distractionFree ? (
              <button type="button" className={darkPill} onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Invite</span>
                <span className="sr-only sm:hidden">Invite friends</span>
              </button>
            ) : null}
            <button
              type="button"
              className={darkIcon}
              onClick={() => setDistractionFree((v) => !v)}
              aria-label={
                distractionFree
                  ? "Exit distraction-free view"
                  : "Enter distraction-free view"
              }
            >
              {distractionFree ? (
                <Minimize2 className="size-4" aria-hidden />
              ) : (
                <Maximize2 className="size-4" aria-hidden />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className={darkIcon} aria-label="Room options">
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={minimize}>
                  <Minimize2 aria-hidden />
                  Minimize to Studi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStudyOpen(true)}>
                  <SlidersHorizontal aria-hidden />
                  My study & sounds
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await savePersonal();
                    })
                  }
                >
                  <Save aria-hidden />
                  Save my time
                </DropdownMenuItem>
                {isHost ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" disabled={isPending} onClick={end}>
                      End room for everyone
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className={cn(darkPill, "text-accent")}
              disabled={isPending}
              onClick={leave}
            >
              Leave
            </button>
          </div>
        </div>

        {/* Stage */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 md:py-8">
          <div className="w-full max-w-[min(340px,78vw)] md:max-w-[380px]">
            <TimerDial
              tone="dark"
              progress={phase === "idle" ? 0 : roomTimer.progress}
              time={roomTimer.display}
              label={dialLabel}
              cycle={
                phase === "idle"
                  ? undefined
                  : { total: perCycle, done: cycleDone, current: phase === "focus" }
              }
            />
          </div>
          <p className="-mt-1 flex items-center gap-1.5 text-[13px] text-white/60" aria-live="polite">
            <RefreshCw
              className={cn("size-3.5", !presence.connected && "animate-spin motion-reduce:animate-none")}
              aria-hidden
            />
            {presence.connected ? "Synced" : "Reconnecting…"}
            {host ? ` · host ${host.id === userId ? "you" : host.display_name || host.username}` : ""}
          </p>

          {isHost ? (
            <div className="flex items-center gap-5">
              <button
                type="button"
                aria-label="Reset the shared timer"
                disabled={isPending}
                onClick={() => runHost("reset")}
                className={cn(
                  "flex size-[52px] items-center justify-center rounded-full bg-white/[0.08] outline-none hover:bg-white/[0.14] disabled:opacity-40",
                  darkRing,
                )}
              >
                <RotateCcw className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={primaryLabel}
                disabled={isPending}
                onClick={() => runHost(primaryAction)}
                className={cn(
                  "flex size-[76px] items-center justify-center rounded-full bg-accent text-[#241c1f] outline-none transition-transform active:scale-95 disabled:opacity-60 motion-reduce:active:scale-100",
                  darkRing,
                )}
              >
                <PrimaryIcon
                  className={cn("size-7", PrimaryIcon === Play && "translate-x-[2px] fill-current")}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                aria-label="Skip to the next phase"
                disabled={isPending || phase === "idle"}
                onClick={() => runHost("skip")}
                className={cn(
                  "flex size-[52px] items-center justify-center rounded-full bg-white/[0.08] outline-none hover:bg-white/[0.14] disabled:opacity-40",
                  darkRing,
                )}
              >
                <SkipForward className="size-5" aria-hidden />
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-white/50">The host runs the shared timer.</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              aria-pressed={personallyFocusing}
              onClick={() => setPersonallyFocusing(!personallyFocusing)}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full px-[18px] text-[14px] font-semibold outline-none transition-colors",
                darkRing,
                personallyFocusing
                  ? "bg-accent text-[#241c1f]"
                  : "bg-white/[0.08] text-[#F3ECEE] hover:bg-white/[0.14]",
              )}
            >
              {personallyFocusing ? (
                <>
                  <span className="size-2 rounded-full bg-[#241c1f]" aria-hidden />
                  I’m focusing · {formatSeconds(personalFocusSec)}
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" aria-hidden />
                  {personalFocusSec > 0 ? `Resume my focus · ${formatSeconds(personalFocusSec)}` : "Count my focus"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStudyOpen(true)}
              className={cn(
                "inline-flex h-11 max-w-[280px] items-center gap-2 rounded-full bg-white/[0.08] px-[18px] text-[14px] font-medium outline-none hover:bg-white/[0.14]",
                darkRing,
              )}
            >
              {subject ? <SubjectDot color={subject.color} /> : <SlidersHorizontal className="size-4" aria-hidden />}
              <span className="truncate">
                {goal ? `My goal: ${goal}` : subject ? subject.name : "My study & sounds"}
              </span>
            </button>
            {personalFocusSec >= 30 && !personallyFocusing ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await savePersonal();
                  })
                }
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.08] px-[18px] text-[14px] font-medium outline-none hover:bg-white/[0.14] disabled:opacity-40",
                  darkRing,
                )}
              >
                <Save className="size-4" aria-hidden />
                Save my time
              </button>
            ) : null}
          </div>

          <SoundscapeControls {...soundProps} variant="immersive" />
        </div>

        {/* Participants */}
        {!distractionFree ? (
          <ul
            aria-label="Participants"
            className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:justify-center md:px-0"
          >
            {members.map((m) => {
              const live = liveIds.has(m.id);
              const status = statusById.get(m.id) ?? "idle";
              const style = STATUS_STYLE[status] ?? STATUS_STYLE.idle;
              return (
                <li
                  key={m.id}
                  className={cn(
                    "relative flex w-[148px] shrink-0 snap-start flex-col items-center gap-2 rounded-[20px] bg-white/[0.06] px-3 py-3.5 transition-opacity md:w-[164px]",
                    !live && "opacity-50",
                  )}
                >
                  <span
                    className="rounded-full"
                    style={{ boxShadow: live ? `0 0 0 3px #2B2427, 0 0 0 5px ${style.ring}` : undefined }}
                  >
                    <StudiAvatar
                      profile={{
                        display_name: m.display_name,
                        username: m.username,
                        accent_color: m.accent_color as AccentColor,
                        avatar_preference: m.avatar_preference as AvatarPreference,
                        avatar_path: null,
                        google_avatar_url: null,
                      }}
                      src={m.avatarSrc}
                      size={52}
                    />
                  </span>
                  <span className="flex max-w-full items-center gap-1 text-[14px] font-semibold">
                    <span className="truncate">{m.id === userId ? "You" : m.display_name || m.username}</span>
                    {m.isHost ? <Crown className="size-3.5 shrink-0 text-[#E0A84F]" aria-label="Host" /> : null}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-white/60">
                    <span className={cn("size-1.5 rounded-full", live ? style.dot : "bg-white/25")} aria-hidden />
                    {live ? style.label : "Away"}
                  </span>
                  {isHost && m.id !== userId ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Manage ${m.display_name || m.username}`}
                        className={cn(
                          "absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full text-white/50 outline-none hover:bg-white/10 hover:text-white",
                          darkRing,
                        )}
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await transferHost(room.id, m.id);
                              if (result.error) toast.error(result.error);
                              else toast.success("Host transferred");
                            })
                          }
                        >
                          <Crown aria-hidden />
                          Make host
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await kickMember(room.id, m.id);
                              if (result.error) toast.error(result.error);
                            })
                          }
                        >
                          Remove from room
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="mt-4 text-center text-[12px] text-white/45">
          Only your own active focus counts, breaks excluded. Your subject and goal stay private.
        </p>
      </div>

      {!distractionFree ? (
        <aside className="flex min-h-[420px] flex-col border-t border-white/[0.06] bg-[#171315] xl:w-[340px] xl:shrink-0 xl:border-t-0 xl:border-l">
          <RoomChat
            roomId={room.id}
            userId={userId}
            enabled={room.chat_enabled}
            hidden={chatLocked}
            initialMessages={messages}
            members={members}
            className="flex-1"
          />
        </aside>
      ) : null}

      <ResponsiveDialog
        open={studyOpen}
        onOpenChange={setStudyOpen}
        title="My study"
        description="Only you can see this. It’s saved with your own focus time."
      >
        <div className="flex flex-col gap-5 pb-2">
          <SubjectPicker
            subjects={subjects}
            value={subjectId}
            onChange={(id) => {
              setMeta((prev) => ({ ...prev, subjectId: id, topicId: "" }));
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Topic" htmlFor="st-topic" optional>
              <NativeSelect
                id="st-topic"
                value={topicId}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, topicId: e.target.value }))
                }
              >
                <option value="">None</option>
                {filteredTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Task" htmlFor="st-task" optional>
              <NativeSelect
                id="st-task"
                value={taskId}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, taskId: e.target.value }))
                }
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
          <Field label="Goal" htmlFor="st-goal" optional>
            <Input
              id="st-goal"
              value={goal}
              onChange={(e) =>
                setMeta((prev) => ({ ...prev, goal: e.target.value }))
              }
              maxLength={200}
              placeholder="e.g. Exercises 4–9"
            />
          </Field>
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-medium text-ink-2">Ambience</p>
            <SoundscapeControls {...soundProps} />
          </div>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog open={inviteOpen} onOpenChange={setInviteOpen} title="Invite friends">
        <RoomInvitePanel
          roomId={room.id}
          friends={friends}
          memberIds={members.map((m) => m.id)}
          canInvite={canInvite}
        />
      </ResponsiveDialog>
    </div>
  );
}
