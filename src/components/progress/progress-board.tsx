"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  CalendarCheck,
  Check,
  Clock,
  Flame,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  completeChallengeForSelf,
  createChallenge,
  refreshAchievements,
  respondChallengeInvite,
} from "@/actions/progress";
import { Tile, TileHeader, tileLinkClass } from "@/components/dashboard/tile";
import { AchievementBadge } from "@/components/progress/achievement-badge";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { Field, FormError, NativeSelect, PrimaryActions, SwitchRow } from "@/components/studi/form-controls";
import { PageTitle, primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { Segmented } from "@/components/studi/segmented";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { getFriendsLeaderboard, getProgressDashboard } from "@/lib/data/progress";
import type { FriendListItem } from "@/lib/data/friends";
import { formatDurationMinutes } from "@/lib/focus/timer-engine";
import { CHALLENGE_TYPES, type ChallengeType } from "@/lib/progress/challenges";
import { cn } from "@/lib/utils";

type Dash = Awaited<ReturnType<typeof getProgressDashboard>>;
type Board = Awaited<ReturnType<typeof getFriendsLeaderboard>>;

const CHALLENGE_META: Record<ChallengeType, { label: string; unit: string; icon: React.ComponentType<{ className?: string }> }> = {
  hours: { label: "Focus hours", unit: "hours", icon: Clock },
  pomodoros: { label: "Pomodoros", unit: "cycles", icon: Timer },
  distinct_days: { label: "Study days", unit: "days", icon: CalendarCheck },
  consistency: { label: "Consistency", unit: "days", icon: Target },
};

function fmt(seconds: number) {
  return formatDurationMinutes(Math.max(0, seconds) * 1000);
}

function dayLetter(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
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
  const [isPending, startTransition] = useTransition();
  const [challengeOpen, setChallengeOpen] = useState(false);

  const header = (
    <PageTitle
      title="Progress"
      actions={
        <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <ShieldCheck className="size-4" aria-hidden />
          <span className="hidden sm:inline">Only verified focus time counts</span>
          <span className="sm:hidden">Verified focus only</span>
        </span>
      }
    />
  );

  if (!data.prefs.enabled) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Tile className="px-5">
          <EmptyPanel
            icon={Trophy}
            title="Progress is paused"
            body="Streaks, badges, challenges and the leaderboard are off. Your focus history is safe and still shows in Statistics."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/settings" className={primaryPillClass}>
                  Turn on in Settings
                </Link>
                <Link href="/statistics" className={softPillClass}>
                  <BarChart3 className="size-3.5" aria-hidden />
                  Statistics
                </Link>
              </div>
            }
          />
        </Tile>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}
      <div className="grid gap-4 md:gap-5 min-[640px]:grid-cols-2 min-[1100px]:grid-cols-12">
        <StreakTile data={data} className="min-[640px]:col-span-2 min-[1100px]:col-span-5" />
        <GoalTile data={data} className="min-[1100px]:col-span-3" />
        <ChallengesTile
          data={data}
          isPending={isPending}
          startTransition={startTransition}
          onNew={() => setChallengeOpen(true)}
          className="min-[1100px]:col-span-4"
        />
        <AchievementsTile
          data={data}
          isPending={isPending}
          startTransition={startTransition}
          className="min-[640px]:col-span-2 min-[1100px]:col-span-8"
        />
        <LeaderboardTile leaderboard={leaderboard} className="min-[640px]:col-span-2 min-[1100px]:col-span-4" />
      </div>

      <ResponsiveDialog open={challengeOpen} onOpenChange={setChallengeOpen} title="New challenge">
        {challengeOpen ? (
          <ChallengeForm friends={friends} onDone={() => setChallengeOpen(false)} />
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}

function StreakTile({ data, className }: { data: Dash; className?: string }) {
  const streak = data.streak;
  const days = (streak?.days ?? []).filter((d) => d.status !== "future").slice(-14);
  const current = streak?.currentStreak ?? 0;
  const nextBadge = [3, 7, 14, 30].find((n) => n > current);

  return (
    <section
      aria-labelledby="streak-h"
      className={cn("flex min-w-0 flex-col justify-between gap-5 rounded-[22px] bg-warning-soft p-5 md:rounded-[26px] md:px-6 md:py-[22px]", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="streak-h" className="text-[14px] font-medium text-warning">
            Current streak
          </h2>
          <p className="text-[52px] leading-none font-semibold tracking-[-0.05em] text-ink tabular-nums md:text-[64px]">
            {current}{" "}
            <span className="text-[20px] tracking-[-0.02em] md:text-[22px]">{current === 1 ? "day" : "days"}</span>
          </p>
          <p className="text-[13.5px] text-warning">
            Longest {streak?.longestStreak ?? 0} days · {streak?.activeDaysThisWeek ?? 0} active this week
            {nextBadge && current > 0 ? ` · ${nextBadge - current} more to ${nextBadge}` : ""}
          </p>
        </div>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-[#C98A2E] text-white md:size-16 md:rounded-[20px] dark:bg-warning dark:text-[#241c1f]">
          <Flame className="size-7 md:size-8" aria-hidden />
        </span>
      </div>
      {days.length > 0 ? (
        <ol className="grid grid-cols-7 gap-[5px] sm:grid-cols-14" aria-label="Last 14 days">
          {days.map((d, i) => (
            <li
              key={d.date}
              className={cn("flex flex-col items-center gap-1", i < days.length - 7 && "max-sm:hidden")}
            >
              <span
                title={`${d.date}: ${fmt(d.focusSeconds)} · ${d.status}`}
                className={cn(
                  "flex aspect-square w-full items-center justify-center rounded-[8px]",
                  d.status === "active"
                    ? "bg-[#E9B96E] text-[#6B430B] dark:bg-warning dark:text-[#241c1f]"
                    : d.status === "rest"
                      ? "border border-dashed border-warning/50 text-warning"
                      : "bg-raised/70 dark:bg-white/5",
                )}
              >
                {d.status === "active" ? (
                  <Flame className="size-3" aria-hidden />
                ) : d.status === "rest" ? (
                  <Moon className="size-3" aria-hidden />
                ) : null}
                <span className="sr-only">{d.status}</span>
              </span>
              <span className="text-[10.5px] font-semibold text-warning">{dayLetter(d.date)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="text-[12px] text-warning/80">
        Active days need {data.prefs.min_daily_focus_minutes}+ min of verified focus. Rest days keep a
        streak without growing it, and today only counts once it ends.
      </p>
    </section>
  );
}

function GoalTile({ data, className }: { data: Dash; className?: string }) {
  const weekly = data.weekly;
  const progress = weekly?.progress ?? 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  const maxDay = Math.max(1, ...(weekly?.daily ?? []).map((d) => d.focusSeconds));

  return (
    <Tile variant="hero" className={cn("flex flex-col items-center justify-center gap-3 p-5 md:px-6", className)}>
      <div className="relative size-[132px] md:size-[140px]">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden>
          <circle cx={70} cy={70} r={r} fill="none" strokeWidth={12} className="stroke-[color-mix(in_srgb,var(--accent)_35%,transparent)]" />
          {weekly?.goalSeconds != null && progress > 0 ? (
            <circle
              cx={70}
              cy={70}
              r={r}
              fill="none"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - Math.min(1, progress))}
              className="stroke-accent-ink transition-[stroke-dashoffset] duration-700 ease-studi dark:stroke-accent"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {weekly?.goalSeconds != null ? (
            <>
              <span className="text-[28px] font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {weekly.percent ?? 0}%
              </span>
              <span className="text-[12px] text-ink-2">of {fmt(weekly.goalSeconds)}</span>
            </>
          ) : (
            <>
              <span className="text-[22px] font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {fmt(weekly?.completedSeconds ?? 0)}
              </span>
              <span className="text-[12px] text-ink-2">this week</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <h2 className="text-[14px] font-semibold text-ink">Weekly goal</h2>
        {weekly?.goalSeconds != null ? (
          <p className="text-[12.5px] text-ink-2">
            {weekly.remainingSeconds ? `${fmt(weekly.remainingSeconds)} left` : "Goal reached"} ·{" "}
            {weekly.previousWeekDeltaSeconds >= 0 ? "+" : "−"}
            {fmt(Math.abs(weekly.previousWeekDeltaSeconds))} vs last week
          </p>
        ) : (
          <Link href="/settings" className={tileLinkClass}>
            Set a weekly goal
          </Link>
        )}
      </div>
      {weekly?.daily?.length ? (
        <div className="flex h-9 w-full max-w-[180px] items-end gap-1" aria-label="This week by day">
          {weekly.daily.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-0.5" title={`${d.date}: ${fmt(d.focusSeconds)}`}>
              <span
                className={cn("w-full rounded-[3px]", d.focusSeconds > 0 ? "bg-accent-ink/80 dark:bg-accent" : "bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]")}
                style={{ height: d.focusSeconds > 0 ? `${Math.max(12, (d.focusSeconds / maxDay) * 100)}%` : 3 }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </Tile>
  );
}

function ChallengesTile({
  data,
  isPending,
  startTransition,
  onNew,
  className,
}: {
  data: Dash;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onNew: () => void;
  className?: string;
}) {
  const [now] = useState(() => Date.now());
  return (
    <Tile className={cn("flex flex-col gap-3 p-5", className)}>
      <TileHeader
        title="Challenges"
        action={
          <button type="button" onClick={onNew} className={cn(tileLinkClass, "inline-flex items-center gap-1")}>
            <Plus className="size-3.5" aria-hidden />
            New
          </button>
        }
      />

      {data.invitations.map((inv) => (
        <div key={inv.id} className="flex items-center gap-2 rounded-[16px] bg-accent-soft py-2 pr-2 pl-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-ink">{inv.challengeName}</p>
            <p className="text-[12px] text-ink-2">
              Invitation · expires {new Date(inv.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Decline ${inv.challengeName}`}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await respondChallengeInvite(inv.id, false);
                if (result.error) toast.error(result.error);
                else toast.success(result.success);
              })
            }
            className="flex size-9 items-center justify-center rounded-full bg-raised text-ink-2 outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)] disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Accept ${inv.challengeName}`}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await respondChallengeInvite(inv.id, true);
                if (result.error) toast.error(result.error);
                else toast.success(result.success);
              })
            }
            className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50 dark:bg-accent dark:text-ink-on-accent"
          >
            <Check className="size-4" aria-hidden />
          </button>
        </div>
      ))}

      {data.challenges.length === 0 ? (
        <EmptyPanel
          compact
          icon={Target}
          title="No challenges yet"
          body="Set a personal target, or invite friends to a shared one."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.challenges.map((c) => {
            const meta = CHALLENGE_META[c.challenge.challenge_type] ?? CHALLENGE_META.hours;
            const Icon = meta.icon;
            const daysLeft = Math.ceil((new Date(c.challenge.ends_at).getTime() - now) / 86_400_000);
            const done = c.challenge.status === "completed";
            return (
              <li
                key={c.challenge.id}
                className={cn(
                  "flex flex-col gap-2 rounded-[18px] px-3.5 py-3",
                  c.progress.completed || done ? "bg-success-soft" : "bg-sunken",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("size-4 shrink-0", c.progress.completed || done ? "text-success" : "text-accent-text")} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{c.challenge.name}</span>
                  <span className="shrink-0 text-[12px] text-ink-2">
                    {done ? "Done" : daysLeft > 0 ? `${daysLeft}d left` : "Ends today"}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-raised/90 dark:bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500 ease-studi", c.progress.completed || done ? "bg-success" : "bg-accent-ink dark:bg-accent")}
                    style={{ width: `${Math.min(100, Math.max(0, c.progress.percent))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[12.5px] text-ink-2">
                  <span className="tabular-nums">
                    {c.progress.current} / {c.progress.target} {meta.unit}
                    {c.participantCount > 1 ? ` · ${c.participantCount} people` : ""}
                  </span>
                  {c.progress.completed && !done ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await completeChallengeForSelf(c.challenge.id);
                          if (result.error) toast.error(result.error);
                          else toast.success(result.success);
                        })
                      }
                      className="rounded-full font-semibold text-success outline-none hover:underline focus-visible:shadow-[0_0_0_2px_var(--accent)]"
                    >
                      Mark complete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}

type BadgeFilter = "all" | "unlocked" | "locked";

function AchievementsTile({
  data,
  isPending,
  startTransition,
  className,
}: {
  data: Dash;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  className?: string;
}) {
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const unlockedCount = data.achievements.filter((a) => a.unlocked).length;
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000);
  const recent = useMemo(
    () =>
      new Set(
        data.recentUnlocks
          .filter((u) => new Date(u.unlocked_at).getTime() > weekAgo)
          .map((u) => u.achievement_id),
      ),
    [data.recentUnlocks, weekAgo],
  );
  const shown = data.achievements.filter((a) =>
    filter === "all" ? true : filter === "unlocked" ? a.unlocked : !a.unlocked,
  );

  return (
    <Tile className={cn("flex flex-col gap-4 p-5 md:px-[22px]", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="type-tile text-ink">Achievements</h2>
        <span className="text-[13px] text-ink-2">
          {unlockedCount} of {data.achievements.length} collected
        </span>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <Segmented
            label="Filter achievements"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "unlocked", label: "Unlocked" },
              { value: "locked", label: "Locked" },
            ]}
          />
          <button
            type="button"
            aria-label="Re-check unlocks"
            title="Re-check unlocks from your saved sessions"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await refreshAchievements();
                if (result.error) toast.error(result.error);
                else toast.success(result.success ?? "Updated");
              })
            }
            className="ml-auto flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2 outline-none hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50 sm:ml-0"
          >
            <RefreshCw className={cn("size-3.5", isPending && "animate-spin motion-reduce:animate-none")} aria-hidden />
          </button>
        </div>
      </div>

      {data.achievements.length === 0 ? (
        <EmptyPanel
          compact
          icon={Trophy}
          title="Badges aren’t available yet"
          body="The achievement catalog hasn’t loaded. Your progress is still being recorded."
        />
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-2">
          {filter === "unlocked" ? "Finish a focus session to collect your first badge." : "You’ve collected every badge."}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
          {shown.map((a, i) => (
            <li key={a.id}>
              <AchievementBadge
                title={a.title}
                description={a.description}
                icon={a.icon}
                category={a.category}
                unlocked={a.unlocked}
                unlockedAt={a.unlocked_at}
                isNew={recent.has(a.id)}
                index={i}
              />
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

function LeaderboardTile({ leaderboard, className }: { leaderboard: Board; className?: string }) {
  return (
    <Tile variant="data" className={cn("flex flex-col gap-1 p-5", className)}>
      <div className="flex items-baseline justify-between gap-3 pb-1.5">
        <h2 className="type-tile text-ink">Friends this week</h2>
        <span className="text-[12px] text-ink-2">Opt-in</span>
      </div>
      {!leaderboard.optedIn ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-2 py-4">
          <p className="text-[13.5px] text-ink-2">
            The leaderboard is off for you. Only friends who opt in appear, ranked by verified focus.
          </p>
          <Link href="/settings" className={tileLinkClass}>
            Join in Settings
          </Link>
        </div>
      ) : leaderboard.rows.length === 0 ? (
        <p className="py-4 text-[13.5px] text-ink-2">
          No rankings yet this week. Finish a focus session, or ask friends to opt in.
        </p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {leaderboard.rows.map((row) => (
            <li
              key={row.user_id}
              className={cn(
                "flex h-12 items-center gap-3 rounded-[14px] px-2.5",
                row.rank === 1 && "bg-raised",
              )}
            >
              <span
                className={cn(
                  "w-5 text-center text-[13.5px] font-bold tabular-nums",
                  row.rank === 1 ? "text-warning" : "text-ink-3",
                )}
              >
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
                size={30}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                {row.display_name || row.username}
              </span>
              <strong className="text-[14px] font-semibold text-ink tabular-nums">{fmt(row.focus_seconds)}</strong>
            </li>
          ))}
        </ol>
      )}
      {leaderboard.optedIn ? (
        <p className="mt-auto pt-2 text-[12px] text-ink-3">
          {leaderboard.weekStart} → {leaderboard.weekEnd} · verified focus only
        </p>
      ) : null}
    </Tile>
  );
}

function ChallengeForm({ friends, onDone }: { friends: FriendListItem[]; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChallengeType>("hours");
  const [target, setTarget] = useState("5");
  const [collaborative, setCollaborative] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);

  function create() {
    const starts = new Date();
    const ends = new Date(Date.now() + 7 * 24 * 3600_000);
    setError(undefined);
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
      if (result.error) setError(result.error);
      else {
        toast.success(result.success ?? "Created");
        onDone();
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
    >
      <Field label="Name" htmlFor="ch-name">
        <Input
          id="ch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="10 hours before the exam"
          autoFocus
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="ch-type">
          <NativeSelect id="ch-type" value={type} onChange={(e) => setType(e.target.value as ChallengeType)}>
            {CHALLENGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {CHALLENGE_META[t].label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={`Target (${CHALLENGE_META[type].unit})`} htmlFor="ch-target">
          <Input
            id="ch-target"
            type="number"
            inputMode="decimal"
            min={0.1}
            step={0.1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Description" htmlFor="ch-desc" optional>
        <Textarea
          id="ch-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={400}
          className="min-h-16"
        />
      </Field>
      <SwitchRow label="Invite friends to do it together" checked={collaborative} onChange={setCollaborative} />
      {collaborative ? (
        friends.length === 0 ? (
          <p className="text-[13px] text-ink-2">Add friends first to share a challenge.</p>
        ) : (
          <fieldset className="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-md)] bg-sunken p-1.5">
            <legend className="sr-only">Friends to invite</legend>
            {friends.map((f) => (
              <label key={f.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] text-ink hover:bg-hover">
                <input
                  type="checkbox"
                  checked={invitees.includes(f.id)}
                  onChange={(e) =>
                    setInvitees((prev) =>
                      e.target.checked ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                    )
                  }
                  className="size-4 accent-[var(--accent-ink)]"
                />
                {f.display_name || f.username}
                <span className="text-ink-3">@{f.username}</span>
              </label>
            ))}
          </fieldset>
        )
      ) : null}
      <p className="text-[12.5px] text-ink-3">
        Runs for the next 7 days and counts verified focus sessions only.
      </p>
      <FormError message={error} />
      <PrimaryActions>
        <button type="button" className={softPillClass} onClick={onDone} disabled={isPending}>
          Cancel
        </button>
        <button type="submit" className={primaryPillClass} disabled={isPending || !name.trim()}>
          {isPending ? "Creating…" : "Create challenge"}
        </button>
      </PrimaryActions>
    </form>
  );
}
