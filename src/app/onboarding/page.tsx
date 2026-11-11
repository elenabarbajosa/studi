import { redirect } from "next/navigation";

import { Brand } from "@/components/shared/brand";
import { buttonVariants } from "@/components/ui/button";
import { requireUser, getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const instant = false;

export const metadata = { title: "Finish setup" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await getCurrentProfile();
  if (existing) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const emailLocal = user.email?.split("@")[0] ?? "student";
  const base = emailLocal
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 20);
  const username = base.length >= 3 ? base : `student_${user.id.slice(0, 6)}`;

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    display_name:
      (user.user_metadata?.display_name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      username,
  });

  if (!error) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6 py-12">
      <Brand href="/" />
      <h1 className="mt-8 font-display text-3xl tracking-tight">
        We need one more step
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your account exists, but a profile row could not be created
        automatically. Make sure the Phase 1 migration has been applied in
        Supabase, then try again.
      </p>
      {error ? (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
      <Link href="/dashboard" className={cn(buttonVariants(), "mt-6 w-fit")}>
        Retry dashboard
      </Link>
    </div>
  );
}
