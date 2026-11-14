"use client";

import { useActionState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { signOut } from "@/actions/auth";
import {
  updateAccentColor,
  updateAppearance,
  updateProfile,
  type ProfileActionState,
} from "@/actions/profile";
import { AvatarSettings } from "@/components/settings/avatar-settings";
import { useAccent } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCENT_META,
  ACCENT_COLORS,
  APPEARANCE_MODES,
  type AccentColor,
  type AppearanceMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type SettingsFormProps = {
  profile: Profile;
  avatarSrc: string | null;
};

const initialState: ProfileActionState = {};

export function SettingsForm({ profile, avatarSrc }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );
  const { setTheme, theme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [isPending, startTransition] = useTransition();
  // Prefer live next-themes value after hydration; fall back to saved profile.
  const selectedAppearance = theme ?? profile.appearance;

  function handleAppearance(next: AppearanceMode) {
    setTheme(next);
    startTransition(async () => {
      const result = await updateAppearance(next);
      if (result.error) {
        toast.error(result.error);
        setTheme(profile.appearance);
        return;
      }
      toast.success("Appearance saved");
    });
  }

  function handleAccent(next: AccentColor) {
    const previous = accent;
    setAccent(next);
    startTransition(async () => {
      const result = await updateAccentColor(next);
      if (result.error) {
        toast.error(result.error);
        setAccent(previous);
        return;
      }
      toast.success("Accent saved");
    });
  }

  return (
    <div className="space-y-8">
      <AvatarSettings profile={profile} initialSrc={avatarSrc} />

      <section className="studi-panel p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="font-display text-2xl tracking-tight">Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your username is unique. Discovery and visibility are controlled in
            Privacy below.
          </p>
        </div>

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              defaultValue={profile.username}
              required
              pattern="[a-z0-9_]+"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              rows={4}
              placeholder="A short note about what you're studying…"
            />
          </div>

          {state.error ? (
            <p className="sm:col-span-2 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="sm:col-span-2 text-sm text-primary" role="status">
              {state.success}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      </section>

      <section className="studi-panel p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="font-display text-2xl tracking-tight">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose light, dark, or match your system. Accent colors mark
            buttons, links, and focus.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium">Mode</p>
            <div className="flex flex-wrap gap-2">
              {APPEARANCE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleAppearance(mode)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm capitalize transition-colors",
                    selectedAppearance === mode
                      ? "border-primary bg-brand-soft text-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">Accent</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACCENT_COLORS.map((color) => {
                const meta = ACCENT_META[color];
                const selected = accent === color;
                return (
                  <button
                    key={color}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAccent(color)}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-brand-soft"
                        : "border-border hover:bg-muted/60",
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className="mt-0.5 size-5 shrink-0 rounded-full border border-black/5"
                      style={{ background: meta.swatch }}
                      aria-hidden
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {meta.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="studi-panel p-6 sm:p-8">
        <div className="mb-4">
          <h2 className="font-display text-2xl tracking-tight">Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign out on this device. Your private data stays in your account.
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
