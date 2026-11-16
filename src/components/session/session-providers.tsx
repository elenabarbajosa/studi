"use client";

import { FocusSessionProvider } from "@/components/session/focus-session-provider";
import { SessionMiniPlayer } from "@/components/session/session-mini-player";
import { StudyTogetherSessionProvider } from "@/components/session/study-together-session-provider";

export function SessionProviders({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <FocusSessionProvider userId={userId}>
      <StudyTogetherSessionProvider userId={userId}>
        {children}
        <SessionMiniPlayer />
      </StudyTogetherSessionProvider>
    </FocusSessionProvider>
  );
}
