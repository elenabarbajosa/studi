import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  KeyRound,
  Palette,
  Shield,
  Timer,
  Trophy,
  UserRound,
} from "lucide-react";

export const SETTINGS_SECTIONS = [
  "profile",
  "appearance",
  "focus",
  "study",
  "privacy",
  "progress",
  "account",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type SettingsSectionMeta = {
  id: SettingsSection;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const SETTINGS_SECTION_META: SettingsSectionMeta[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Name, username, bio and photo",
    icon: UserRound,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and accent color",
    icon: Palette,
  },
  {
    id: "focus",
    label: "Focus & Pomodoro",
    description: "Timer lengths and sounds",
    icon: Timer,
  },
  {
    id: "study",
    label: "Study rhythm",
    description: "Availability and session habits",
    icon: CalendarRange,
  },
  {
    id: "privacy",
    label: "Privacy",
    description: "Discovery and what friends see",
    icon: Shield,
  },
  {
    id: "progress",
    label: "Progress & badges",
    description: "Goals, streaks and leaderboard",
    icon: Trophy,
  },
  {
    id: "account",
    label: "Account",
    description: "Sign out and setup wizard",
    icon: KeyRound,
  },
];

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function settingsHref(section: SettingsSection) {
  return `/settings/${section}`;
}
