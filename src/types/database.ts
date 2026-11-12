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
  OnboardingStatus,
  ResourceType,
  SubjectColor,
  TopicStatus,
  WeekdayAvailability,
} from "@/lib/subjects";

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
    | "bio"
    | "appearance"
    | "accent_color"
    | "onboarding_status"
    | "onboarding_step"
  >
>;

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

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  color: SubjectColor;
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

export type Material = {
  id: string;
  user_id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  resource_type: ResourceType;
  url: string;
  description: string | null;
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
          color?: SubjectColor;
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
      materials: {
        Row: Material;
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          topic_id?: string | null;
          title: string;
          resource_type?: ResourceType;
          url: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            Material,
            "title" | "resource_type" | "url" | "description" | "topic_id"
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
    };
    Views: Record<string, never>;
    Functions: {
      username_is_available: {
        Args: { desired: string };
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
      priority_level: PriorityLevel;
      task_status: TaskStatus;
      study_session_status: StudySessionStatus;
      avatar_preference: AvatarPreference;
      avatar_visibility: AvatarVisibility;
      focus_timer_mode: FocusTimerMode;
      study_session_source: StudySessionSource;
      soundscape_id: SoundscapeId;
    };
    CompositeTypes: Record<string, never>;
  };
};
