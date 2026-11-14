"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, Play, Search } from "lucide-react";

import { useShell } from "@/components/layout/shell-provider";
import { StudiAvatar } from "@/components/shared/studi-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  focusNav,
  isActivePath,
  navGroups,
  settingsNav,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:shadow-[0_0_0_2px_var(--chrome),0_0_0_4px_var(--accent)]";

function RailTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: React.ReactElement;
}) {
  return (
    <Tooltip disabled={!enabled}>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarLink({
  item,
  active,
  compact,
  shortcut,
}: {
  item: NavItem;
  active: boolean;
  compact: boolean;
  shortcut?: string;
}) {
  const Icon = item.icon;

  return (
    <RailTooltip label={item.title} enabled={compact}>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 shrink-0 items-center gap-2.5 overflow-hidden rounded-[10px] px-[11px] text-sm whitespace-nowrap transition-colors duration-150",
          focusRing,
          active
            ? "bg-canvas font-semibold text-ink shadow-[0_1px_2px_rgba(60,30,40,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
            : "font-medium text-ink-2 hover:bg-hover hover:text-ink",
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            active ? "text-accent-text" : "text-ink-3",
          )}
        />
        <span className="min-w-0 flex-1 truncate sidebar-compact:sr-only">
          {item.title}
        </span>
        {item.comingSoon ? (
          <span className="rounded-[6px] bg-hover px-1.5 text-xs leading-5 font-semibold text-ink-2 sidebar-compact:hidden">
            Soon
          </span>
        ) : null}
        {shortcut ? (
          <kbd className="font-sans text-xs text-ink-3 sidebar-compact:hidden">
            {shortcut}
          </kbd>
        ) : null}
      </Link>
    </RailTooltip>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const {
    profile,
    avatarSrc,
    collapsed,
    overlayOpen,
    isWide,
    toggleSidebar,
    closeOverlay,
    setCommandOpen,
  } = useShell();
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const compact = isWide ? collapsed : !overlayOpen;

  React.useEffect(() => {
    if (!overlayOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeOverlay();
        toggleRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, closeOverlay]);

  const toggleLabel = isWide
    ? collapsed
      ? "Expand sidebar"
      : "Collapse sidebar"
    : overlayOpen
      ? "Close sidebar"
      : "Expand sidebar";

  const displayName = profile.display_name || profile.username;

  return (
    <div
      data-sidebar-collapsed={collapsed}
      data-sidebar-overlay={overlayOpen}
      className="relative hidden w-[68px] shrink-0 transition-[width] duration-[220ms] ease-studi motion-reduce:transition-none md:block min-[1100px]:w-[228px] sidebar-compact:w-[68px]"
    >
      {overlayOpen ? (
        <div
          aria-hidden
          onClick={closeOverlay}
          className="fixed inset-0 z-40 bg-[rgba(23,19,21,0.18)] min-[1100px]:hidden"
        />
      ) : null}

      <aside
        aria-label="Sidebar"
        className={cn(
          "sticky top-0 flex h-svh w-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-3 pt-5 pb-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          overlayOpen &&
            "max-[1099px]:fixed max-[1099px]:left-0 max-[1099px]:z-50 max-[1099px]:w-[228px] max-[1099px]:bg-chrome max-[1099px]:shadow-[0_24px_60px_-10px_rgba(23,19,21,0.35)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-[18px] sidebar-compact:flex-col sidebar-compact:px-0">
          <Link
            href="/dashboard"
            className={cn(
              "rounded-[8px] text-2xl leading-none font-semibold tracking-[-0.045em] whitespace-nowrap text-ink",
              focusRing,
            )}
          >
            <span className="sidebar-compact:hidden">studi</span>
            <span aria-hidden className="hidden sidebar-compact:inline">
              s
            </span>
            <span aria-hidden className="text-accent">
              .
            </span>
            <span className="sr-only">Studi home</span>
          </Link>
          <div className="flex items-center gap-0.5 sidebar-compact:flex-col">
            <RailTooltip label="Search (⌘K)" enabled={compact}>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Search and jump to (⌘K)"
                title={compact ? undefined : "Search (⌘K)"}
                className={cn(
                  "flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-hover hover:text-ink",
                  focusRing,
                )}
              >
                <Search aria-hidden className="size-4" />
              </button>
            </RailTooltip>
            <RailTooltip label={`${toggleLabel} (⌘\\)`} enabled={compact}>
              <button
                ref={toggleRef}
                type="button"
                onClick={toggleSidebar}
                aria-label={toggleLabel}
                aria-expanded={!compact}
                title={compact ? undefined : `${toggleLabel} (⌘\\)`}
                className={cn(
                  "flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-hover hover:text-ink",
                  focusRing,
                )}
              >
                <PanelLeft aria-hidden className="size-4" />
              </button>
            </RailTooltip>
          </div>
        </div>

        <RailTooltip label="Start focus" enabled={compact}>
          <Link
            href={focusNav.href}
            className={cn(
              "mb-[18px] flex h-[38px] shrink-0 items-center gap-2.5 overflow-hidden rounded-[12px] bg-primary px-[11px] text-sm font-semibold whitespace-nowrap text-primary-foreground transition-colors hover:bg-accent-ink-hover dark:bg-accent dark:text-ink-on-accent dark:hover:brightness-95",
              focusRing,
            )}
          >
            <Play aria-hidden className="size-[15px] shrink-0" />
            <span className="sidebar-compact:sr-only">Start focus</span>
          </Link>
        </RailTooltip>

        <nav aria-label="Main" className="flex flex-col">
          {navGroups.map((group, index) => (
            <div
              key={group.label ?? index}
              className="mb-3.5 flex flex-col gap-px"
            >
              {group.label ? (
                <div className="h-5 overflow-hidden px-2.5 pb-[5px] text-xs font-medium whitespace-nowrap text-ink-3 sidebar-compact:h-1.5 sidebar-compact:pb-0">
                  <span className="sidebar-compact:sr-only">{group.label}</span>
                </div>
              ) : null}
              {group.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  compact={compact}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-2">
          <SidebarLink
            item={settingsNav}
            active={isActivePath(pathname, settingsNav.href)}
            compact={compact}
            shortcut="⌘,"
          />
          <RailTooltip label={displayName} enabled={compact}>
            <Link
              href={`/u/${profile.username}`}
              aria-current={
                isActivePath(pathname, `/u/${profile.username}`)
                  ? "page"
                  : undefined
              }
              className={cn(
                "flex items-center gap-2.5 overflow-hidden rounded-[10px] px-1.5 py-2 transition-colors hover:bg-hover sidebar-compact:justify-center sidebar-compact:px-0",
                focusRing,
              )}
            >
              <StudiAvatar
                profile={profile}
                src={avatarSrc}
                size={32}
                className="shrink-0"
              />
              <span className="flex min-w-0 flex-col leading-tight sidebar-compact:sr-only">
                <span className="truncate text-[13.5px] font-semibold text-ink">
                  {displayName}
                </span>
                <span className="truncate text-xs text-ink-2">
                  @{profile.username}
                </span>
              </span>
            </Link>
          </RailTooltip>
        </div>
      </aside>
    </div>
  );
}
