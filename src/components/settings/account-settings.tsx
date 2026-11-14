"use client";

import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";

import { signOut } from "@/actions/auth";
import { softPillClass } from "@/components/studi/page-title";
import { canResumeOnboarding, onboardingLabel } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function AccountSettings({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-5">
      {canResumeOnboarding(profile) ? (
        <section className="flex flex-col gap-3 rounded-[22px] bg-accent-soft p-5 md:rounded-[26px] md:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-accent-text">
              <Sparkles className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-ink">Setup wizard</h3>
              <p className="mt-0.5 text-[13.5px] text-ink-2">
                Status: {onboardingLabel(profile.onboarding_status)}. Resume anytime to
                finish personalizing Studi.
              </p>
            </div>
          </div>
          <Link
            href="/onboarding?resume=1"
            className={cn(softPillClass, "w-fit bg-raised")}
          >
            Resume onboarding
          </Link>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-[22px] bg-sunken p-5 md:rounded-[26px] md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-raised text-ink">
            <LogOut className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-ink">Sign out</h3>
            <p className="mt-0.5 text-[13.5px] text-ink-2">
              Signs you out on this device. Your private data stays in your account.
            </p>
          </div>
        </div>
        <form action={signOut}>
          <button type="submit" className={cn(softPillClass, "w-fit bg-raised")}>
            Sign out
          </button>
        </form>
      </section>

      <p className="text-[12.5px] text-ink-3">
        Signed in as @{profile.username}
        {profile.display_name ? ` · ${profile.display_name}` : ""}.
      </p>
    </div>
  );
}
