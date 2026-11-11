import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeSync } from "@/components/theme/theme-sync";
import type { Profile } from "@/types/database";

type AppShellProps = {
  profile: Profile;
  children: React.ReactNode;
};

export function AppShell({ profile, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh w-full">
      <ThemeSync
        appearance={profile.appearance}
        accent={profile.accent_color}
      />
      <AppSidebar profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav profile={profile} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
