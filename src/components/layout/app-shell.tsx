import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandMenu } from "@/components/layout/command-menu";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { ShellProvider } from "@/components/layout/shell-provider";
import { ThemeSync } from "@/components/theme/theme-sync";
import type { Profile } from "@/types/database";

type AppShellProps = {
  profile: Profile;
  avatarSrc: string | null;
  sidebarCollapsed: boolean;
  children: React.ReactNode;
};

export function AppShell({
  profile,
  avatarSrc,
  sidebarCollapsed,
  children,
}: AppShellProps) {
  return (
    <ShellProvider
      profile={profile}
      avatarSrc={avatarSrc}
      defaultCollapsed={sidebarCollapsed}
    >
      <ThemeSync
        appearance={profile.appearance}
        accent={profile.accent_color}
      />
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-full bg-raised px-4 py-2 text-sm font-medium text-ink shadow-pop focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="flex min-h-svh w-full bg-chrome">
        <AppSidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-svh min-w-0 flex-1 bg-canvas pb-[calc(88px+env(safe-area-inset-bottom))] outline-none md:my-2.5 md:mr-2.5 md:min-h-[calc(100svh-20px)] md:rounded-[18px] md:pb-0 md:shadow-card"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 pt-[max(18px,env(safe-area-inset-top))] pb-6 sm:px-5 md:px-7 md:py-7 min-[1280px]:px-8">
            {children}
          </div>
        </main>
      </div>
      <MobileTabBar />
      <CommandMenu />
    </ShellProvider>
  );
}
