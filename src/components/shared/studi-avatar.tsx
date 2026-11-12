"use client";

import { useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarBadge,
} from "@/components/ui/avatar";
import {
  AVATAR_SIZE_PX,
  avatarAccentClasses,
  avatarInitials,
  avatarLabel,
  type AvatarSizeToken,
  type ProfileAvatarFields,
} from "@/lib/avatar";
import { cn } from "@/lib/utils";

type StudiAvatarProps = {
  profile: ProfileAvatarFields;
  /** Resolved image URL (signed custom URL or Google URL). */
  src?: string | null;
  size?: AvatarSizeToken | number;
  showOnline?: boolean;
  online?: boolean;
  className?: string;
  fallbackClassName?: string;
};

export function StudiAvatar({
  profile,
  src,
  size = "md",
  showOnline = false,
  online = false,
  className,
  fallbackClassName,
}: StudiAvatarProps) {
  const [failed, setFailed] = useState(false);
  const px = typeof size === "number" ? size : AVATAR_SIZE_PX[size];
  const label = avatarLabel(profile);
  const initials = avatarInitials(profile.display_name, profile.username);
  const showImage = Boolean(src) && !failed;
  const tokenSize =
    typeof size === "number"
      ? size <= 32
        ? "sm"
        : size >= 80
          ? "lg"
          : "default"
      : size === "sm"
        ? "sm"
        : size === "lg" || size === "xl"
          ? "lg"
          : "default";

  return (
    <Avatar
      size={tokenSize}
      className={cn("overflow-hidden", className)}
      style={{ width: px, height: px }}
      aria-label={label}
    >
      {showImage ? (
        <AvatarImage
          src={src!}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : null}
      <AvatarFallback
        className={cn(
          avatarAccentClasses(profile.accent_color),
          "font-medium",
          px <= 28 && "text-[10px]",
          px > 28 && px < 80 && "text-xs",
          px >= 80 && "text-2xl",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
      {showOnline ? (
        <AvatarBadge
          className={cn(
            online ? "bg-emerald-500" : "bg-muted-foreground/50",
            "ring-background",
          )}
          aria-hidden
        />
      ) : null}
    </Avatar>
  );
}
