"use client";

import { useCallback, useEffect, useState } from "react";

import { updateProfile } from "@/actions/profile";
import { AvatarSettings } from "@/components/settings/avatar-settings";
import { useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { useAutosave } from "@/components/settings/use-autosave";
import { Field } from "@/components/studi/form-controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/types/database";

export function ProfileSettings({
  profile,
  avatarSrc,
}: {
  profile: Profile;
  avatarSrc: string | null;
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const { setStatus } = useSettingsSaveStatus();

  const payload = { displayName, username, bio };

  const save = useCallback(async (next: typeof payload) => {
    const fd = new FormData();
    fd.set("display_name", next.displayName.trim());
    fd.set("username", next.username.trim().toLowerCase());
    fd.set("bio", next.bio);
    return updateProfile({}, fd);
  }, []);

  const { status, error } = useAutosave(payload, save, {
    enabled: displayName.trim().length > 0 && username.trim().length > 0,
  });

  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  return (
    <div className="flex flex-col gap-8">
      <AvatarSettings profile={profile} initialSrc={avatarSrc} />

      <div className="grid gap-4 min-[640px]:grid-cols-2">
        <Field label="Display name" htmlFor="display_name">
          <Input
            id="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="nickname"
          />
        </Field>
        <Field label="Username" htmlFor="username">
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9_]+"
            autoComplete="username"
            title="Lowercase letters, numbers, and underscores"
          />
        </Field>
        <Field label="Bio" htmlFor="bio" optional className="min-[640px]:col-span-2">
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="A short note about what you’re studying…"
          />
        </Field>
      </div>

      <p className="text-[13px] text-ink-3">
        Your username is unique. Discovery and what friends can see are controlled in
        Privacy.
      </p>

      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
