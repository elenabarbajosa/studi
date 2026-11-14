import type { ChallengeType } from "@/lib/progress/challenges";
import type { Weekday } from "@/lib/subjects";

export type GamificationPreferences = {
  user_id: string;
  enabled: boolean;
  leaderboard_opt_in: boolean;
  achievement_notifications: boolean;
  accept_challenge_invites: boolean;
  timezone: string;
  min_daily_focus_minutes: number;
  rest_days: Weekday[];
  consistency_days_per_week: number | null;
  created_at: string;
  updated_at: string;
};

export type AchievementDefinition = {
  id: string;
  category: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type UserAchievement = {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
};

export type StudyChallenge = {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  challenge_type: ChallengeType;
  target_value: number;
  visibility: "individual" | "collaborative";
  status: "draft" | "active" | "completed" | "expired" | "cancelled";
  starts_at: string;
  ends_at: string;
  show_individual_contributions: boolean;
  created_at: string;
  updated_at: string;
};

export type ChallengeParticipant = {
  challenge_id: string;
  user_id: string;
  status: "invited" | "active" | "declined" | "left" | "completed";
  joined_at: string;
  completed_at: string | null;
};

export type ChallengeInvitation = {
  id: string;
  challenge_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
  responded_at: string | null;
};

export const DEFAULT_GAMIFICATION_PREFS = {
  enabled: true,
  leaderboard_opt_in: false,
  achievement_notifications: true,
  accept_challenge_invites: true,
  timezone: "UTC",
  min_daily_focus_minutes: 15,
  rest_days: [] as Weekday[],
  consistency_days_per_week: null as number | null,
};
