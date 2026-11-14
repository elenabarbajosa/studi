"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, MORE_HREF, mobileTabs } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileTabBar() {
  const pathname = usePathname();
  const inPrimaryTab = mobileTabs.some(
    (tab) => tab.href !== MORE_HREF && isActivePath(pathname, tab.href),
  );

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(76px+env(safe-area-inset-bottom))] justify-around border-t border-hairline bg-canvas px-2 pt-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobileTabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.primary
          ? isActivePath(pathname, tab.href)
          : tab.href === MORE_HREF
            ? !inPrimaryTab
            : isActivePath(pathname, tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[52px] max-w-16 min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] outline-none focus-visible:shadow-[0_0_0_2px_var(--canvas),0_0_0_4px_var(--accent)]",
              active || tab.primary ? "text-accent-text" : "text-ink-3",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full",
                tab.primary
                  ? "-mt-4 size-[50px] bg-primary text-primary-foreground shadow-cta dark:bg-accent dark:text-ink-on-accent"
                  : "size-[30px]",
              )}
            >
              <Icon
                aria-hidden
                className={tab.primary ? "size-5 fill-current" : "size-[22px]"}
              />
            </span>
            <span className="text-xs leading-none font-semibold">
              {tab.title}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
