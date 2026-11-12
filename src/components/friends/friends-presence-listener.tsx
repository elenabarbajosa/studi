"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Optional low-frequency refresh when friends' presence rows change.
 * Relies on RLS — users only receive updates they are allowed to read.
 * Does not subscribe to high-frequency timer ticks.
 */
export function FriendsPresenceListener({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel("friends-presence-db")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => {
          const now = Date.now();
          if (now - lastRefresh.current < 15_000) return;
          lastRefresh.current = now;
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, router]);

  return null;
}
