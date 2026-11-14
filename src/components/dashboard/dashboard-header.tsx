"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CalendarPlus, Flame, Plus, Users } from "lucide-react";

import { useOpenNewTask } from "@/components/dashboard/new-task-provider";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import type { ProfileAvatarFields } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const pillClass =
  "inline-flex h-9 items-center gap-[7px] rounded-full bg-sunken px-3.5 text-[13.5px] font-medium text-ink outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring";

const noopSubscribe = () => () => {};

/** Greeting and date depend on the viewer's clock, so they render on the client. */
function useLocalDay() {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const now = new Date();
      const hour = now.getHours();
      const part = hour < 5 ? "evening" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
      const date = now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      return `${part}|${date}`;
    },
    () => null,
  );
}

export function DashboardHeader({
  firstName,
  streakDays,
}: {
  firstName: string;
  streakDays: number | null;
}) {
  const localDay = useLocalDay();
  const [part, date] = localDay ? localDay.split("|") : [null, null];
  const openNewTask = useOpenNewTask();

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="min-h-5 text-sm font-medium text-ink-2">{date}</p>
        <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink">
          {part ? `Good ${part}, ${firstName}` : `Welcome back, ${firstName}`}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {streakDays != null && streakDays > 0 ? (
          <Link
            href="/progress"
            className={cn(
              pillClass,
              "gap-1.5 bg-warning-soft px-[13px] font-semibold text-warning hover:bg-warning-soft hover:brightness-95",
            )}
          >
            <Flame className="size-3.5" aria-hidden />
            {streakDays} {streakDays === 1 ? "day" : "days"}
            <span className="sr-only"> streak, open Progress</span>
          </Link>
        ) : null}
        <button type="button" onClick={openNewTask} className={pillClass}>
          <Plus className="size-[15px]" aria-hidden />
          Task
        </button>
        <Link href="/calendar" className={pillClass}>
          <CalendarPlus className="size-[15px]" aria-hidden />
          Event
        </Link>
        <Link href="/study-together" className={pillClass}>
          <Users className="size-[15px]" aria-hidden />
          Room
        </Link>
      </div>
    </div>
  );
}

export function MobileDashboardHeader({
  profile,
  avatarSrc,
}: {
  profile: ProfileAvatarFields & { username: string };
  avatarSrc: string | null;
}) {
  return (
    <div className="flex items-center justify-between px-1 pb-1">
      <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.035em] text-ink">
        Today
      </h1>
      <Link
        href={`/u/${profile.username}`}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StudiAvatar profile={profile} src={avatarSrc} size={36} />
        <span className="sr-only">View your profile</span>
      </Link>
    </div>
  );
}
