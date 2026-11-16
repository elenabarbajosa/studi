"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Camera,
  ImagePlus,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  removeCustomAvatar,
  setAvatarPreference,
  uploadAvatar,
} from "@/actions/avatar";
import { AvatarCropDialog } from "@/components/settings/avatar-crop-dialog";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type AvatarSettingsProps = {
  profile: Profile;
  initialSrc: string | null;
};

const DESKTOP_QUERY = "(min-width: 768px)";

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

export function AvatarSettings({ profile, initialSrc }: AvatarSettingsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useIsDesktop();
  const [src, setSrc] = useState(initialSrc);
  const [localProfile, setLocalProfile] = useState(profile);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFileInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function closeMenu() {
    setMenuOpen(false);
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
    closeMenu();
    resetFileInput();
  }

  function uploadBlob(blob: Blob, mime: string) {
    startTransition(async () => {
      setProgress("Uploading…");
      setMessage(null);
      const formData = new FormData();
      const extension =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      formData.append(
        "avatar",
        new File([blob], `avatar.${extension}`, { type: mime }),
      );

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
    closeMenu();
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
      setSrc(preference === "google" ? localProfile.google_avatar_url : null);
      setMessage({
        type: "success",
        text: result.success ?? "Avatar updated.",
      });
      toast.success(result.success ?? "Avatar updated.");
    });
  }

  function runRemove() {
    if (!confirm("Remove your custom profile picture?")) return;
    closeMenu();
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

  const preferenceLabel =
    localProfile.avatar_preference === "custom"
      ? "Custom upload"
      : localProfile.avatar_preference === "google"
        ? "Google photo"
        : "Initials";

  const hasGoogle = Boolean(localProfile.google_avatar_url);
  const isCustom = localProfile.avatar_preference === "custom";
  const isGoogle = localProfile.avatar_preference === "google";
  const isInitials = localProfile.avatar_preference === "initials";

  const actions = (
    <>
      <AvatarAction
        icon={ImagePlus}
        label={isCustom ? "Change photo" : "Upload photo"}
        disabled={isPending}
        onSelect={() => inputRef.current?.click()}
      />
      {hasGoogle ? (
        <AvatarAction
          icon={Camera}
          label="Use Google profile photo"
          disabled={isPending || isGoogle}
          onSelect={() => runPreference("google")}
        />
      ) : null}
      <AvatarAction
        icon={UserRound}
        label="Use initials"
        disabled={isPending || isInitials}
        onSelect={() => runPreference("initials")}
      />
      {isCustom ? (
        <>
          <div className="my-1 h-px bg-hairline md:hidden" role="separator" />
          <AvatarAction
            icon={Trash2}
            label="Remove uploaded photo"
            disabled={isPending}
            destructive
            onSelect={runRemove}
          />
        </>
      ) : null}
    </>
  );

  return (
    <section className="flex flex-col gap-5 rounded-[22px] bg-sunken p-5 md:rounded-[26px] md:p-6">
      <div className="flex flex-col gap-5 min-[640px]:flex-row min-[640px]:items-center">
        {isDesktop ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              disabled={isPending}
              aria-label="Edit profile picture"
              className={cn(
                "group relative shrink-0 rounded-full outline-none transition-[box-shadow,transform] duration-200 ease-studi",
                "focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                "disabled:opacity-60",
              )}
            >
              <StudiAvatar
                profile={localProfile}
                src={src}
                size={96}
                className="shadow-[0_0_0_4px_var(--raised)] transition-opacity group-hover:opacity-90"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(36,28,31,0.42)] opacity-0 transition-opacity group-hover:opacity-100 group-data-popup-open:opacity-100">
                <Camera className="size-5 text-white" aria-hidden />
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="min-w-56">
              <DropdownMenuItem
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus aria-hidden />
                {isCustom ? "Change photo" : "Upload photo"}
              </DropdownMenuItem>
              {hasGoogle ? (
                <DropdownMenuItem
                  disabled={isPending || isGoogle}
                  onClick={() => runPreference("google")}
                >
                  <Camera aria-hidden />
                  Use Google profile photo
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={isPending || isInitials}
                onClick={() => runPreference("initials")}
              >
                <UserRound aria-hidden />
                Use initials
              </DropdownMenuItem>
              {isCustom ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isPending}
                    onClick={runRemove}
                  >
                    <Trash2 aria-hidden />
                    Remove uploaded photo
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            disabled={isPending}
            aria-label="Edit profile picture"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={cn(
              "group relative w-fit shrink-0 rounded-full outline-none transition-[box-shadow,transform] duration-200 ease-studi",
              "focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
              "disabled:opacity-60",
            )}
          >
            <StudiAvatar
              profile={localProfile}
              src={src}
              size={96}
              className="shadow-[0_0_0_4px_var(--raised)]"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-[rgba(36,28,31,0.42)]">
              <Camera className="size-5 text-white" aria-hidden />
            </span>
          </button>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[15px] font-semibold text-ink">Profile picture</p>
            <p className="text-[13px] text-ink-2">
              Tap your photo to change it. JPEG, PNG or WebP up to 5 MB.
              Visibility is controlled under Privacy.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />

          <p className="text-[12.5px] text-ink-3">
            Current: {preferenceLabel}
            {localProfile.avatar_visibility === "private"
              ? " · Private by default"
              : null}
          </p>

          {progress ? (
            <p className="text-[13px] text-ink-2" role="status">
              {progress}
            </p>
          ) : null}

          {message ? (
            <p
              className={cn(
                "text-[13px] font-medium",
                message.type === "error" ? "text-danger" : "text-success",
              )}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      </div>

      {!isDesktop ? (
        <ResponsiveDialog
          open={menuOpen}
          onOpenChange={setMenuOpen}
          title="Profile picture"
          description="Choose how your avatar appears across Studi."
        >
          <div className="flex flex-col gap-1 pb-2">{actions}</div>
        </ResponsiveDialog>
      ) : null}

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

function AvatarAction({
  icon: Icon,
  label,
  disabled,
  destructive,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-[16px] px-3 text-left text-[15px] font-medium outline-none transition-colors",
        "focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50",
        destructive
          ? "text-danger hover:bg-danger/10"
          : "text-ink hover:bg-hover",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
