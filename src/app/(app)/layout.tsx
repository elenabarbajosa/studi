import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export const instant = false;

async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center p-8">
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      }
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
