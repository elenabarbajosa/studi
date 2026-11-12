import Link from "next/link";
import { Suspense } from "react";
import {
  BookOpen,
  ClipboardList,
  Focus,
  Handshake,
  Settings,
} from "lucide-react";

import { AgendaPanels } from "@/components/dashboard/agenda-panels";
import { PageHeader } from "@/components/shared/page-header";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { SubjectCard } from "@/components/subjects/subject-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { resolveAvatarSrc } from "@/lib/avatar-server";
import { getDashboardAgenda } from "@/lib/data/calendar";
import { listSubjects, listTopicsForSubject } from "@/lib/data/subjects";
import { canResumeOnboarding } from "@/lib/onboarding";
import { topicProgressSummary } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Dashboard",
};

const laterModules = [
  {
    title: "Study Planner",
    href: "/planner",
    icon: ClipboardList,
    copy: "Automatic weekly plans arrive in Phase 4.",
  },
  {
    title: "Focus",
    href: "/focus",
    icon: Focus,
    copy: "Pomodoro sessions with honest tracking.",
  },
  {
    title: "Study Together",
    href: "/study-together",
    icon: Handshake,
    copy: "Virtual rooms for co-working sessions.",
  },
];

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const name = profile.display_name || profile.username;
  const confirmed = params.confirmed === "1" || params.confirmed === "true";
  const resetSuccess = params.reset === "success";
  const [subjects, agenda, avatarSrc] = await Promise.all([
    listSubjects(),
    getDashboardAgenda(),
    resolveAvatarSrc(profile),
  ]);

  const subjectCards = await Promise.all(
    subjects.slice(0, 3).map(async (subject) => {
      const topics = await listTopicsForSubject(subject.id);
      return { subject, summary: topicProgressSummary(topics) };
    }),
  );

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4">
        <StudiAvatar
          profile={profile}
          src={avatarSrc}
          size={56}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={`Hello, ${name}`}
            description="Your academic workspace — tasks, exams, and study sessions from your own data."
            actions={
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/tasks"
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                >
                  Tasks
                </Link>
                <Link
                  href="/settings"
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                >
                  <Settings className="size-4" aria-hidden />
                  Preferences
                </Link>
              </div>
            }
          />
        </div>
      </div>

      {confirmed ? (
        <p
          className="mb-6 rounded-xl border border-border bg-brand-soft px-4 py-3 text-sm text-foreground"
          role="status"
        >
          Email confirmed. Your private Studi profile is ready.
        </p>
      ) : null}

      {resetSuccess ? (
        <p
          className="mb-6 rounded-xl border border-border bg-brand-soft px-4 py-3 text-sm text-foreground"
          role="status"
        >
          Password updated successfully.
        </p>
      ) : null}

      {canResumeOnboarding(profile) &&
      profile.onboarding_status !== "completed" ? (
        <div className="studi-panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-primary">Finish setup</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete onboarding to add subjects and study preferences — or
              keep exploring and return later.
            </p>
          </div>
          <Link href="/onboarding?resume=1" className={cn(buttonVariants())}>
            Continue onboarding
          </Link>
        </div>
      ) : null}

      <AgendaPanels {...agenda} subjects={subjects} />

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Subjects</h2>
            <p className="text-sm text-muted-foreground">
              {subjects.length === 0
                ? "No subjects yet."
                : `${subjects.length} subject${subjects.length === 1 ? "" : "s"} in your library.`}
            </p>
          </div>
          <Link
            href="/subjects"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
          >
            <BookOpen className="size-4" />
            Manage
          </Link>
        </div>

        {subjectCards.length === 0 ? (
          <div className="studi-panel px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Create a subject to organize topics and materials.
            </p>
            <Link
              href="/subjects"
              className={cn(buttonVariants(), "mt-4 inline-flex")}
            >
              Add a subject
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjectCards.map(({ subject, summary }) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                topicCount={summary.total}
                masteredCount={summary.mastered}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {laterModules.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="studi-panel group p-5 transition-colors hover:bg-card"
          >
            <item.icon
              className="mb-4 size-5 text-primary transition-transform group-hover:-translate-y-0.5"
              aria-hidden
            />
            <h3 className="font-display text-xl tracking-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.copy}
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Coming later
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
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
