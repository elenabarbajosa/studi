export const ACHIEVEMENT_IDS = [
  "first_focus_session",
  "first_hour_studied",
  "first_pomodoro",
  "streak_3",
  "streak_7",
  "streak_14",
  "streak_30",
  "hours_5",
  "hours_10",
  "hours_25",
  "hours_50",
  "hours_100",
  "first_friend",
  "first_study_room",
  "first_collab_session",
  "first_challenge_completed",
  "five_challenges_completed",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export type AchievementDefinitionMeta = {
  id: AchievementId;
  category: "getting_started" | "consistency" | "milestones" | "social" | "challenges";
  title: string;
  description: string;
  icon: string;
};

export const ACHIEVEMENT_CATALOG: AchievementDefinitionMeta[] = [
  {
    id: "first_focus_session",
    category: "getting_started",
    title: "First Focus",
    description: "Complete your first verified focus session.",
    icon: "spark",
  },
  {
    id: "first_hour_studied",
    category: "getting_started",
    title: "First Hour",
    description: "Accumulate one hour of verified focus time.",
    icon: "hourglass",
  },
  {
    id: "first_pomodoro",
    category: "getting_started",
    title: "First Pomodoro",
    description: "Finish a session with at least one Pomodoro cycle.",
    icon: "timer",
  },
  {
    id: "streak_3",
    category: "consistency",
    title: "3-Day Streak",
    description: "Study on three consecutive active days.",
    icon: "flame",
  },
  {
    id: "streak_7",
    category: "consistency",
    title: "7-Day Streak",
    description: "Keep a seven-day study streak.",
    icon: "flame",
  },
  {
    id: "streak_14",
    category: "consistency",
    title: "14-Day Streak",
    description: "Keep a fourteen-day study streak.",
    icon: "flame",
  },
  {
    id: "streak_30",
    category: "consistency",
    title: "30-Day Streak",
    description: "Keep a thirty-day study streak.",
    icon: "crown",
  },
  {
    id: "hours_5",
    category: "milestones",
    title: "5 Hours",
    description: "Reach five hours of verified focus time.",
    icon: "book",
  },
  {
    id: "hours_10",
    category: "milestones",
    title: "10 Hours",
    description: "Reach ten hours of verified focus time.",
    icon: "book",
  },
  {
    id: "hours_25",
    category: "milestones",
    title: "25 Hours",
    description: "Reach twenty-five hours of verified focus time.",
    icon: "book",
  },
  {
    id: "hours_50",
    category: "milestones",
    title: "50 Hours",
    description: "Reach fifty hours of verified focus time.",
    icon: "medal",
  },
  {
    id: "hours_100",
    category: "milestones",
    title: "100 Hours",
    description: "Reach one hundred hours of verified focus time.",
    icon: "medal",
  },
  {
    id: "first_friend",
    category: "social",
    title: "First Friend",
    description: "Connect with your first study friend.",
    icon: "users",
  },
  {
    id: "first_study_room",
    category: "social",
    title: "Study Together",
    description: "Create or join your first study room.",
    icon: "room",
  },
  {
    id: "first_collab_session",
    category: "social",
    title: "Collaborative Focus",
    description: "Save a verified Study Together focus session.",
    icon: "room",
  },
  {
    id: "first_challenge_completed",
    category: "challenges",
    title: "Challenge Cleared",
    description: "Complete your first study challenge.",
    icon: "flag",
  },
  {
    id: "five_challenges_completed",
    category: "challenges",
    title: "Challenge Runner",
    description: "Complete five study challenges.",
    icon: "flag",
  },
];

export type AchievementStats = {
  completedSessions: number;
  totalFocusSeconds: number;
  maxPomodoroCycles: number;
  longestStreak: number;
  friendCount: number;
  studyRoomMemberships: number;
  collabSessions: number;
  challengesCompleted: number;
};

/**
 * Pure eligibility check — returns achievement ids that should be unlocked
 * given current stats. Does not award; server inserts uniquely.
 */
export function eligibleAchievements(stats: AchievementStats): AchievementId[] {
  const out: AchievementId[] = [];
  if (stats.completedSessions >= 1) out.push("first_focus_session");
  if (stats.totalFocusSeconds >= 3600) out.push("first_hour_studied");
  if (stats.maxPomodoroCycles >= 1) out.push("first_pomodoro");
  if (stats.longestStreak >= 3) out.push("streak_3");
  if (stats.longestStreak >= 7) out.push("streak_7");
  if (stats.longestStreak >= 14) out.push("streak_14");
  if (stats.longestStreak >= 30) out.push("streak_30");
  if (stats.totalFocusSeconds >= 5 * 3600) out.push("hours_5");
  if (stats.totalFocusSeconds >= 10 * 3600) out.push("hours_10");
  if (stats.totalFocusSeconds >= 25 * 3600) out.push("hours_25");
  if (stats.totalFocusSeconds >= 50 * 3600) out.push("hours_50");
  if (stats.totalFocusSeconds >= 100 * 3600) out.push("hours_100");
  if (stats.friendCount >= 1) out.push("first_friend");
  if (stats.studyRoomMemberships >= 1) out.push("first_study_room");
  if (stats.collabSessions >= 1) out.push("first_collab_session");
  if (stats.challengesCompleted >= 1) out.push("first_challenge_completed");
  if (stats.challengesCompleted >= 5) out.push("five_challenges_completed");
  return out;
}

export function newlyUnlocked(
  eligible: AchievementId[],
  alreadyUnlocked: Iterable<string>,
): AchievementId[] {
  const have = new Set(alreadyUnlocked);
  return eligible.filter((id) => !have.has(id));
}
