import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Focus,
  Handshake,
  Settings,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Dashboard",
};

const upcoming = [
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    copy: "Deadlines and academic events will land here.",
  },
  {
    title: "Subjects",
    href: "/subjects",
    icon: BookOpen,
    copy: "Organize courses, notes, and materials.",
  },
  {
    title: "Study Planner",
    href: "/planner",
    icon: ClipboardList,
    copy: "Build weekly study plans without clutter.",
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

export default async function DashboardPage() {
  const { profile } = await requireProfile();
  const name = profile.display_name || profile.username;

  return (
    <div>
      <PageHeader
        title={`Hello, ${name}`}
        description="Your workspace is ready. Features below are scaffolded with empty states until later phases."
        actions={
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Settings className="size-4" aria-hidden />
            Preferences
          </Link>
        }
      />

      <section className="studi-panel mb-6 p-6 sm:p-8">
        <p className="text-sm font-medium text-primary">Phase 1 complete</p>
        <h2 className="mt-2 font-display text-2xl tracking-tight md:text-3xl">
          Account, themes, and private profiles are live.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          No simulated study stats or placeholder charts — only real setup.
          Customize your accent in Settings, then explore the navigation as
          each module arrives.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((item) => (
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
              Empty state ready
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
