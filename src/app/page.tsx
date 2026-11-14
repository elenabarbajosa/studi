import Link from "next/link";

import { Brand } from "@/components/shared/brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-chrome">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_520px_at_50%_-8%,color-mix(in_srgb,var(--accent-soft)_90%,transparent),transparent),radial-gradient(720px_420px_at_80%_110%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent)]"
      />
      <div className="studi-grain pointer-events-none absolute inset-0 opacity-40" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pt-[max(28px,env(safe-area-inset-top))] pb-[max(36px,env(safe-area-inset-bottom))]">
        <div className="animate-fade-up flex w-full max-w-[400px] flex-col items-center text-center md:max-w-[460px]">
          <Brand
            href={null}
            size="lg"
            className="text-[32px] leading-none md:text-[42px]"
          />

          <h1 className="mt-7 text-balance text-[26px] leading-[1.15] font-semibold tracking-[-0.035em] text-ink md:mt-9 md:text-[34px]">
            Your space to study better.
          </h1>

          <p className="mt-3 max-w-[34ch] text-pretty text-[15px] leading-relaxed text-ink-2 md:mt-4 md:max-w-[38ch] md:text-[16px]">
            Plan your studies, stay focused, and make progress — all in one
            place.
          </p>

          <div className="animate-fade-up-delay mt-9 flex w-full flex-col items-center gap-5 md:mt-11">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 min-h-11 w-full max-w-[260px] justify-center px-8 shadow-[var(--shadow-cta)] md:w-auto md:min-w-[180px]",
              )}
            >
              Get started
            </Link>

            <p className="text-[14px] text-ink-2">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-accent-text underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
