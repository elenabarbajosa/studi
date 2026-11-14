import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  SettingsSectionView,
  type SettingsBundle,
} from "@/components/settings/settings-section-view";
import {
  isSettingsSection,
  type SettingsSection,
} from "@/components/settings/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { resolveAvatarSrc } from "@/lib/avatar-server";
import type { SoundscapeId } from "@/lib/calendar";
import { getGamificationPreferences } from "@/lib/data/progress";
import { getStudyPreferences } from "@/lib/data/subjects";
import type { FocusPreferences } from "@/lib/focus/types";

type PageProps = {
  params: Promise<{ section: string }>;
};

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
    soundscape_primary: (prefs?.soundscape_primary ??
      "silence") as SoundscapeId,
    soundscape_secondary: (prefs?.soundscape_secondary ??
      "silence") as SoundscapeId,
    soundscape_volume: prefs?.soundscape_volume ?? 0.45,
    soundscape_secondary_volume: prefs?.soundscape_secondary_volume ?? 0,
  };
}

async function loadBundle(): Promise<SettingsBundle> {
  const { profile } = await requireProfile();
  const [preferences, avatarSrc, gamification] = await Promise.all([
    getStudyPreferences(),
    resolveAvatarSrc(profile),
    getGamificationPreferences(),
  ]);
  return {
    profile,
    avatarSrc,
    preferences,
    focusPreferences: toFocusPrefs(preferences),
    gamification,
  };
}

async function SectionContent({ params }: PageProps) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  const data = await loadBundle();
  return <SettingsSectionView section={section} data={data} />;
}

function SectionFallback() {
  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <Skeleton className="h-8 w-36 rounded-xl" />
      <div className="grid gap-5 min-[960px]:grid-cols-[220px_minmax(0,1fr)]">
        <Skeleton className="hidden h-80 rounded-[18px] min-[960px]:block" />
        <Skeleton className="h-[420px] rounded-[22px]" />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { section } = await params;
  if (!isSettingsSection(section)) return { title: "Settings" };
  const labels: Record<SettingsSection, string> = {
    profile: "Profile",
    appearance: "Appearance",
    focus: "Focus & Pomodoro",
    study: "Study rhythm",
    privacy: "Privacy",
    progress: "Progress & badges",
    account: "Account",
  };
  return { title: `${labels[section]} · Settings` };
}

export default function SettingsSectionPage(props: PageProps) {
  return (
    <Suspense fallback={<SectionFallback />}>
      <SectionContent {...props} />
    </Suspense>
  );
}
