import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SettingsIndex } from "@/components/settings/settings-index";
import { settingsHref } from "@/components/settings/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Settings" };

async function SettingsIndexContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireProfile();
  const params = await searchParams;
  const raw = params.section;
  const section = typeof raw === "string" ? raw : undefined;
  if (section) {
    redirect(settingsHref(section as "profile"));
  }

  return <SettingsIndex />;
}

function SettingsIndexFallback() {
  return (
    <div className="flex flex-col gap-5 min-[960px]:hidden">
      <Skeleton className="h-8 w-36 rounded-xl" />
      <Skeleton className="h-4 w-64 rounded-lg" />
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}

export default function SettingsIndexPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<SettingsIndexFallback />}>
      <SettingsIndexContent {...props} />
    </Suspense>
  );
}
