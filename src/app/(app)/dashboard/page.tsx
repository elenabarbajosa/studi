import Link from "next/link";
import { Suspense } from "react";

import { AgendaTile, type AgendaItem } from "@/components/dashboard/agenda-tile";
import {
  CountdownTile,
  MobileNextExamTile,
  type CountdownItem,
} from "@/components/dashboard/countdown-tile";
import {
  DashboardHeader,
  MobileDashboardHeader,
} from "@/components/dashboard/dashboard-header";
import {
  FriendsTile,
  MobileFriendsStrip,
  type FriendsTileData,
} from "@/components/dashboard/friends-tile";
import { NewTaskProvider } from "@/components/dashboard/new-task-provider";
import { SubjectsTile, type SubjectRow } from "@/components/dashboard/subjects-tile";
import {
  MobileTodayTasks,
  TodayTasksTile,
  type TodayTaskRow,
} from "@/components/dashboard/today-tasks";
import {
  MobileUpNextTile,
  UpNextTile,
  type UpNextContent,
} from "@/components/dashboard/up-next-tile";
import {
  MobileWeekFocusTile,
  WeekFocusTile,
  type WeekFocusData,
} from "@/components/dashboard/week-focus-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { resolveAvatarSrc } from "@/lib/avatar-server";
import { ASSESSMENT_TYPE_META, toLocalTimeInput } from "@/lib/calendar";
import {
  buildWeekBars,
  daysUntil,
  pickUpNext,
  relativeDayLabel,
  sortByPriority,
} from "@/lib/dashboard";
import { getDashboardAgenda } from "@/lib/data/calendar";
import { getFocusStats } from "@/lib/data/focus";
import { getFriendsDashboard } from "@/lib/data/friends";
import { getProgressDashboard } from "@/lib/data/progress";
import { getStudyTogetherHub } from "@/lib/data/study-together";
import {
  getStudyPreferences,
  listAllTopics,
  listSubjects,
} from "@/lib/data/subjects";
import { canResumeOnboarding } from "@/lib/onboarding";
import { subjectTone, topicProgressSummary } from "@/lib/subjects";
import type { Assessment, Subject, Task, Topic } from "@/types/database";

export const metadata = {
  title: "Dashboard",
};

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function inDays(iso: string, now: Date) {
  const days = daysUntil(iso, now);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function topicsMastered(subjectId: string | null, topics: Topic[]) {
  if (!subjectId) return null;
  const summary = topicProgressSummary(topics.filter((t) => t.subject_id === subjectId));
  if (summary.total === 0) return null;
  return `${summary.mastered} of ${summary.total} topics mastered`;
}

function buildUpNext(input: {
  todayTasks: Task[];
  overdueTasks: Task[];
  nextAssessment: Assessment | null;
  subjectById: Map<string, Subject>;
  topics: Topic[];
  now: Date;
}): UpNextContent {
  const { nextAssessment, subjectById, topics, now } = input;
  const pick = pickUpNext(input);
  const subjectName = (id: string | null) => (id ? subjectById.get(id)?.name : undefined);
  const join = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(" · ") || null;

  if (pick) {
    const { task, reason } = pick;
    return {
      label: reason === "overdue" ? "Catch up" : "Up next",
      title: task.title,
      meta: join(
        subjectName(task.subject_id),
        reason === "exam" && nextAssessment
          ? `${nextAssessment.title} ${inDays(nextAssessment.starts_at, now)}`
          : reason === "overdue" && task.due_at
            ? `Was due ${relativeDayLabel(task.due_at, now).toLowerCase()}`
            : "Due today",
        topicsMastered(task.subject_id, topics),
      ),
    };
  }

  if (nextAssessment) {
    return {
      label: "Nothing due today",
      title: `Review for ${nextAssessment.title}`,
      meta: join(
        subjectName(nextAssessment.subject_id),
        `${ASSESSMENT_TYPE_META[nextAssessment.assessment_type].label} ${inDays(nextAssessment.starts_at, now)}`,
        topicsMastered(nextAssessment.subject_id, topics),
      ),
    };
  }

  return {
    label: "Ready when you are",
    title: "Start a focus session",
    meta: "Add tasks and exams, and Studi will suggest what to study next.",
  };
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const confirmed = params.confirmed === "1" || params.confirmed === "true";
  const resetSuccess = params.reset === "success";

  const [
    subjects,
    topics,
    agenda,
    avatarSrc,
    friendsDash,
    progressDash,
    focusStats,
    studyPrefs,
    hub,
  ] = await Promise.all([
    listSubjects(),
    listAllTopics(),
    getDashboardAgenda(),
    resolveAvatarSrc(profile),
    getFriendsDashboard(),
    getProgressDashboard(),
    getFocusStats(),
    getStudyPreferences(),
    getStudyTogetherHub(),
  ]);

  const now = new Date();
  const name = profile.display_name || profile.username;
  const firstName = name.split(" ")[0] || name;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const subjectDot = (id: string | null) => {
    const subject = id ? subjectById.get(id) : undefined;
    return subject ? subjectTone(subject.color).dot : null;
  };

  const upNext = buildUpNext({
    todayTasks: agenda.todayTasks,
    overdueTasks: agenda.overdueTasks,
    nextAssessment: agenda.upcomingAssessments[0] ?? null,
    subjectById,
    topics,
    now,
  });
  const focusMinutes = studyPrefs?.pomodoro_focus_minutes ?? 25;
  const breakMinutes = studyPrefs?.pomodoro_short_break_minutes ?? 5;

  const toRow = (task: Task, overdue: boolean): TodayTaskRow => ({
    id: task.id,
    title: task.title,
    priority: task.priority,
    subjectName: task.subject_id ? (subjectById.get(task.subject_id)?.name ?? null) : null,
    subjectDot: subjectDot(task.subject_id),
    overdueLabel: overdue ? "Overdue" : null,
  });
  const taskRows = [
    ...agenda.overdueTasks.map((t) => toRow(t, true)),
    ...sortByPriority(agenda.todayTasks).map((t) => toRow(t, false)),
  ];

  const countdown: CountdownItem[] = agenda.upcomingAssessments.map((a) => {
    const subject = a.subject_id ? subjectById.get(a.subject_id) : undefined;
    return {
      id: a.id,
      title: a.title,
      typeLabel: ASSESSMENT_TYPE_META[a.assessment_type].label,
      subjectName: subject?.name ?? null,
      subjectColor: subject?.color ?? null,
      days: daysUntil(a.starts_at, now),
      weekday: new Date(a.starts_at).toLocaleDateString("en-GB", { weekday: "short" }),
      href: subject ? `/subjects/${subject.id}` : "/calendar",
    };
  });

  const weekSessionIds = new Set(agenda.weekSessions.map((s) => s.id));
  const sessionTitle = (subjectId: string | null) => {
    const subject = subjectId ? subjectById.get(subjectId) : undefined;
    return subject ? `Study: ${subject.name}` : "Study session";
  };
  const agendaItems: (AgendaItem & { at: number })[] = [
    ...agenda.weekAssessments.map((a) => ({
      id: a.id,
      kind: "assessment" as const,
      title: a.title,
      meta: [
        ASSESSMENT_TYPE_META[a.assessment_type].label,
        a.subject_id ? subjectById.get(a.subject_id)?.name : null,
      ]
        .filter(Boolean)
        .join(" · "),
      when: a.starts_at,
      allDay: a.all_day,
      subjectDot: subjectDot(a.subject_id),
    })),
    ...[
      ...agenda.weekSessions,
      ...agenda.upcomingSessions.filter((s) => !weekSessionIds.has(s.id)),
    ].map((s) => ({
      id: s.id,
      kind: "session" as const,
      title: sessionTitle(s.subject_id),
      meta: `${s.planned_duration_minutes} min${s.ends_at ? ` · until ${toLocalTimeInput(s.ends_at)}` : ""}`,
      when: s.starts_at,
      allDay: false,
      subjectDot: subjectDot(s.subject_id),
    })),
    ...agenda.weekEvents.map((e) => ({
      id: e.id,
      kind: "event" as const,
      title: e.title,
      meta: "Personal",
      when: e.starts_at,
      allDay: e.all_day,
      subjectDot: null,
    })),
  ]
    .map(({ when, allDay, ...item }) => ({
      ...item,
      at: new Date(when).getTime(),
      dayLabel: relativeDayLabel(when, now),
      timeLabel: allDay ? "All day" : toLocalTimeInput(when),
    }))
    .sort((a, b) => a.at - b.at);

  const subjectRows: SubjectRow[] = subjects.map((s) => {
    const summary = topicProgressSummary(topics.filter((t) => t.subject_id === s.id));
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      topicCount: summary.total,
      masteredCount: summary.mastered,
    };
  });

  const gamification = progressDash.prefs.enabled;
  const activeChallenge = gamification
    ? progressDash.challenges.find((c) => c.challenge.status === "active")
    : undefined;
  const latestUnlock = gamification ? progressDash.recentUnlocks[0] : undefined;
  const weekFocus: WeekFocusData = {
    weekSeconds: focusStats.weekSeconds,
    goalHours: focusStats.weeklyGoalHours,
    bars: buildWeekBars(focusStats.daily, now),
    challenge: activeChallenge
      ? {
          name: activeChallenge.challenge.name,
          percent: activeChallenge.progress.percent,
        }
      : null,
    latestBadge: latestUnlock
      ? (progressDash.achievements.find((a) => a.id === latestUnlock.achievement_id)
          ?.title ?? null)
      : null,
  };

  const roomCard = hub.friendRooms[0] ?? hub.myRooms[0] ?? null;
  const friends: FriendsTileData = {
    friendCount: friendsDash.friendCount,
    pendingIncoming: friendsDash.pendingIncoming,
    studying: friendsDash.studying,
    friends: friendsDash.friends,
    room: roomCard
      ? {
          id: roomCard.room.id,
          name: roomCard.room.name,
          ownerLabel: roomCard.isHost
            ? "Your room"
            : roomCard.hostUsername
              ? `@${roomCard.hostUsername}’s room`
              : "A friend’s room",
        }
      : null,
  };

  const notices = (
    <>
      {confirmed ? (
        <Notice>Email confirmed. Your private Studi profile is ready.</Notice>
      ) : null}
      {resetSuccess ? <Notice>Password updated successfully.</Notice> : null}
      {canResumeOnboarding(profile) && profile.onboarding_status !== "completed" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-sunken px-5 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">Finish setup</p>
            <p className="mt-0.5 text-[13.5px] text-ink-2">
              Add subjects and study preferences, or keep exploring and return later.
            </p>
          </div>
          <Link
            href="/onboarding?resume=1"
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground outline-none hover:brightness-[.92] focus-visible:ring-2 focus-visible:ring-ring dark:bg-accent dark:text-ink-on-accent"
          >
            Continue onboarding
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <NewTaskProvider subjects={subjects} topics={topics}>
      <div className="hidden flex-col gap-[18px] md:flex">
        <DashboardHeader
          firstName={firstName}
          streakDays={gamification ? (progressDash.streak?.currentStreak ?? 0) : null}
        />
        {notices}
        <div className="flex flex-wrap gap-3.5">
          <UpNextTile
            content={upNext}
            focusMinutes={focusMinutes}
            breakMinutes={breakMinutes}
          />
          <WeekFocusTile data={weekFocus} />
        </div>
        <div className="flex flex-wrap gap-3.5">
          <TodayTasksTile rows={taskRows} />
          <CountdownTile items={countdown} />
          <FriendsTile data={friends} />
        </div>
        <div className="flex flex-wrap gap-3.5">
          <AgendaTile items={agendaItems} />
          <SubjectsTile rows={subjectRows} />
        </div>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        <MobileDashboardHeader profile={profile} avatarSrc={avatarSrc} />
        {notices}
        <MobileUpNextTile
          content={upNext}
          focusMinutes={focusMinutes}
          breakMinutes={breakMinutes}
        />
        <div className="grid grid-cols-2 gap-3">
          <MobileWeekFocusTile data={weekFocus} />
          <MobileNextExamTile item={countdown[0] ?? null} />
        </div>
        <MobileTodayTasks rows={taskRows} />
        <MobileFriendsStrip data={friends} />
        <AgendaTile items={agendaItems} />
        <SubjectsTile rows={subjectRows} />
      </div>
    </NewTaskProvider>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-[18px] bg-accent-soft px-4 py-3 text-[14px] text-ink"
    >
      {children}
    </p>
  );
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-3 md:gap-[18px]" aria-busy="true">
      <span className="sr-only">Loading your dashboard</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="h-9 w-72 max-w-full rounded-xl" />
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Skeleton className="h-[176px] flex-[7_1_480px] rounded-[22px] md:h-[248px] md:rounded-[26px]" />
        <Skeleton className="hidden h-[248px] flex-[5_1_320px] rounded-[26px] md:block" />
      </div>
      <div className="flex flex-wrap gap-3.5">
        <Skeleton className="h-[240px] flex-[5_1_320px] rounded-[22px] md:rounded-[26px]" />
        <Skeleton className="hidden h-[240px] flex-[4_1_280px] rounded-[26px] md:block" />
        <Skeleton className="hidden h-[240px] flex-[3_1_220px] rounded-[26px] md:block" />
      </div>
    </div>
  );
}

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
