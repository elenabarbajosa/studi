"use client";

import { cn } from "@/lib/utils";

const ICONS: Record<string, string> = {
  spark: "✦",
  hourglass: "⏳",
  timer: "◎",
  flame: "▴",
  crown: "◈",
  book: "▣",
  medal: "◉",
  users: "⚭",
  room: "⌂",
  flag: "⚑",
};

type AchievementBadgeProps = {
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  compact?: boolean;
};

export function AchievementBadge({
  title,
  description,
  icon,
  unlocked,
  unlockedAt,
  compact = false,
}: AchievementBadgeProps) {
  return (
    <div
      className={cn(
        "studi-panel relative overflow-hidden p-4 transition-transform",
        unlocked
          ? "motion-safe:hover:-translate-y-0.5"
          : "opacity-60 grayscale",
        compact && "p-3",
      )}
    >
      <div
        className={cn(
          "mb-3 flex size-12 items-center justify-center rounded-2xl text-lg",
          unlocked
            ? "bg-gradient-to-br from-primary/25 via-brand-soft to-primary/10 text-primary shadow-sm"
            : "border border-dashed border-border bg-muted/40 text-muted-foreground",
        )}
        aria-hidden
      >
        {ICONS[icon] ?? "✦"}
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {unlocked && unlockedAt ? (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-primary">
          Unlocked {new Date(unlockedAt).toLocaleDateString()}
        </p>
      ) : (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          Locked
        </p>
      )}
    </div>
  );
}
