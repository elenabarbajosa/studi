"use client";

import { useCallback, useEffect, useState } from "react";

import { updateSocialPrivacy } from "@/actions/friends";
import { useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { useAutosave } from "@/components/settings/use-autosave";
import { SwitchRow } from "@/components/studi/form-controls";
import {
  SOCIAL_VISIBILITIES,
  type SocialVisibility,
} from "@/lib/social";
import { cn } from "@/lib/utils";
import type { AvatarVisibility, Profile } from "@/types/database";

const VISIBILITY_LABELS: Record<SocialVisibility, string> = {
  private: "Private",
  friends: "Friends",
  public: "Public",
};

const VISIBILITY_HINTS: Record<SocialVisibility, string> = {
  private: "Only you",
  friends: "Friends only",
  public: "Anyone on Studi",
};

export function PrivacySettingsForm({ profile }: { profile: Profile }) {
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
  const { setStatus } = useSettingsSaveStatus();

  const payload = {
    discoverable,
    avatar_visibility: avatarVisibility,
    online_status_visibility: onlineVisibility,
    study_status_visibility: studyVisibility,
    stats_visibility: statsVisibility,
  };

  const save = useCallback(async (next: typeof payload) => {
    return updateSocialPrivacy(next);
  }, []);

  const { status, error } = useAutosave(payload, save);
  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[14px] text-ink-2">
        Academic details — calendars, exams, tasks and notes — are never shared.
        These controls only cover social surfaces.
      </p>

      <div className="rounded-[18px] bg-sunken px-1 py-1">
        <SwitchRow
          label="Show me in username search"
          checked={discoverable}
          onChange={setDiscoverable}
        />
      </div>
      <p className="-mt-3 text-[12.5px] text-ink-3">
        When off, people can still open your profile from a direct link or friend request,
        but you won’t appear in Discover search.
      </p>

      <VisibilityField
        label="Avatar"
        description="Who can see your photo or initials avatar."
        value={avatarVisibility}
        onChange={(v) => setAvatarVisibility(v as AvatarVisibility)}
      />
      <VisibilityField
        label="Online status"
        description="Whether friends can see that you’re online."
        value={onlineVisibility}
        onChange={setOnlineVisibility}
      />
      <VisibilityField
        label="Study status"
        description="Focusing / on break indicator. Defaults to private."
        value={studyVisibility}
        onChange={setStudyVisibility}
      />
      <VisibilityField
        label="Study statistics"
        description="Aggregate weekly focus hours only. Defaults to private."
        value={statsVisibility}
        onChange={setStatsVisibility}
      />

      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function VisibilityField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: SocialVisibility;
  onChange: (v: SocialVisibility) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <p className="text-[14px] font-medium text-ink">{label}</p>
        <p className="text-[12.5px] text-ink-3">{description}</p>
      </div>
      <div className="grid grid-cols-3 gap-1.5 rounded-full bg-sunken p-[3px]" role="radiogroup" aria-label={label}>
        {SOCIAL_VISIBILITIES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            title={VISIBILITY_HINTS[option]}
            onClick={() => onChange(option)}
            className={cn(
              "h-9 rounded-full text-[13px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
              value === option
                ? "bg-raised text-ink shadow-sm"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {VISIBILITY_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
