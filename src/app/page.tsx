import Link from "next/link";
import { ArrowRight, BookMarked, Sparkles, UsersRound } from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div className="studi-grain pointer-events-none absolute inset-0 opacity-60" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Brand size="md" />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants())}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-20 pt-8 md:pt-4">
        <div className="pointer-events-none absolute right-[8%] top-[18%] size-48 rounded-full bg-brand-soft blur-3xl animate-soft-pulse md:size-72" />
        <div className="max-w-3xl animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden />
            Phase 1 foundation
          </p>
          <h1 className="font-display text-balance text-5xl leading-[1.05] tracking-tight text-foreground md:text-7xl">
            studi
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
            A quiet academic workspace for planning, focus, and studying with
            friends — built for university life, not generic productivity noise.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-up-delay">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              Create your workspace
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Sign in
            </Link>
          </div>
          {!configured ? (
            <p className="mt-6 max-w-lg rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
              Local preview is ready. Add your Supabase keys from{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                .env.example
              </code>{" "}
              to enable authentication.
            </p>
          ) : null}
        </div>

        <div className="relative mt-16 grid gap-4 animate-fade-up-delay-2 md:grid-cols-3">
          {[
            {
              icon: BookMarked,
              title: "Academic clarity",
              body: "Subjects, planners, and calendars shaped for coursework — arriving after the foundation.",
            },
            {
              icon: Sparkles,
              title: "Deep focus",
              body: "Pomodoro sessions and quiet statistics without fake dashboards or invented streaks.",
            },
            {
              icon: UsersRound,
              title: "Study together",
              body: "Friends, rooms, and challenges — private by default, social when you choose.",
            },
          ].map((item) => (
            <div key={item.title} className="studi-panel p-5">
              <item.icon className="mb-4 size-5 text-primary" aria-hidden />
              <h2 className="font-display text-xl tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
