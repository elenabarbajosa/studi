import { Suspense } from "react";

import { FocusBoard } from "@/components/focus/focus-board";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import {
  getTodayFocusSeconds,
  listCompletedFocusSessions,
} from "@/lib/data/focus";
import { listTasks } from "@/lib/data/calendar";
import { getStudyPreferences, listAllTopics, listSubjects } from "@/lib/data/subjects";
import type { FocusPreferences } from "@/lib/focus/types";
import type { SoundscapeId } from "@/lib/calendar";

export const metadata = { title: "Focus" };

function toFocusPrefs(
  prefs: Awaited<ReturnType<typeof getStudyPreferences>>,
): FocusPreferences {
  return {
    pomodoro_focus_minutes: prefs?.pomodoro_focus_minutes ?? 25,
    pomodoro_short_break_minutes: prefs?.pomodoro_short_break_minutes ?? 5,
    pomodoro_long_break_minutes: prefs?.pomodoro_long_break_minutes ?? 15,
    pomodoro_intervals_before_long:
      prefs?.pomodoro_intervals_before_long ?? 4,
    auto_start_breaks: prefs?.auto_start_breaks ?? false,
    focus_sound_enabled: prefs?.focus_sound_enabled ?? true,
    soundscape_primary: (prefs?.soundscape_primary ?? "silence") as SoundscapeId,
    soundscape_secondary: (prefs?.soundscape_secondary ??
      "silence") as SoundscapeId,
    soundscape_volume: prefs?.soundscape_volume ?? 0.45,
    soundscape_secondary_volume: prefs?.soundscape_secondary_volume ?? 0,
  };
}

async function FocusContent() {
  await requireProfile();
  const [subjects, topics, tasks, preferences, todayFocusSeconds, recent] =
    await Promise.all([
      listSubjects(),
      listAllTopics(),
      listTasks(),
      getStudyPreferences(),
      getTodayFocusSeconds(),
      listCompletedFocusSessions(12),
    ]);

  return (
    <div>
      <PageHeader
        title="Focus"
        description="Pomodoro or stopwatch — only real active focus time is saved."
      />
      <FocusBoard
        subjects={subjects}
        topics={topics}
        tasks={tasks}
        preferences={toFocusPrefs(preferences)}
        todayFocusSeconds={todayFocusSeconds}
        recentSessions={recent}
      />
    </div>
  );
}

function FocusFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={<FocusFallback />}>
      <FocusContent />
    </Suspense>
  );
}
