"use client";

import { AccountSettings } from "@/components/settings/account-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { FocusPreferencesForm } from "@/components/settings/focus-preferences-form";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { SettingsSaveProvider, useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { SettingsShell } from "@/components/settings/settings-shell";
import type { SettingsSection } from "@/components/settings/settings-nav";
import { StudyPreferencesForm } from "@/components/settings/study-preferences-form";
import { GamificationSettingsForm } from "@/components/progress/gamification-settings-form";
import type { FocusPreferences } from "@/lib/focus/types";
import type { GamificationPreferences } from "@/lib/progress/types";
import type { AppearanceMode } from "@/lib/theme";
import type { Profile, StudyPreferences } from "@/types/database";

export type SettingsBundle = {
  profile: Profile;
  avatarSrc: string | null;
  preferences: StudyPreferences | null;
  focusPreferences: FocusPreferences;
  gamification: GamificationPreferences;
};

function SectionBody({
  section,
  data,
}: {
  section: SettingsSection;
  data: SettingsBundle;
}) {
  switch (section) {
    case "profile":
      return (
        <ProfileSettings profile={data.profile} avatarSrc={data.avatarSrc} />
      );
    case "appearance":
      return (
        <AppearanceSettings
          appearance={data.profile.appearance as AppearanceMode}
        />
      );
    case "focus":
      return <FocusPreferencesForm preferences={data.focusPreferences} />;
    case "study":
      return <StudyPreferencesForm preferences={data.preferences} />;
    case "privacy":
      return <PrivacySettingsForm profile={data.profile} />;
    case "progress":
      return (
        <GamificationSettingsForm
          prefs={data.gamification}
          weeklyGoalHours={data.preferences?.weekly_goal_hours ?? null}
        />
      );
    case "account":
      return <AccountSettings profile={data.profile} />;
    default:
      return null;
  }
}

function ShellWithStatus({
  section,
  data,
}: {
  section: SettingsSection;
  data: SettingsBundle;
}) {
  const { status } = useSettingsSaveStatus();
  return (
    <SettingsShell section={section} saveStatus={status}>
      <SectionBody section={section} data={data} />
    </SettingsShell>
  );
}

export function SettingsSectionView({
  section,
  data,
}: {
  section: SettingsSection;
  data: SettingsBundle;
}) {
  return (
    <SettingsSaveProvider>
      <ShellWithStatus section={section} data={data} />
    </SettingsSaveProvider>
  );
}
