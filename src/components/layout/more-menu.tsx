"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { useShell } from "@/components/layout/shell-provider";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import {
  friendsNav,
  moreNav,
  plannerNav,
  progressNav,
  settingsNav,
  statisticsNav,
  studyTogetherNav,
  subjectsNav,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

const tileTone: Record<string, string> = {
  [studyTogetherNav.href]: "bg-[#E6F3EC] text-[#2F6E50]",
  [subjectsNav.href]: "bg-[#EFEBFA] text-[#5B4A99]",
  [plannerNav.href]: "bg-[#FBE9EC] text-[#A23A55]",
  [progressNav.href]: "bg-[#FAF0DF] text-[#8A5A12]",
  [statisticsNav.href]: "bg-[#E5F0F9] text-[#2B6896]",
  [friendsNav.href]: "bg-sunken text-ink-2",
};

const focusRing =
  "outline-none focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]";

export function MoreMenu() {
  const { profile, avatarSrc, setCommandOpen } = useShell();
  const displayName = profile.display_name || profile.username;
  const SettingsIcon = settingsNav.icon;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5">
      <h1 className="sr-only">More</h1>

      <Link
        href={`/u/${profile.username}`}
        className={cn("flex items-center gap-3 rounded-[20px] p-1", focusRing)}
      >
        <StudiAvatar profile={profile} src={avatarSrc} size={52} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-lg font-semibold text-ink">
            {displayName}
          </span>
          <span className="truncate text-[13px] text-ink-2">
            @{profile.username} · View profile
          </span>
        </span>
      </Link>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className={cn(
          "flex h-11 items-center gap-2.5 rounded-[14px] bg-sunken px-3.5 text-left text-[15px] text-ink-3",
          focusRing,
        )}
      >
        <Search aria-hidden className="size-4" />
        Search and jump to…
      </button>

      <nav aria-label="More destinations" className="grid grid-cols-2 gap-2.5">
        {moreNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-[110px] flex-col justify-between rounded-[22px] p-3.5 dark:bg-sunken dark:text-ink-2",
                tileTone[item.href],
                focusRing,
              )}
            >
              <Icon aria-hidden className="size-[22px]" />
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-semibold text-ink">
                  {item.title}
                </span>
                <span className="text-[12.5px]">{item.description}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <Link
        href={settingsNav.href}
        className={cn(
          "flex h-14 items-center gap-3 rounded-[20px] bg-sunken px-4",
          focusRing,
        )}
      >
        <SettingsIcon aria-hidden className="size-[18px] text-ink-2" />
        <span className="flex-1 text-[15px] text-ink">Settings</span>
        <ChevronRight aria-hidden className="size-4 text-ink-3" />
      </Link>
    </div>
  );
}
