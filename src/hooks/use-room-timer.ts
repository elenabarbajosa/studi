"use client";

import { useEffect, useState, useTransition } from "react";

import { reconcileRoomTimer, roomTimerCommand } from "@/actions/study-together";
import { createClient } from "@/lib/supabase/client";
import {
  estimateClockOffsetMs,
  formatTimerMs,
  progress01FromTimer,
  remainingMsFromTimer,
  shouldPreferRevision,
} from "@/lib/study-together/timer-sync";
import type {
  RoomTimerAction,
  StudyRoomTimerState,
} from "@/lib/study-together/types";

export function useRoomTimer(input: {
  roomId: string;
  initialTimer: StudyRoomTimerState | null;
  serverNowIso: string;
  enabled: boolean;
}) {
  const [timer, setTimer] = useState<StudyRoomTimerState | null>(
    input.initialTimer,
  );
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [now, setNow] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const boot = window.setTimeout(() => {
      const wall = Date.now();
      setClockOffsetMs(estimateClockOffsetMs(input.serverNowIso, wall));
      setNow(wall);
    }, 0);
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [input.serverNowIso]);

  useEffect(() => {
    if (!input.enabled || !timer || now === 0) return;
    if (timer.run_state !== "running" || !timer.phase_ends_at) return;
    const serverNow = now + clockOffsetMs;
    const remaining = remainingMsFromTimer(timer, serverNow);
    if (remaining !== 0) return;
    startTransition(async () => {
      const result = await reconcileRoomTimer(input.roomId);
      if (
        result.timer &&
        shouldPreferRevision(result.timer.revision, timer.revision)
      ) {
        setTimer(result.timer);
        setClockOffsetMs(
          estimateClockOffsetMs(result.timer.updated_at, Date.now()),
        );
      }
    });
  }, [input.enabled, input.roomId, timer, now, clockOffsetMs]);

  useEffect(() => {
    if (!input.enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`room-timer-${input.roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_room_timer_state",
          filter: `room_id=eq.${input.roomId}`,
        },
        (payload) => {
          const next = payload.new as StudyRoomTimerState | undefined;
          if (!next?.revision) return;
          setTimer((current) => {
            if (
              current &&
              !shouldPreferRevision(next.revision, current.revision)
            ) {
              return current;
            }
            return next;
          });
          setClockOffsetMs(
            estimateClockOffsetMs(next.updated_at, Date.now()),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [input.enabled, input.roomId]);

  function applyTimer(next: StudyRoomTimerState) {
    setTimer(next);
    setClockOffsetMs(estimateClockOffsetMs(next.updated_at, Date.now()));
  }

  function command(action: RoomTimerAction) {
    if (!timer) return Promise.resolve({ error: "No timer" });
    const revision = timer.revision;
    return new Promise<{ error?: string; success?: string }>((resolve) => {
      startTransition(async () => {
        const result = await roomTimerCommand(
          input.roomId,
          action,
          revision,
        );
        if (result.timer) applyTimer(result.timer);
        resolve(result);
      });
    });
  }

  const serverNow = now + clockOffsetMs;
  const remaining =
    timer && now > 0 ? remainingMsFromTimer(timer, serverNow) : null;
  const progress =
    timer && now > 0 ? progress01FromTimer(timer, serverNow) : 0;

  return {
    timer,
    remaining,
    display: remaining == null ? "00:00" : formatTimerMs(remaining),
    progress,
    isPending,
    command,
    applyTimer,
  };
}
