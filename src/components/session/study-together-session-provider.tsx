"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  leaveRoom,
  saveStudyTogetherSession,
} from "@/actions/study-together";
import {
  useSoundscapePlayer,
  type SoundscapePlayer,
} from "@/components/focus/soundscape-controls";
import { useRoomPresence } from "@/hooks/use-room-presence";
import { useRoomTimer } from "@/hooks/use-room-timer";
import type { SoundscapeId } from "@/lib/calendar";
import type { FocusPreferences } from "@/lib/focus/types";
import { createClient } from "@/lib/supabase/client";
import {
  accruePersonalFocusMs,
  derivePersonalPresence,
} from "@/lib/study-together/timer-sync";
import {
  isBreakPhase,
  type StudyRoom,
  type StudyRoomTimerState,
} from "@/lib/study-together/types";

type RoomAttachInput = {
  room: StudyRoom;
  isHost: boolean;
  initialTimer: StudyRoomTimerState;
  serverNow: string;
  preferences: FocusPreferences;
};

type PersonalStudyMeta = {
  subjectId: string;
  topicId: string;
  taskId: string;
  goal: string;
};

type SoundscapeState = {
  primary: SoundscapeId;
  secondary: SoundscapeId;
  volume: number;
  secondaryVolume: number;
  enabled: boolean;
};

type LiveRoomApi = {
  room: StudyRoom;
  isHost: boolean;
  roomTimer: ReturnType<typeof useRoomTimer>;
  presence: ReturnType<typeof useRoomPresence>;
  personallyFocusing: boolean;
  setPersonallyFocusing: React.Dispatch<React.SetStateAction<boolean>>;
  personalFocusSec: number;
  meta: PersonalStudyMeta;
  setMeta: React.Dispatch<React.SetStateAction<PersonalStudyMeta>>;
  player: SoundscapePlayer;
  soundscape: SoundscapeState;
  setPrimary: (id: SoundscapeId) => void;
  setSecondary: (id: SoundscapeId) => void;
  setVolume: (v: number) => void;
  setSecondaryVolume: (v: number) => void;
  savePersonal: () => Promise<boolean>;
  leave: () => Promise<void>;
  clearWithoutLeave: () => void;
};

type StudyTogetherSessionContextValue = {
  live: LiveRoomApi | null;
  /** Attach or reuse an active room session (idempotent for same roomId). */
  attach: (input: RoomAttachInput) => void;
  /** Drop local session state without calling leaveRoom (e.g. room ended). */
  clearLocal: () => void;
};

const StudyTogetherSessionContext =
  React.createContext<StudyTogetherSessionContextValue | null>(null);

type Attachment = RoomAttachInput & { userId: string };

function StudyTogetherRuntime({
  attachment,
  onClearLocal,
  registerLive,
}: {
  attachment: Attachment;
  onClearLocal: () => void;
  registerLive: (live: LiveRoomApi | null) => void;
}) {
  const router = useRouter();
  const { room, isHost, initialTimer, serverNow, preferences, userId } =
    attachment;

  const roomTimer = useRoomTimer({
    roomId: room.id,
    initialTimer,
    serverNowIso: serverNow,
    enabled: room.status === "active",
  });

  const [personallyFocusing, setPersonallyFocusing] = React.useState(false);
  const [meta, setMeta] = React.useState<PersonalStudyMeta>({
    subjectId: "",
    topicId: "",
    taskId: "",
    goal: "",
  });
  const [soundscape, setSoundscape] = React.useState<SoundscapeState>({
    primary: preferences.soundscape_primary,
    secondary: preferences.soundscape_secondary,
    volume: preferences.soundscape_volume,
    secondaryVolume: preferences.soundscape_secondary_volume,
    enabled: preferences.focus_sound_enabled,
  });
  const [personalFocusSec, setPersonalFocusSec] = React.useState(0);
  const player = useSoundscapePlayer({
    enabled: soundscape.enabled,
    volume: soundscape.volume,
    secondaryVolume: soundscape.secondaryVolume,
  });

  const clientSessionId = React.useRef(crypto.randomUUID());
  const startedAtIso = React.useRef<string | null>(null);
  const focusMsRef = React.useRef(0);
  const breakMsRef = React.useRef(0);
  const lastTickRef = React.useRef(0);
  const cyclesRef = React.useRef(0);

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

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (
      phase === "focus" &&
      runState === "running" &&
      personallyFocusing &&
      !startedAtIso.current
    ) {
      startedAtIso.current = new Date().toISOString();
    }
  }, [phase, runState, personallyFocusing]);

  React.useEffect(() => {
    const prev = roomTimer.timer?.completed_focus_intervals ?? 0;
    if (prev > cyclesRef.current) cyclesRef.current = prev;
  }, [roomTimer.timer?.completed_focus_intervals]);

  const lastPhaseRef = React.useRef(phase);
  React.useEffect(() => {
    if (lastPhaseRef.current === phase) return;
    lastPhaseRef.current = phase;
    if (!soundscape.enabled) return;
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
  }, [phase, soundscape.enabled]);

  // Prefer newer server timer when remounting the room page.
  React.useEffect(() => {
    if (
      roomTimer.timer &&
      initialTimer.revision > roomTimer.timer.revision
    ) {
      roomTimer.applyTimer(initialTimer);
    }
    // Only reconcile when attachment boot data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTimer.revision, room.id]);

  const savePersonal = React.useCallback(async (): Promise<boolean> => {
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
      subject_id: meta.subjectId || null,
      topic_id: meta.topicId || null,
      task_id: meta.taskId || null,
      goal: meta.goal,
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
  }, [meta, room.id]);

  const leave = React.useCallback(async () => {
    if (focusMsRef.current >= 30_000) {
      await savePersonal();
    }
    const result = await leaveRoom(room.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    player.stop();
    onClearLocal();
    router.push("/study-together");
  }, [savePersonal, room.id, player, onClearLocal, router]);

  const clearWithoutLeave = React.useCallback(() => {
    player.stop();
    onClearLocal();
  }, [player, onClearLocal]);

  // Host ending the room should dismiss the mini-player. study_rooms is not on
  // the Realtime publication, so we poll status lightly while attached.
  React.useEffect(() => {
    if (room.status !== "active") return;
    const supabase = createClient();
    let cancelled = false;

    async function checkEnded() {
      const { data } = await supabase
        .from("study_rooms")
        .select("status")
        .eq("id", room.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.status === "ended") {
        toast.message("This room has ended");
        player.stop();
        onClearLocal();
        router.replace("/study-together");
      }
    }

    const id = window.setInterval(() => {
      void checkEnded();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [room.id, room.status, player, onClearLocal, router]);

  const live = React.useMemo<LiveRoomApi>(
    () => ({
      room,
      isHost,
      roomTimer,
      presence,
      personallyFocusing,
      setPersonallyFocusing,
      personalFocusSec,
      meta,
      setMeta,
      player,
      soundscape,
      setPrimary: (id) => setSoundscape((s) => ({ ...s, primary: id })),
      setSecondary: (id) => setSoundscape((s) => ({ ...s, secondary: id })),
      setVolume: (v) => setSoundscape((s) => ({ ...s, volume: v })),
      setSecondaryVolume: (v) =>
        setSoundscape((s) => ({ ...s, secondaryVolume: v })),
      savePersonal,
      leave,
      clearWithoutLeave,
    }),
    [
      room,
      isHost,
      roomTimer,
      presence,
      personallyFocusing,
      personalFocusSec,
      meta,
      player,
      soundscape,
      savePersonal,
      leave,
      clearWithoutLeave,
    ],
  );

  // Keep the latest live API registered. Only clear on Runtime unmount —
  // clearing in the update effect cleanup was nulling the session on every
  // timer tick and hiding the mini-player during navigation.
  React.useEffect(() => {
    registerLive(live);
  }, [live, registerLive]);

  React.useEffect(() => {
    return () => {
      registerLive(null);
    };
  }, [registerLive]);

  return null;
}

export function StudyTogetherSessionProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [attachment, setAttachment] = React.useState<Attachment | null>(null);
  const [live, setLive] = React.useState<LiveRoomApi | null>(null);
  const [activeUserId, setActiveUserId] = React.useState(userId);

  if (activeUserId !== userId) {
    setActiveUserId(userId);
    setAttachment(null);
    setLive(null);
  }

  const clearLocal = React.useCallback(() => {
    setAttachment(null);
    setLive(null);
  }, []);

  const attach = React.useCallback((input: RoomAttachInput) => {
    setAttachment((prev) => {
      if (prev && prev.room.id === input.room.id) {
        if (
          prev.isHost === input.isHost &&
          prev.serverNow === input.serverNow &&
          prev.initialTimer.revision === input.initialTimer.revision &&
          prev.room.name === input.room.name &&
          prev.room.status === input.room.status
        ) {
          return prev;
        }
        // Keep live session; refresh boot timer metadata for revision compare.
        return {
          ...prev,
          room: input.room,
          isHost: input.isHost,
          initialTimer: input.initialTimer,
          serverNow: input.serverNow,
          preferences: input.preferences,
        };
      }
      return { ...input, userId };
    });
  }, [userId]);

  const registerLive = React.useCallback((next: LiveRoomApi | null) => {
    setLive(next);
  }, []);

  const value = React.useMemo<StudyTogetherSessionContextValue>(
    () => ({
      live,
      attach,
      clearLocal,
    }),
    [live, attach, clearLocal],
  );

  return (
    <StudyTogetherSessionContext.Provider value={value}>
      {children}
      {attachment ? (
        <StudyTogetherRuntime
          key={attachment.room.id}
          attachment={attachment}
          onClearLocal={clearLocal}
          registerLive={registerLive}
        />
      ) : null}
    </StudyTogetherSessionContext.Provider>
  );
}

export function useStudyTogetherSession() {
  const ctx = React.useContext(StudyTogetherSessionContext);
  if (!ctx) {
    throw new Error(
      "useStudyTogetherSession must be used within StudyTogetherSessionProvider",
    );
  }
  return ctx;
}
