"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { RoomPresenceStatus } from "@/lib/study-together/types";

export type LiveParticipant = {
  userId: string;
  status: RoomPresenceStatus;
  onlineAt: string;
};

/**
 * Room-scoped Presence. Presence key = userId so multiple tabs do not
 * inflate participant counts. Topic: study-room:<roomId>.
 */
export function useRoomPresence(input: {
  roomId: string;
  userId: string;
  enabled: boolean;
  status: RoomPresenceStatus;
  isHost: boolean;
}) {
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tabKey = useMemo(() => {
    if (typeof window === "undefined") return "ssr";
    const existing = sessionStorage.getItem("studi-tab-key");
    if (existing) return existing;
    const k = crypto.randomUUID();
    sessionStorage.setItem("studi-tab-key", k);
    return k;
  }, []);

  useEffect(() => {
    if (!input.enabled) return;

    const supabase = createClient();
    const topic = `study-room:${input.roomId}`;
    const channel = supabase.channel(topic, {
      config: {
        private: true,
        presence: { key: input.userId },
      },
    });
    channelRef.current = channel;

    const sync = () => {
      const state = channel.presenceState<{
        user_id: string;
        status: RoomPresenceStatus;
        tab_key: string;
        is_host: boolean;
        online_at: string;
      }>();
      const byUser = new Map<string, LiveParticipant>();
      for (const [userId, metas] of Object.entries(state)) {
        const meta = metas[0];
        if (!meta) continue;
        byUser.set(userId, {
          userId,
          status: meta.status,
          onlineAt: meta.online_at,
        });
      }
      setParticipants(Array.from(byUser.values()));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({
            user_id: input.userId,
            status: input.status,
            tab_key: tabKey,
            is_host: input.isHost,
            online_at: new Date().toISOString(),
          });
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnected(false);
        }
      });

    return () => {
      channelRef.current = null;
      setConnected(false);
      void supabase.removeChannel(channel);
    };
    // status intentionally omitted — tracked in separate effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled, input.roomId, input.userId, input.isHost, tabKey]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!input.enabled || !connected || !channel) return;
    void channel.track({
      user_id: input.userId,
      status: input.status,
      tab_key: tabKey,
      is_host: input.isHost,
      online_at: new Date().toISOString(),
    });
  }, [
    input.status,
    input.enabled,
    input.userId,
    input.isHost,
    connected,
    tabKey,
  ]);

  return { participants, connected };
}
