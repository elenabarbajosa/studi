"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateSocialPrivacy } from "@/actions/friends";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SOCIAL_VISIBILITIES,
  type SocialVisibility,
} from "@/lib/social";
import type { AvatarVisibility, Profile } from "@/types/database";

type PrivacySettingsFormProps = {
  profile: Profile;
};

const VISIBILITY_LABELS: Record<SocialVisibility, string> = {
  private: "Private",
  friends: "Friends only",
  public: "Public",
};

export function PrivacySettingsForm({ profile }: PrivacySettingsFormProps) {
  const [discoverable, setDiscoverable] = useState(profile.discoverable);
  const [avatarVisibility, setAvatarVisibility] = useState<AvatarVisibility>(
    profile.avatar_visibility,
  );
  const [onlineVisibility, setOnlineVisibility] = useState<SocialVisibility>(
    profile.online_status_visibility,
  );
  const [studyVisibility, setStudyVisibility] = useState<SocialVisibility>(
    profile.study_status_visibility,
  );
  const [statsVisibility, setStatsVisibility] = useState<SocialVisibility>(
    profile.stats_visibility,
  );
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateSocialPrivacy({
        discoverable,
        avatar_visibility: avatarVisibility,
        online_status_visibility: onlineVisibility,
        study_status_visibility: studyVisibility,
        stats_visibility: statsVisibility,
      });
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Privacy settings saved");
    });
  }

  return (
    <section className="studi-panel p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl tracking-tight">
          Privacy & discovery
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control who can find you and what study activity friends can see.
          Academic details stay private.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="discoverable">Profile discoverability</Label>
            <p className="text-xs text-muted-foreground">
              Allow others to find you by username search.
            </p>
          </div>
          <Switch
            id="discoverable"
            checked={discoverable}
            onCheckedChange={setDiscoverable}
            disabled={isPending}
          />
        </div>

        <VisibilityField
          label="Avatar visibility"
          value={avatarVisibility}
          onChange={(v) => setAvatarVisibility(v as AvatarVisibility)}
          disabled={isPending}
        />
        <VisibilityField
          label="Online status"
          value={onlineVisibility}
          onChange={setOnlineVisibility}
          disabled={isPending}
        />
        <VisibilityField
          label="Current study status"
          description="Focusing / on break indicator. Defaults to private."
          value={studyVisibility}
          onChange={setStudyVisibility}
          disabled={isPending}
        />
        <VisibilityField
          label="Study statistics"
          description="Aggregate weekly focus hours only. Defaults to private."
          value={statsVisibility}
          onChange={setStatsVisibility}
          disabled={isPending}
        />

        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save privacy"}
        </Button>
      </div>
    </section>
  );
}

function VisibilityField({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: SocialVisibility;
  onChange: (v: SocialVisibility) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {SOCIAL_VISIBILITIES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={
              value === option
                ? "rounded-xl border border-primary bg-brand-soft px-3 py-1.5 text-sm"
                : "rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted/60"
            }
            aria-pressed={value === option}
          >
            {VISIBILITY_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
