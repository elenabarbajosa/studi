import type {
  AssessmentType,
  FocusTimerMode,
  PriorityLevel,
  SoundscapeId,
  StudySessionSource,
  StudySessionStatus,
  TaskStatus,
} from "@/lib/calendar";
import type { AccentColor, AppearanceMode } from "@/lib/theme";
import type {
  GradeComponentType,
  GradeSchemeStatus,
} from "@/lib/grades/types";
import type {
  OnboardingStatus,
  ResourceType,
  SubjectColorValue,
  TopicStatus,
  WeekdayAvailability,
} from "@/lib/subjects";

import type {
  FriendRequestStatus,
  PresenceStatus,
  SocialVisibility,
} from "@/lib/social";
import type {
  StudyRoom,
  StudyRoomInvitation,
  StudyRoomMember,
  StudyRoomMessage,
  StudyRoomTimerState,
  StudyRoomVisibility,
  StudyRoomStatus,
  StudyRoomPhase,
  StudyRoomRunState,
  StudyRoomMemberRole,
  StudyRoomMemberStatus,
  StudyRoomInviteStatus,
} from "@/lib/study-together/types";
import type {
  AchievementDefinition,
  ChallengeInvitation,
  ChallengeParticipant,
  GamificationPreferences,
  StudyChallenge,
  UserAchievement,
} from "@/lib/progress/types";
import type { ChallengeType } from "@/lib/progress/challenges";
import type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ExternalCalendarEvent,
  ExternalCalendarProvider,
  ExternalConnectionStatus,
  ExternalEventLink,
  ExternalEventLinkKind,
  ExternalEventShowAs,
} from "@/lib/calendar-sync/types";

export type {
  ExternalCalendar,
  ExternalCalendarConnection,
  ExternalCalendarEvent,
  ExternalCalendarProvider,
  ExternalConnectionStatus,
  ExternalEventLink,
  ExternalEventLinkKind,
  ExternalEventShowAs,
};

export type AvatarPreference = "custom" | "google" | "initials";
export type AvatarVisibility = "private" | "friends" | "public";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  /** @deprecated Legacy column; prefer avatar_path + avatar_preference. */
  avatar_url: string | null;
  avatar_path: string | null;
  google_avatar_url: string | null;
  avatar_preference: AvatarPreference;
  avatar_visibility: AvatarVisibility;
  discoverable: boolean;
  online_status_visibility: SocialVisibility;
  study_status_visibility: SocialVisibility;
  stats_visibility: SocialVisibility;
  bio: string | null;
  appearance: AppearanceMode;
  accent_color: AccentColor;
  onboarding_status: OnboardingStatus;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "username"
    | "display_name"
    | "avatar_url"
    | "avatar_path"
    | "google_avatar_url"
    | "avatar_preference"
    | "avatar_visibility"
    | "discoverable"
    | "online_status_visibility"
    | "study_status_visibility"
    | "stats_visibility"
    | "bio"
    | "appearance"
    | "accent_color"
    | "onboarding_status"
    | "onboarding_step"
  >
>;

export type Friendship = {
  id: string;
  user_low: string;
  user_high: string;
  requested_by: string;
  created_at: string;
};

export type FriendRequest = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: FriendRequestStatus;
  created_at: string;
  responded_at: string | null;
};

export type UserBlock = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type UserPresence = {
  user_id: string;
  status: PresenceStatus;
  activity_label: string | null;
  updated_at: string;
};

export type StudyPreferences = {
  user_id: string;
  weekday_availability: WeekdayAvailability;
  session_duration_minutes: number;
  break_duration_minutes: number;
  weekly_goal_hours: number | null;
  pomodoro_focus_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_intervals_before_long: number;
  auto_start_breaks: boolean;
  focus_sound_enabled: boolean;
  soundscape_primary: SoundscapeId;
  soundscape_secondary: SoundscapeId;
  soundscape_volume: number;
  soundscape_secondary_volume: number;
  created_at: string;
  updated_at: string;
};

export type AiUsageEvent = {
  id: string;
  user_id: string;
  feature: string;
  created_at: string;
};

/** Singleton config row for owner AI limits. Not readable via client RLS. */
export type StudiAiOwner = {
  id: true;
  owner_user_id: string | null;
  owner_daily_limit: number;
  standard_daily_limit: number;
  updated_at: string;
};

export type AiImportSession = {
  id: string;
  user_id: string;
  subject_id: string;
  feature: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
};

export type AiGenerationSession = {
  id: string;
  user_id: string;
  feature: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
};

export type StudyPlanStatus = "draft" | "active" | "completed" | "archived";

export type PlannerPreferences = {
  user_id: string;
  planning_period:
    | "today"
    | "tomorrow"
    | "custom"
    | "7"
    | "14"
    | "30"
    | "until_exam";
  target_date: string | null;
  intensity: "light" | "balanced" | "intensive";
  max_hours_per_day: number;
  preferred_session_minutes: number;
  break_minutes: number;
  include_revision: boolean;
  include_incomplete_tasks: boolean;
  weekday_availability: import("@/lib/subjects").WeekdayAvailability;
  time_windows: Record<
    import("@/lib/subjects").Weekday,
    { start: string; end: string }[]
  >;
  rest_days: string[];
  included_subject_ids: string[] | null;
  prioritized_topic_ids: string[];
  excluded_topic_ids: string[];
  until_assessment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StudyPlan = {
  id: string;
  user_id: string;
  title: string;
  status: StudyPlanStatus;
  period_start: string;
  period_end: string;
  intensity: string;
  timezone: string;
  summary: string | null;
  recommendations: unknown;
  warnings: unknown;
  generation_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StudyPlanSession = {
  id: string;
  plan_id: string;
  study_session_id: string;
  user_id: string;
  locked: boolean;
  user_edited: boolean;
  created_at: string;
};

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  color: SubjectColorValue;
  difficulty: number | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Topic = {
  id: string;
  user_id: string;
  subject_id: string;
  parent_id: string | null;
  title: string;
  status: TopicStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SubjectGradeScheme = {
  id: string;
  user_id: string;
  subject_id: string;
  display_scale_max: number;
  passing_overall: number | null;
  passing_final_min: number | null;
  status: GradeSchemeStatus;
  created_at: string;
  updated_at: string;
};

export type GradeGroup = {
  id: string;
  user_id: string;
  subject_id: string;
  scheme_id: string;
  title: string;
  weight_percent: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type GradeComponent = {
  id: string;
  user_id: string;
  subject_id: string;
  scheme_id: string;
  group_id: string | null;
  title: string;
  component_type: GradeComponentType;
  weight_percent: number;
  weight_within_group: number | null;
  max_score: number;
  score: number | null;
  min_score: number | null;
  sort_order: number;
  assessment_id: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialSource = "manual" | "canvas" | "link";

export type Material = {
  id: string;
  user_id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  resource_type: ResourceType;
  /** External URL when the material is a link; null when file is in private storage. */
  url: string | null;
  description: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
  original_filename: string | null;
  mime_type: string | null;
  byte_size: number | null;
  source: MaterialSource;
  source_fingerprint: string | null;
  canvas_module_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Assessment = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  assessment_type: AssessmentType;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
  priority: PriorityLevel;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  priority: PriorityLevel;
  estimated_minutes: number | null;
  status: TaskStatus;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Subtask = {
  id: string;
  user_id: string;
  task_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_at: string;
  updated_at: string;
};

export type StudySession = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  task_id: string | null;
  starts_at: string;
  ends_at: string | null;
  planned_duration_minutes: number;
  status: StudySessionStatus;
  notes: string | null;
  source: StudySessionSource;
  timer_mode: FocusTimerMode | null;
  focus_seconds: number;
  break_seconds: number;
  goal: string | null;
  goal_completed: boolean | null;
  client_session_id: string | null;
  pomodoro_cycles: number;
  room_id: string | null;
  created_at: string;
  updated_at: string;
};

export type FocusActiveSession = {
  id: string;
  user_id: string;
  client_session_id: string;
  timer_mode: FocusTimerMode;
  subject_id: string | null;
  topic_id: string | null;
  task_id: string | null;
  goal: string | null;
  engine_state: Record<string, unknown>;
  focus_seconds: number;
  break_seconds: number;
  /** Optimistic concurrency token (migration 022). */
  revision: number;
  started_at: string;
  last_heartbeat_at: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          avatar_path?: string | null;
          google_avatar_url?: string | null;
          avatar_preference?: AvatarPreference;
          avatar_visibility?: AvatarVisibility;
          discoverable?: boolean;
          online_status_visibility?: SocialVisibility;
          study_status_visibility?: SocialVisibility;
          stats_visibility?: SocialVisibility;
          bio?: string | null;
          appearance?: AppearanceMode;
          accent_color?: AccentColor;
          onboarding_status?: OnboardingStatus;
          onboarding_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: ProfileUpdate;
        Relationships: [];
      };
      study_preferences: {
        Row: StudyPreferences;
        Insert: {
          user_id: string;
          weekday_availability?: WeekdayAvailability;
          session_duration_minutes?: number;
          break_duration_minutes?: number;
          weekly_goal_hours?: number | null;
          pomodoro_focus_minutes?: number;
          pomodoro_short_break_minutes?: number;
          pomodoro_long_break_minutes?: number;
          pomodoro_intervals_before_long?: number;
          auto_start_breaks?: boolean;
          focus_sound_enabled?: boolean;
          soundscape_primary?: SoundscapeId;
          soundscape_secondary?: SoundscapeId;
          soundscape_volume?: number;
          soundscape_secondary_volume?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<StudyPreferences, "user_id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      subjects: {
        Row: Subject;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: SubjectColorValue;
          difficulty?: number | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            Subject,
            "name" | "color" | "difficulty" | "description" | "sort_order"
          >
        >;
        Relationships: [];
      };
      topics: {
        Row: Topic;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          parent_id?: string | null;
          title: string;
          status?: TopicStatus;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<Topic, "title" | "status" | "notes" | "sort_order" | "parent_id">
        >;
        Relationships: [];
      };
      subject_grade_schemes: {
        Row: SubjectGradeScheme;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          display_scale_max?: number;
          passing_overall?: number | null;
          passing_final_min?: number | null;
          status?: GradeSchemeStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            SubjectGradeScheme,
            | "display_scale_max"
            | "passing_overall"
            | "passing_final_min"
            | "status"
          >
        >;
        Relationships: [];
      };
      grade_groups: {
        Row: GradeGroup;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          scheme_id: string;
          title: string;
          weight_percent?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<GradeGroup, "title" | "weight_percent" | "sort_order">
        >;
        Relationships: [];
      };
      grade_components: {
        Row: GradeComponent;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          scheme_id: string;
          group_id?: string | null;
          title: string;
          component_type?: GradeComponentType;
          weight_percent?: number;
          weight_within_group?: number | null;
          max_score?: number;
          score?: number | null;
          min_score?: number | null;
          sort_order?: number;
          assessment_id?: string | null;
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            GradeComponent,
            | "group_id"
            | "title"
            | "component_type"
            | "weight_percent"
            | "weight_within_group"
            | "max_score"
            | "score"
            | "min_score"
            | "sort_order"
            | "assessment_id"
            | "due_at"
          >
        >;
        Relationships: [];
      };
      materials: {
        Row: Material;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          topic_id?: string | null;
          title: string;
          resource_type?: ResourceType;
          url?: string | null;
          description?: string | null;
          storage_path?: string | null;
          storage_bucket?: string | null;
          original_filename?: string | null;
          mime_type?: string | null;
          byte_size?: number | null;
          source?: MaterialSource;
          source_fingerprint?: string | null;
          canvas_module_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            Material,
            | "title"
            | "resource_type"
            | "url"
            | "description"
            | "topic_id"
            | "storage_path"
            | "storage_bucket"
            | "original_filename"
            | "mime_type"
            | "byte_size"
            | "source"
            | "source_fingerprint"
            | "canvas_module_path"
          >
        >;
        Relationships: [];
      };
      assessments: {
        Row: Assessment;
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          title: string;
          assessment_type?: AssessmentType;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          location?: string | null;
          description?: string | null;
          priority?: PriorityLevel;
          completed?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Assessment, "id" | "user_id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          topic_id?: string | null;
          title: string;
          description?: string | null;
          due_at?: string | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          priority?: PriorityLevel;
          estimated_minutes?: number | null;
          status?: TaskStatus;
          completed_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<Task, "id" | "user_id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      subtasks: {
        Row: Subtask;
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          title: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<Subtask, "title" | "completed" | "sort_order">
        >;
        Relationships: [];
      };
      calendar_events: {
        Row: CalendarEvent;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<CalendarEvent, "id" | "user_id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      study_sessions: {
        Row: StudySession;
        Insert: {
          id?: string;
          user_id: string;
          subject_id?: string | null;
          topic_id?: string | null;
          task_id?: string | null;
          starts_at: string;
          ends_at?: string | null;
          planned_duration_minutes?: number;
          status?: StudySessionStatus;
          notes?: string | null;
          source?: StudySessionSource;
          timer_mode?: FocusTimerMode | null;
          focus_seconds?: number;
          break_seconds?: number;
          goal?: string | null;
          goal_completed?: boolean | null;
          client_session_id?: string | null;
          pomodoro_cycles?: number;
          room_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<StudySession, "id" | "user_id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      focus_active_sessions: {
        Row: FocusActiveSession;
        Insert: {
          id?: string;
          user_id: string;
          client_session_id: string;
          timer_mode: FocusTimerMode;
          subject_id?: string | null;
          topic_id?: string | null;
          task_id?: string | null;
          goal?: string | null;
          engine_state?: Record<string, unknown>;
          focus_seconds?: number;
          break_seconds?: number;
          revision?: number;
          started_at?: string;
          last_heartbeat_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<FocusActiveSession, "id" | "user_id" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      friendships: {
        Row: Friendship;
        Insert: {
          id?: string;
          user_low: string;
          user_high: string;
          requested_by: string;
          created_at?: string;
        };
        Update: Partial<Omit<Friendship, "id" | "created_at">>;
        Relationships: [];
      };
      friend_requests: {
        Row: FriendRequest;
        Insert: {
          id?: string;
          requester_id: string;
          recipient_id: string;
          status?: FriendRequestStatus;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<
          Pick<FriendRequest, "status" | "responded_at">
        >;
        Relationships: [];
      };
      user_blocks: {
        Row: UserBlock;
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      user_presence: {
        Row: UserPresence;
        Insert: {
          user_id: string;
          status?: PresenceStatus;
          activity_label?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Pick<UserPresence, "status" | "activity_label" | "updated_at">
        >;
        Relationships: [];
      };
      study_rooms: {
        Row: StudyRoom;
        Insert: Omit<StudyRoom, "id" | "created_at" | "updated_at" | "ended_at"> & {
          id?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<StudyRoom, "id" | "created_at">>;
        Relationships: [];
      };
      study_room_members: {
        Row: StudyRoomMember;
        Insert: StudyRoomMember;
        Update: Partial<Omit<StudyRoomMember, "room_id" | "user_id">>;
        Relationships: [];
      };
      study_room_invitations: {
        Row: StudyRoomInvitation;
        Insert: Omit<StudyRoomInvitation, "id" | "created_at" | "responded_at"> & {
          id?: string;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Pick<StudyRoomInvitation, "status" | "responded_at" | "expires_at" | "token_hash">
        >;
        Relationships: [];
      };
      study_room_timer_state: {
        Row: StudyRoomTimerState;
        Insert: StudyRoomTimerState;
        Update: Partial<Omit<StudyRoomTimerState, "room_id">>;
        Relationships: [];
      };
      study_room_messages: {
        Row: StudyRoomMessage;
        Insert: Omit<StudyRoomMessage, "id" | "created_at" | "deleted_at"> & {
          id?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Pick<StudyRoomMessage, "body" | "deleted_at">>;
        Relationships: [];
      };
      gamification_preferences: {
        Row: GamificationPreferences & { rest_days: unknown };
        Insert: {
          user_id: string;
          enabled?: boolean;
          leaderboard_opt_in?: boolean;
          achievement_notifications?: boolean;
          accept_challenge_invites?: boolean;
          timezone?: string;
          min_daily_focus_minutes?: number;
          rest_days?: unknown;
          consistency_days_per_week?: number | null;
        };
        Update: Partial<
          Omit<GamificationPreferences, "user_id" | "created_at" | "updated_at">
        > & { rest_days?: unknown };
        Relationships: [];
      };
      achievement_definitions: {
        Row: AchievementDefinition;
        Insert: AchievementDefinition;
        Update: Partial<AchievementDefinition>;
        Relationships: [];
      };
      user_achievements: {
        Row: UserAchievement;
        Insert: UserAchievement;
        Update: never;
        Relationships: [];
      };
      study_challenges: {
        Row: StudyChallenge;
        Insert: Omit<StudyChallenge, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<StudyChallenge, "id" | "creator_id" | "created_at">>;
        Relationships: [];
      };
      challenge_participants: {
        Row: ChallengeParticipant;
        Insert: ChallengeParticipant;
        Update: Partial<
          Omit<ChallengeParticipant, "challenge_id" | "user_id">
        >;
        Relationships: [];
      };
      challenge_invitations: {
        Row: ChallengeInvitation;
        Insert: Omit<ChallengeInvitation, "id" | "created_at" | "responded_at"> & {
          id?: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<
          Pick<ChallengeInvitation, "status" | "responded_at" | "expires_at">
        >;
        Relationships: [];
      };
      ai_usage_events: {
        Row: AiUsageEvent;
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      studi_ai_owner: {
        Row: StudiAiOwner;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      ai_import_sessions: {
        Row: AiImportSession;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          feature?: string;
          created_at?: string;
          expires_at: string;
          consumed_at?: string | null;
        };
        Update: Partial<Pick<AiImportSession, "consumed_at">>;
        Relationships: [];
      };
      ai_generation_sessions: {
        Row: AiGenerationSession;
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          created_at?: string;
          expires_at: string;
          consumed_at?: string | null;
        };
        Update: Partial<Pick<AiGenerationSession, "consumed_at">>;
        Relationships: [];
      };
      planner_preferences: {
        Row: PlannerPreferences;
        Insert: Partial<PlannerPreferences> & { user_id: string };
        Update: Partial<Omit<PlannerPreferences, "user_id" | "created_at">>;
        Relationships: [];
      };
      study_plans: {
        Row: StudyPlan;
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          status?: StudyPlanStatus;
          period_start: string;
          period_end: string;
          intensity?: string;
          timezone?: string;
          summary?: string | null;
          recommendations?: unknown;
          warnings?: unknown;
          generation_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<StudyPlan, "id" | "user_id" | "created_at">
        >;
        Relationships: [];
      };
      study_plan_sessions: {
        Row: StudyPlanSession;
        Insert: {
          id?: string;
          plan_id: string;
          study_session_id: string;
          user_id: string;
          locked?: boolean;
          user_edited?: boolean;
          created_at?: string;
        };
        Update: Partial<Pick<StudyPlanSession, "locked" | "user_edited">>;
        Relationships: [];
      };
      external_calendar_connections: {
        Row: ExternalCalendarConnection;
        Insert: {
          id?: string;
          user_id: string;
          provider: ExternalCalendarProvider;
          status?: ExternalConnectionStatus;
          account_label?: string | null;
          account_email?: string | null;
          provider_account_id?: string | null;
          scopes?: string[];
          last_sync_at?: string | null;
          last_successful_sync_at?: string | null;
          last_sync_error?: string | null;
          sync_cursor?: string | null;
          dedupe_fingerprint?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<ExternalCalendarConnection, "id" | "user_id" | "created_at">
        >;
        Relationships: [];
      };
      external_calendar_secrets: {
        Row: {
          connection_id: string;
          user_id: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          key_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          connection_id: string;
          user_id: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          key_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          ciphertext: string;
          iv: string;
          auth_tag: string;
          key_version: number;
        }>;
        Relationships: [];
      };
      external_calendars: {
        Row: ExternalCalendar;
        Insert: {
          id?: string;
          user_id: string;
          connection_id: string;
          provider_calendar_id: string;
          name: string;
          color?: string | null;
          timezone?: string | null;
          enabled?: boolean;
          is_primary?: boolean;
          sync_token?: string | null;
          ctag?: string | null;
          etag?: string | null;
          last_sync_at?: string | null;
          last_successful_sync_at?: string | null;
          last_sync_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<ExternalCalendar, "id" | "user_id" | "connection_id" | "created_at">
        >;
        Relationships: [];
      };
      external_calendar_events: {
        Row: ExternalCalendarEvent;
        Insert: {
          id?: string;
          user_id: string;
          connection_id: string;
          calendar_id: string;
          provider_event_id: string;
          ical_uid?: string | null;
          recurrence_id?: string | null;
          title?: string;
          description?: string | null;
          location?: string | null;
          starts_at: string;
          ends_at?: string | null;
          all_day?: boolean;
          timezone?: string | null;
          show_as?: ExternalEventShowAs;
          status?: string | null;
          is_cancelled?: boolean;
          html_link?: string | null;
          recurring?: boolean;
          provider_updated_at?: string | null;
          content_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<
            ExternalCalendarEvent,
            "id" | "user_id" | "connection_id" | "calendar_id" | "created_at"
          >
        >;
        Relationships: [];
      };
      external_event_links: {
        Row: ExternalEventLink;
        Insert: {
          id?: string;
          user_id: string;
          external_event_id: string;
          kind: ExternalEventLinkKind;
          assessment_id?: string | null;
          task_id?: string | null;
          proposed_title?: string | null;
          proposed_type?: string | null;
          source_fingerprint?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Omit<ExternalEventLink, "id" | "user_id" | "external_event_id" | "created_at">
        >;
        Relationships: [];
      };
      calendar_oauth_states: {
        Row: {
          id: string;
          user_id: string;
          provider: ExternalCalendarProvider;
          state: string;
          code_verifier: string;
          redirect_path: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: ExternalCalendarProvider;
          state: string;
          code_verifier: string;
          redirect_path?: string;
          expires_at: string;
          created_at?: string;
        };
        Update: Partial<{
          redirect_path: string;
          expires_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      username_is_available: {
        Args: { desired: string };
        Returns: boolean;
      };
      claim_ai_usage: {
        Args: { p_feature: string; p_daily_limit?: number | null };
        Returns: { allowed: boolean; used: number; limit: number }[];
      };
      get_ai_daily_limit: {
        Args: Record<string, never>;
        Returns: number;
      };
      create_ai_import_session: {
        Args: { p_subject_id: string; p_feature?: string };
        Returns: string;
      };
      consume_ai_import_session: {
        Args: { p_session_id: string; p_subject_id: string };
        Returns: boolean;
      };
      create_ai_generation_session: {
        Args: { p_feature: string };
        Returns: string;
      };
      consume_ai_generation_session: {
        Args: { p_session_id: string; p_feature: string };
        Returns: boolean;
      };
      are_friends: {
        Args: { a: string; b: string };
        Returns: boolean;
      };
      can_read_avatar_object: {
        Args: { object_name: string };
        Returns: boolean;
      };
      send_friend_request: {
        Args: { target_username: string };
        Returns: string;
      };
      accept_friend_request: {
        Args: { request_id: string };
        Returns: boolean;
      };
      remove_friend: {
        Args: { friend_user_id: string };
        Returns: boolean;
      };
      block_user: {
        Args: { target_user_id: string };
        Returns: boolean;
      };
      search_discoverable_profiles: {
        Args: {
          query: string;
          result_limit?: number;
          result_offset?: number;
        };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          accent_color: AccentColor;
          avatar_preference: AvatarPreference;
          avatar_visibility: AvatarVisibility;
          google_avatar_url: string | null;
          has_custom_avatar: boolean;
          storage_path: string | null;
          friendship_status: string;
          request_id: string | null;
          bio: string | null;
        }[];
      };
      get_social_profile: {
        Args: { target_username: string };
        Returns: Record<string, unknown> | null;
      };
      get_social_profile_by_id: {
        Args: { target_id: string };
        Returns: Record<string, unknown> | null;
      };
      list_my_friends: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          accent_color: AccentColor;
          avatar_preference: AvatarPreference;
          avatar_visibility: AvatarVisibility;
          google_avatar_url: string | null;
          has_custom_avatar: boolean;
          storage_path: string | null;
          can_view_avatar: boolean;
          presence_status: PresenceStatus;
          presence_label: string | null;
          presence_updated_at: string | null;
          weekly_focus_seconds: number | null;
        }[];
      };
      is_active_room_member: {
        Args: { p_room_id: string; p_user_id: string };
        Returns: boolean;
      };
      create_study_room: {
        Args: {
          p_name: string;
          p_description?: string | null;
          p_visibility?: StudyRoomVisibility;
          p_max_participants?: number;
          p_focus_minutes?: number;
          p_short_break_minutes?: number;
          p_long_break_minutes?: number;
          p_intervals_before_long?: number;
          p_chat_enabled?: boolean;
          p_members_can_invite?: boolean;
        };
        Returns: string;
      };
      create_study_room_invite: {
        Args: {
          p_room_id: string;
          p_invitee_id: string;
          p_token_hash: string;
          p_expires_at: string;
        };
        Returns: string;
      };
      accept_study_room_invite: {
        Args: { p_token_hash: string };
        Returns: string;
      };
      respond_study_room_invite: {
        Args: { p_invite_id: string; p_accept: boolean };
        Returns: boolean;
      };
      cancel_study_room_invite: {
        Args: { p_invite_id: string };
        Returns: boolean;
      };
      join_friends_study_room: {
        Args: { p_room_id: string };
        Returns: boolean;
      };
      leave_study_room: {
        Args: { p_room_id: string };
        Returns: boolean;
      };
      kick_study_room_member: {
        Args: { p_room_id: string; p_user_id: string };
        Returns: boolean;
      };
      end_study_room: {
        Args: { p_room_id: string };
        Returns: boolean;
      };
      transfer_study_room_host: {
        Args: { p_room_id: string; p_new_host_id?: string | null };
        Returns: string | null;
      };
      reconcile_room_timer: {
        Args: { p_room_id: string };
        Returns: StudyRoomTimerState;
      };
      room_timer_command: {
        Args: {
          p_room_id: string;
          p_action: string;
          p_expected_revision: number;
        };
        Returns: StudyRoomTimerState;
      };
      update_study_room_settings: {
        Args: {
          p_room_id: string;
          p_name?: string | null;
          p_description?: string | null;
          p_visibility?: StudyRoomVisibility | null;
          p_max_participants?: number | null;
          p_focus_minutes?: number | null;
          p_short_break_minutes?: number | null;
          p_long_break_minutes?: number | null;
          p_intervals_before_long?: number | null;
          p_chat_enabled?: boolean | null;
          p_members_can_invite?: boolean | null;
        };
        Returns: boolean;
      };
      send_study_room_message: {
        Args: {
          p_room_id: string;
          p_body: string;
          p_client_message_id: string;
        };
        Returns: string;
      };
      award_achievement: {
        Args: { p_user_id: string; p_achievement_id: string };
        Returns: boolean;
      };
      friends_weekly_leaderboard: {
        Args: { p_week_start: string; p_week_end: string };
        Returns: {
          user_id: string;
          username: string;
          display_name: string | null;
          accent_color: AccentColor;
          avatar_preference: AvatarPreference;
          google_avatar_url: string | null;
          storage_path: string | null;
          can_view_avatar: boolean;
          focus_seconds: number;
          rank: number;
        }[];
      };
      create_study_challenge: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_challenge_type: ChallengeType;
          p_target_value: number;
          p_visibility: "individual" | "collaborative";
          p_starts_at: string;
          p_ends_at: string;
          p_show_individual_contributions?: boolean;
        };
        Returns: string;
      };
      invite_to_challenge: {
        Args: {
          p_challenge_id: string;
          p_invitee_id: string;
          p_expires_at: string;
        };
        Returns: string;
      };
      respond_challenge_invite: {
        Args: { p_invite_id: string; p_accept: boolean };
        Returns: string;
      };
      cancel_challenge: {
        Args: { p_challenge_id: string };
        Returns: boolean;
      };
      mark_challenge_participant_completed: {
        Args: { p_challenge_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      appearance_mode: AppearanceMode;
      accent_color: AccentColor;
      onboarding_status: OnboardingStatus;
      topic_status: TopicStatus;
      resource_type: ResourceType;
      assessment_type: AssessmentType;
      grade_component_type: GradeComponentType;
      grade_scheme_status: GradeSchemeStatus;
      priority_level: PriorityLevel;
      task_status: TaskStatus;
      study_session_status: StudySessionStatus;
      avatar_preference: AvatarPreference;
      avatar_visibility: AvatarVisibility;
      focus_timer_mode: FocusTimerMode;
      study_session_source: StudySessionSource;
      soundscape_id: SoundscapeId;
      social_visibility: SocialVisibility;
      friend_request_status: FriendRequestStatus;
      presence_status: PresenceStatus;
      study_room_visibility: StudyRoomVisibility;
      study_room_status: StudyRoomStatus;
      study_room_phase: StudyRoomPhase;
      study_room_run_state: StudyRoomRunState;
      study_room_member_role: StudyRoomMemberRole;
      study_room_member_status: StudyRoomMemberStatus;
      study_room_invite_status: StudyRoomInviteStatus;
      external_calendar_provider: ExternalCalendarProvider;
      external_connection_status: ExternalConnectionStatus;
      external_event_show_as: ExternalEventShowAs;
      external_event_link_kind: ExternalEventLinkKind;
    };
    CompositeTypes: Record<string, never>;
  };
};
