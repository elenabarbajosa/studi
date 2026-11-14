import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { GamificationSettingsForm } from "@/components/progress/gamification-settings-form";
import { FocusPreferencesForm } from "@/components/settings/focus-preferences-form";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { StudyPreferencesForm } from "@/components/settings/study-preferences-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { resolveAvatarSrc } from "@/lib/avatar-server";
import type { SoundscapeId } from "@/lib/calendar";
import { getGamificationPreferences } from "@/lib/data/progress";
import { getStudyPreferences } from "@/lib/data/subjects";
import type { FocusPreferences } from "@/lib/focus/types";
import { canResumeOnboarding, onboardingLabel } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };

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

async function SettingsContent() {
  const { profile } = await requireProfile();
  const [preferences, avatarSrc, gamification] = await Promise.all([
    getStudyPreferences(),
    resolveAvatarSrc(profile),
    getGamificationPreferences(),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile, appearance, study rhythm, and account."
      />

      <div className="space-y-8">
        <SettingsForm profile={profile} avatarSrc={avatarSrc} />
        <PrivacySettingsForm profile={profile} />
        <GamificationSettingsForm
          prefs={gamification}
          weeklyGoalHours={preferences?.weekly_goal_hours ?? null}
        />
        <StudyPreferencesForm preferences={preferences} />
        <FocusPreferencesForm preferences={toFocusPrefs(preferences)} />

        {canResumeOnboarding(profile) ? (
          <section className="studi-panel p-6 sm:p-8">
            <h2 className="font-display text-2xl tracking-tight">Onboarding</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Status: {onboardingLabel(profile.onboarding_status)}. You can
              resume the setup wizard anytime.
            </p>
            <Link
              href="/onboarding?resume=1"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              Resume onboarding
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SettingsFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent />
    </Suspense>
  );
}
