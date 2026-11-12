import type { AccentColor, AppearanceMode } from "@/lib/theme";
import type {
  OnboardingStatus,
  ResourceType,
  SubjectColor,
  TopicStatus,
  WeekdayAvailability,
} from "@/lib/subjects";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Pick<
            StudyPreferences,
            | "weekday_availability"
            | "session_duration_minutes"
            | "break_duration_minutes"
            | "weekly_goal_hours"
          >
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
    };
    CompositeTypes: Record<string, never>;
  };
};
