import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { StudyPreferencesForm } from "@/components/settings/study-preferences-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import { resolveAvatarSrc } from "@/lib/avatar-server";
import { getStudyPreferences } from "@/lib/data/subjects";
import { canResumeOnboarding, onboardingLabel } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };

async function SettingsContent() {
  const { profile } = await requireProfile();
  const [preferences, avatarSrc] = await Promise.all([
    getStudyPreferences(),
    resolveAvatarSrc(profile),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Profile, appearance, study rhythm, and account."
      />

      <div className="space-y-8">
        <SettingsForm profile={profile} avatarSrc={avatarSrc} />
        <StudyPreferencesForm preferences={preferences} />

        {canResumeOnboarding(profile) ? (
          <section className="studi-panel p-6 sm:p-8">
            <h2 className="font-display text-2xl tracking-tight">Onboarding</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Status: {onboardingLabel(profile.onboarding_status)}. You can
              resume the setup wizard anytime.
            </p>
            <Link
              href="/onboarding?resume=1"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              Resume onboarding
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SettingsFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent />
    </Suspense>
  );
}
