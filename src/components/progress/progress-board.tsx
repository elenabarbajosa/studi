"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  completeChallengeForSelf,
  createChallenge,
  refreshAchievements,
  respondChallengeInvite,
} from "@/actions/progress";
import { AchievementBadge } from "@/components/progress/achievement-badge";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { getFriendsLeaderboard, getProgressDashboard } from "@/lib/data/progress";
import type { FriendListItem } from "@/lib/data/friends";
import { CHALLENGE_TYPES } from "@/lib/progress/challenges";
import { cn } from "@/lib/utils";

type Dash = Awaited<ReturnType<typeof getProgressDashboard>>;
type Board = Awaited<ReturnType<typeof getFriendsLeaderboard>>;

type Tab =
  | "overview"
  | "streaks"
  | "goals"
  | "achievements"
  | "challenges"
  | "leaderboard";

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function ProgressBoard({
  data,
  leaderboard,
  friends,
}: {
  data: Dash;
  leaderboard: Board;
  friends: FriendListItem[];
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [isPending, startTransition] = useTransition();

  const unlockedCount = useMemo(
    () => data.achievements.filter((a) => a.unlocked).length,
    [data.achievements],
  );

  if (!data.prefs.enabled) {
    return (
      <div className="studi-panel px-6 py-16 text-center">
        <p className="font-display text-2xl tracking-tight">Progress is paused</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Enable gamification in Settings to see streaks, achievements, challenges,
          and the friends leaderboard. Your focus history stays intact.
        </p>
        <Link
          href="/settings"
          className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
        >
          Open settings
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "streaks", label: "Streaks" },
    { id: "goals", label: "Weekly goals" },
    { id: "achievements", label: "Achievements" },
    { id: "challenges", label: "Challenges" },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Current streak"
              value={`${data.streak?.currentStreak ?? 0} days`}
            />
            <Stat
              label="Longest streak"
              value={`${data.streak?.longestStreak ?? 0} days`}
            />
            <Stat
              label="This week"
              value={formatHours(data.weekly?.completedSeconds ?? 0)}
            />
            <Stat
              label="Achievements"
              value={`${unlockedCount}/${data.achievements.length}`}
            />
          </div>

          {data.weekly?.goalSeconds != null ? (
            <section className="studi-panel p-5">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-medium">Weekly goal</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatHours(data.weekly.completedSeconds)} of{" "}
                    {formatHours(data.weekly.goalSeconds)} ·{" "}
                    {data.weekly.percent ?? 0}%
                  </p>
                </div>
              </div>
              <ProgressBar value={data.weekly.progress ?? 0} />
            </section>
          ) : null}

          {data.challenges.filter((c) => c.challenge.status === "active").length >
          0 ? (
            <section className="space-y-2">
              <h2 className="font-display text-xl tracking-tight">
                Active challenges
              </h2>
              {data.challenges
                .filter((c) => c.challenge.status === "active")
                .slice(0, 3)
                .map((c) => (
                  <div key={c.challenge.id} className="studi-panel p-4">
                    <p className="font-medium">{c.challenge.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.progress.current}/{c.progress.target} · {c.progress.percent}%
                    </p>
                    <ProgressBar value={c.progress.percent / 100} className="mt-2" />
                  </div>
                ))}
            </section>
          ) : null}

          {data.recentUnlocks.length > 0 ? (
            <section className="space-y-2">
              <h2 className="font-display text-xl tracking-tight">
                Recent unlocks
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.recentUnlocks.map((u) => {
                  const meta = data.achievements.find(
                    (a) => a.id === u.achievement_id,
                  );
                  if (!meta) return null;
                  return (
                    <AchievementBadge
                      key={u.achievement_id}
                      title={meta.title}
                      description={meta.description}
                      icon={meta.icon}
                      unlocked
                      unlockedAt={u.unlocked_at}
                      compact
                    />
                  );
                })}
              </div>
            </section>
          ) : (
            <Empty
              title="No achievements yet"
              description="Complete a Focus session to start collecting badges from real study time."
            />
          )}
        </div>
      ) : null}

      {tab === "streaks" && data.streak ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Current" value={`${data.streak.currentStreak}`} />
            <Stat label="Longest" value={`${data.streak.longestStreak}`} />
            <Stat
              label="Active days this week"
              value={`${data.streak.activeDaysThisWeek}`}
            />
          </div>
          <div className="studi-panel p-5">
            <h2 className="mb-4 font-medium">Activity calendar</h2>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {data.streak.days.slice(-56).map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${Math.round(day.focusSeconds / 60)}m · ${day.status}`}
                  className={cn(
                    "aspect-square rounded-md border",
                    day.status === "active" && "border-primary bg-primary/70",
                    day.status === "rest" && "border-border bg-muted",
                    day.status === "missed" && "border-border/60 bg-background",
                    day.status === "empty" && "border-border/40 bg-muted/30",
                    day.status === "future" && "border-transparent bg-transparent",
                  )}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Active days need at least {data.prefs.min_daily_focus_minutes} minutes
              of verified focus. Rest days preserve streaks without increasing them.
              Today does not break a streak until it ends.
            </p>
          </div>
        </section>
      ) : null}

      {tab === "goals" && data.weekly ? (
        <section className="space-y-4">
          <div className="studi-panel p-5">
            <h2 className="font-medium">
              Week of {data.weekly.weekStart} → {data.weekly.weekEnd}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatHours(data.weekly.completedSeconds)} completed
              {data.weekly.remainingSeconds != null
                ? ` · ${formatHours(data.weekly.remainingSeconds)} remaining`
                : " · set a weekly hours goal in Settings"}
            </p>
            {data.weekly.progress != null ? (
              <ProgressBar value={data.weekly.progress} className="mt-3" />
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              vs last week:{" "}
              {data.weekly.previousWeekDeltaSeconds >= 0 ? "+" : ""}
              {formatHours(data.weekly.previousWeekDeltaSeconds)}
            </p>
          </div>
          <div className="studi-panel p-5">
            <h3 className="mb-3 font-medium">Daily activity</h3>
            <ul className="space-y-2">
              {data.weekly.daily.map((d) => (
                <li key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted-foreground">{d.date.slice(5)}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, (d.focusSeconds / 7200) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-14 text-right tabular-nums">
                    {formatHours(d.focusSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {tab === "achievements" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {unlockedCount} unlocked · historical progress is evaluated from your
              saved sessions
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await refreshAchievements();
                  if (result.error) toast.error(result.error);
                  else toast.success(result.success ?? "Updated");
                })
              }
            >
              Re-check unlocks
            </Button>
          </div>
          {data.achievements.length === 0 ? (
            <Empty
              title="Achievement catalog unavailable"
              description="Apply migration 010 to load badge definitions."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.achievements.map((a) => (
                <AchievementBadge
                  key={a.id}
                  title={a.title}
                  description={a.description}
                  icon={a.icon}
                  unlocked={a.unlocked}
                  unlockedAt={a.unlocked_at}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "challenges" ? (
        <ChallengesPanel
          data={data}
          friends={friends}
          isPending={isPending}
          startTransition={startTransition}
        />
      ) : null}

      {tab === "leaderboard" ? (
        <section className="space-y-4">
          {!leaderboard.optedIn ? (
            <Empty
              title="Leaderboard is opt-in"
              description="Enable friends leaderboard participation in Settings. Only opted-in friends appear, using the same verified focus time as Statistics."
            />
          ) : leaderboard.rows.length === 0 ? (
            <Empty
              title="No rankings this week"
              description="Invite friends and ask them to opt in — or complete a focus session to appear."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Week {leaderboard.weekStart} → {leaderboard.weekEnd} · verified
                focus only
              </p>
              <ul className="space-y-2">
                {leaderboard.rows.map((row) => (
                  <li
                    key={row.user_id}
                    className="studi-panel flex items-center gap-3 p-3"
                  >
                    <span className="w-8 text-center font-display text-lg tabular-nums">
                      {row.rank}
                    </span>
                    <StudiAvatar
                      profile={{
                        display_name: row.display_name,
                        username: row.username,
                        accent_color: row.accent_color,
                        avatar_preference: row.avatar_preference,
                        avatar_path: null,
                        google_avatar_url: null,
                      }}
                      src={row.avatarSrc}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.display_name || row.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{row.username}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums">
                      {formatHours(row.focus_seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ChallengesPanel({
  data,
  friends,
  isPending,
  startTransition,
}: {
  data: Dash;
  friends: FriendListItem[];
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<(typeof CHALLENGE_TYPES)[number]>("hours");
  const [target, setTarget] = useState("5");
  const [collaborative, setCollaborative] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);

  function create() {
    const starts = new Date();
    const ends = new Date(Date.now() + 7 * 24 * 3600_000);
    startTransition(async () => {
      const result = await createChallenge({
        name,
        description,
        challenge_type: type,
        target_value: Number(target),
        visibility: collaborative ? "collaborative" : "individual",
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        invitee_ids: collaborative ? invitees : [],
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success(result.success ?? "Created");
        setName("");
        setDescription("");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        {data.invitations.length > 0 ? (
          <section className="space-y-2">
            <h2 className="font-display text-xl tracking-tight">Invitations</h2>
            {data.invitations.map((inv) => (
              <div
                key={inv.id}
                className="studi-panel flex flex-wrap items-center justify-between gap-2 p-4"
              >
                <div>
                  <p className="font-medium">{inv.challengeName}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await respondChallengeInvite(inv.id, true);
                        if (result.error) toast.error(result.error);
                        else toast.success(result.success);
                      })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await respondChallengeInvite(inv.id, false);
                        if (result.error) toast.error(result.error);
                        else toast.success(result.success);
                      })
                    }
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {data.challenges.length === 0 ? (
          <Empty
            title="No challenges yet"
            description="Create a personal target or invite friends to a collaborative goal."
          />
        ) : (
          <ul className="space-y-3">
            {data.challenges.map((c) => (
              <li key={c.challenge.id} className="studi-panel space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.challenge.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.challenge.challenge_type} · {c.challenge.visibility} ·{" "}
                      {c.participantCount} participant
                      {c.participantCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {c.progress.completed ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await completeChallengeForSelf(
                            c.challenge.id,
                          );
                          if (result.error) toast.error(result.error);
                          else toast.success(result.success);
                        })
                      }
                    >
                      Mark complete
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.progress.current} / {c.progress.target} ({c.progress.percent}
                  %)
                </p>
                <ProgressBar value={c.progress.percent / 100} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="studi-panel space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <h2 className="font-display text-xl tracking-tight">New challenge</h2>
        <div className="space-y-2">
          <Label htmlFor="ch-name">Name</Label>
          <Input
            id="ch-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ch-desc">Description</Label>
          <Textarea
            id="ch-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={400}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
              value={type}
              onChange={(e) =>
                setType(e.target.value as (typeof CHALLENGE_TYPES)[number])
              }
            >
              {CHALLENGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-target">Target</Label>
            <Input
              id="ch-target"
              type="number"
              min={0.1}
              step={0.1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={collaborative}
            onChange={(e) => setCollaborative(e.target.checked)}
          />
          Collaborative (invite friends)
        </label>
        {collaborative ? (
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {friends.map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={invitees.includes(f.id)}
                  onChange={(e) =>
                    setInvitees((prev) =>
                      e.target.checked
                        ? [...prev, f.id]
                        : prev.filter((id) => id !== f.id),
                    )
                  }
                />
                {f.display_name || f.username}
              </label>
            ))}
          </div>
        ) : null}
        <Button type="submit" disabled={isPending || !name.trim()}>
          Create challenge
        </Button>
        <p className="text-xs text-muted-foreground">
          Default window: next 7 days. Progress uses verified focus sessions only.
        </p>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="studi-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl tracking-tight">{value}</p>
    </div>
  );
}

function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("h-2 rounded-full bg-muted", className)}>
      <div
        className="h-2 rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="studi-panel px-5 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
