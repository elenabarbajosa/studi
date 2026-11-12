"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/shared/brand";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import { buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { bottomNav, mainNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type AppSidebarProps = {
  profile: Profile;
  avatarSrc: string | null;
};

function NavLink({
  href,
  title,
  icon: Icon,
  comingSoon,
}: {
  href: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{title}</span>
      {comingSoon ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      ) : null}
    </Link>
  );
}

export function AppSidebar({ profile, avatarSrc }: AppSidebarProps) {
  return (
    <aside className="hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center px-5">
        <Brand href="/dashboard" size="sm" />
      </div>

      <ScrollArea className="flex-1 px-3 pb-4">
        <nav className="space-y-1" aria-label="Main">
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <Separator className="my-4" />

        <nav className="space-y-1" aria-label="Account">
          {bottomNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-4">
        <Link
          href="/settings"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-auto w-full justify-start gap-3 px-2 py-2",
          )}
        >
          <StudiAvatar profile={profile} src={avatarSrc} size="md" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">
              {profile.display_name || profile.username}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              @{profile.username}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
