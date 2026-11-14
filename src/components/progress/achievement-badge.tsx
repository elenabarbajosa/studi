"use client";

import {
  BookOpen,
  Crown,
  DoorOpen,
  Flag,
  Flame,
  Hourglass,
  Lock,
  Medal,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  spark: Sparkles,
  hourglass: Hourglass,
  timer: Timer,
  flame: Flame,
  crown: Crown,
  book: BookOpen,
  medal: Medal,
  users: Users,
  room: DoorOpen,
  flag: Flag,
};

const CATEGORY_TONE: Record<string, string> = {
  getting_started: "bg-accent-soft text-accent-text",
  consistency: "bg-warning-soft text-warning",
  milestones: "bg-success-soft text-success",
  social: "bg-accent-soft text-accent-text",
  challenges: "bg-warning-soft text-warning",
};

const TILT = [-4, 3, -2, 4, -3, 2];

type AchievementBadgeProps = {
  title: string;
  description: string;
  icon: string;
  category?: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  isNew?: boolean;
  index?: number;
  size?: "md" | "sm";
};

/** Collectible badge: tilted tile when unlocked, flat and quiet while locked. */
export function AchievementBadge({
  title,
  description,
  icon,
  category = "getting_started",
  unlocked,
  unlockedAt,
  isNew = false,
  index = 0,
  size = "md",
}: AchievementBadgeProps) {
  const Icon = ICONS[icon] ?? Sparkles;
  const tile = size === "sm" ? "size-[62px] rounded-[20px]" : "size-[66px] rounded-[22px]";

  return (
    <div
      className="group/badge flex min-w-0 flex-col items-center gap-1.5 text-center"
      title={
        unlocked && unlockedAt
          ? `${description} Unlocked ${new Date(unlockedAt).toLocaleDateString()}.`
          : description
      }
    >
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center transition-[rotate] duration-300 ease-studi motion-reduce:transition-none",
          tile,
          unlocked
            ? cn(
                CATEGORY_TONE[category] ?? CATEGORY_TONE.getting_started,
                "rotate-(--tilt) shadow-[0_6px_14px_-8px_rgba(36,28,31,0.35)] group-hover/badge:rotate-0 motion-reduce:rotate-0",
              )
            : "bg-sunken text-ink-4",
        )}
        style={unlocked ? ({ "--tilt": `${TILT[index % TILT.length]}deg` } as React.CSSProperties) : undefined}
      >
        <Icon className={size === "sm" ? "size-6" : "size-7"} aria-hidden />
        {!unlocked ? (
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-raised text-ink-3 shadow-[0_0_0_2px_var(--raised)]">
            <Lock className="size-2.5" aria-hidden />
          </span>
        ) : null}
        {isNew ? (
          <span className="absolute -top-1.5 -right-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9.5px] font-bold text-primary-foreground dark:bg-accent dark:text-ink-on-accent">
            NEW
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "line-clamp-2 text-[12.5px] leading-tight font-semibold",
          unlocked ? "text-ink" : "text-ink-3",
        )}
      >
        {title}
      </span>
      {size === "md" ? (
        <span className="line-clamp-2 text-[11.5px] leading-tight text-ink-3">{description}</span>
      ) : null}
      <span className="sr-only">{unlocked ? "Unlocked" : "Locked"}</span>
    </div>
  );
}
