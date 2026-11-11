import type { AccentColor, AppearanceMode } from "@/lib/theme";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  appearance: AppearanceMode;
  accent_color: AccentColor;
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
  >
>;

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
          created_at?: string;
          updated_at?: string;
        };
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      appearance_mode: AppearanceMode;
      accent_color: AccentColor;
    };
    CompositeTypes: Record<string, never>;
  };
};
