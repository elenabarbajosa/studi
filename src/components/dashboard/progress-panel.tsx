import Link from "next/link";
import { Trophy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { getProgressDashboard } from "@/lib/data/progress";
import { cn } from "@/lib/utils";

type Dash = Awaited<ReturnType<typeof getProgressDashboard>>;

export function ProgressPanel({ data }: { data: Dash }) {
  if (!data.prefs.enabled) return null;

  const weeklyPct = data.weekly?.percent ?? null;
  const activeChallenge = data.challenges.find(
    (c) => c.challenge.status === "active",
  );
  const recent = data.recentUnlocks[0];
  const recentMeta = recent
    ? data.achievements.find((a) => a.id === recent.achievement_id)
    : null;

  return (
    <section className="studi-panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.streak?.currentStreak ?? 0}-day streak
            {weeklyPct != null ? ` · ${weeklyPct}% of weekly goal` : ""}
          </p>
        </div>
        <Link
          href="/progress"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5",
          )}
        >
          <Trophy className="size-4" aria-hidden />
          Open
        </Link>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {activeChallenge ? (
          <li>
            Challenge: {activeChallenge.challenge.name} (
            {activeChallenge.progress.percent}%)
          </li>
        ) : (
          <li>No active challenge</li>
        )}
        {recentMeta ? (
          <li>Latest badge: {recentMeta.title}</li>
        ) : (
          <li>Complete a focus session to unlock badges</li>
        )}
      </ul>
    </section>
  );
}
