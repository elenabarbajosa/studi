import { Suspense } from "react";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Brand } from "@/components/shared/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { getStudyPreferences, listSubjects } from "@/lib/data/subjects";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const instant = false;

export const metadata = { title: "Onboarding" };

async function ensureProfile(userId: string, email?: string | null) {
  const existing = await getCurrentProfile();
  if (existing) return existing;

  const supabase = await createClient();
  const emailLocal = email?.split("@")[0] ?? "student";
  const base = emailLocal
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 20);
  const username = base.length >= 3 ? base : `student_${userId.slice(0, 6)}`;

  await supabase.from("profiles").insert({
    id: userId,
    username,
    display_name: username,
    onboarding_status: "pending",
    onboarding_step: 1,
  });

  return (await getCurrentProfile()) as Profile | null;
}

async function OnboardingContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const resume =
    params.resume === "1" ||
    params.resume === "true" ||
    (Array.isArray(params.resume) && params.resume[0] === "1");

  const profile = await ensureProfile(user.id, user.email);
  if (!profile) {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6">
        <Brand href="/" />
        <h1 className="mt-8 font-display text-3xl tracking-tight">
          Profile unavailable
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Run the Phase 1 and Phase 2 SQL migrations in Supabase, then refresh.
        </p>
      </div>
    );
  }

  if (profile.onboarding_status === "completed" && !resume) {
    redirect("/dashboard");
  }

  const [subjects, preferences] = await Promise.all([
    listSubjects(),
    getStudyPreferences(),
  ]);

  return (
    <OnboardingWizard
      profile={profile}
      subjects={subjects}
      preferences={preferences}
    />
  );
}

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-svh max-w-3xl flex-col px-6 py-10">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-8 h-10 w-72" />
          <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <OnboardingContent searchParams={searchParams} />
    </Suspense>
  );
}
