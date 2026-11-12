"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  removeCustomAvatar,
  setAvatarPreference,
  uploadAvatar,
} from "@/actions/avatar";
import { AvatarCropDialog } from "@/components/settings/avatar-crop-dialog";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { Button } from "@/components/ui/button";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type AvatarSettingsProps = {
  profile: Profile;
  initialSrc: string | null;
};

export function AvatarSettings({ profile, initialSrc }: AvatarSettingsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(initialSrc);
  const [localProfile, setLocalProfile] = useState(profile);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFileInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function onPickFile(file: File | undefined) {
    setMessage(null);
    if (!file) return;

    if (file.size > AVATAR_MAX_BYTES) {
      setMessage({ type: "error", text: "Images must be 5 MB or smaller." });
      resetFileInput();
      return;
    }

    if (
      file.type &&
      !(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)
    ) {
      setMessage({
        type: "error",
        text: "Only JPEG, PNG, or WebP images are supported.",
      });
      resetFileInput();
      return;
    }

    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
    resetFileInput();
  }

  function uploadBlob(blob: Blob, mime: string) {
    startTransition(async () => {
      setProgress("Uploading…");
      setMessage(null);
      const formData = new FormData();
      const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      formData.append("avatar", new File([blob], `avatar.${extension}`, { type: mime }));

      const result = await uploadAvatar(formData);
      setProgress(null);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
        toast.error(result.error);
        return;
      }

      setLocalProfile((prev) => ({
        ...prev,
        avatar_preference: "custom",
        avatar_path: prev.avatar_path ?? "uploaded",
      }));
      if (result.signedUrl) setSrc(result.signedUrl);
      setMessage({
        type: "success",
        text: result.success ?? "Profile picture saved.",
      });
      toast.success(result.success ?? "Profile picture saved.");
    });
  }

  function runPreference(preference: "google" | "initials") {
    startTransition(async () => {
      setProgress("Updating…");
      setMessage(null);
      const result = await setAvatarPreference(preference);
      setProgress(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        toast.error(result.error);
        return;
      }
      setLocalProfile((prev) => ({
        ...prev,
        avatar_preference: preference,
        avatar_path: null,
      }));
      setSrc(
        preference === "google" ? localProfile.google_avatar_url : null,
      );
      setMessage({
        type: "success",
        text: result.success ?? "Avatar updated.",
      });
      toast.success(result.success ?? "Avatar updated.");
    });
  }

  function runRemove() {
    if (!confirm("Remove your custom profile picture?")) return;
    startTransition(async () => {
      setProgress("Removing…");
      setMessage(null);
      const result = await removeCustomAvatar();
      setProgress(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        toast.error(result.error);
        return;
      }
      const nextPref = localProfile.google_avatar_url ? "google" : "initials";
      setLocalProfile((prev) => ({
        ...prev,
        avatar_preference: nextPref,
        avatar_path: null,
      }));
      setSrc(nextPref === "google" ? localProfile.google_avatar_url : null);
      setMessage({
        type: "success",
        text: result.success ?? "Picture removed.",
      });
      toast.success(result.success ?? "Picture removed.");
    });
  }

  return (
    <section className="studi-panel p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl tracking-tight">
          Profile picture
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo, use your Google picture, or keep a soft initials
          avatar. JPEG, PNG, and WebP up to 5 MB.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <StudiAvatar profile={localProfile} src={src} size="xl" />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
            >
              {localProfile.avatar_preference === "custom"
                ? "Replace picture"
                : "Upload picture"}
            </Button>
            {localProfile.avatar_preference === "custom" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={runRemove}
              >
                Remove picture
              </Button>
            ) : null}
            {localProfile.google_avatar_url ? (
              <Button
                type="button"
                variant="outline"
                disabled={
                  isPending || localProfile.avatar_preference === "google"
                }
                onClick={() => runPreference("google")}
              >
                Use Google photo
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={
                isPending || localProfile.avatar_preference === "initials"
              }
              onClick={() => runPreference("initials")}
            >
              Use initials
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />

          <p className="text-xs text-muted-foreground">
            Current:{" "}
            {localProfile.avatar_preference === "custom"
              ? "Custom upload"
              : localProfile.avatar_preference === "google"
                ? "Google profile picture"
                : "Initials avatar"}
            {localProfile.avatar_visibility === "private"
              ? " · Private by default"
              : null}
          </p>

          {progress ? (
            <p className="text-sm text-muted-foreground" role="status">
              {progress}
            </p>
          ) : null}

          {message ? (
            <p
              className={cn(
                "text-sm",
                message.type === "error"
                  ? "text-destructive"
                  : "text-primary",
              )}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </div>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open && cropSrc) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        onCropped={(blob, mime) => uploadBlob(blob, mime)}
      />
    </section>
  );
}
