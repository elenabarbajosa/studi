"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { CornerDownLeft, Search, UserRound } from "lucide-react";

import { useShell } from "@/components/layout/shell-provider";
import { allNavItems, focusNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type CommandItem = {
  id: string;
  title: string;
  hint: string;
  href: string;
  icon: NavItem["icon"];
  keywords: string[];
};

type CommandSection = { label: string; items: CommandItem[] };

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matches(item: CommandItem, query: string) {
  if (!query) return true;
  const haystack = normalize(
    [item.title, item.hint, ...item.keywords].join(" "),
  );
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function CommandMenu() {
  const router = useRouter();
  const { commandOpen, setCommandOpen, profile } = useShell();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();

  const sections = React.useMemo<CommandSection[]>(() => {
    const actions: CommandItem[] = [
      {
        id: "start-focus",
        title: "Start focus",
        hint: "Open the Focus timer",
        href: focusNav.href,
        icon: focusNav.icon,
        keywords: ["pomodoro", "timer", "session"],
      },
      {
        id: "profile",
        title: "View your profile",
        hint: `@${profile.username}`,
        href: `/u/${profile.username}`,
        icon: UserRound,
        keywords: ["me", "public", "account"],
      },
    ];
    const destinations: CommandItem[] = allNavItems.map((item) => ({
      id: item.href,
      title: item.title,
      hint: item.description,
      href: item.href,
      icon: item.icon,
      keywords: item.keywords ?? [],
    }));

    return [
      { label: "Jump to", items: destinations.filter((i) => matches(i, query)) },
      { label: "Actions", items: actions.filter((i) => matches(i, query)) },
    ].filter((section) => section.items.length > 0);
  }, [profile.username, query]);

  const flat = sections.flatMap((section) => section.items);
  const active = flat[Math.min(activeIndex, flat.length - 1)];

  function handleOpenChange(open: boolean) {
    setCommandOpen(open);
    if (!open) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function select(item: CommandItem | undefined) {
    if (!item) return;
    handleOpenChange(false);
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(active);
    }
  }

  React.useEffect(() => {
    if (!active) return;
    listRef.current
      ?.querySelector(`[data-command-id="${CSS.escape(active.id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <DialogPrimitive.Root open={commandOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[rgba(36,28,31,0.32)] duration-200 ease-studi data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          aria-label="Search and jump to"
          className="fixed top-[max(12px,env(safe-area-inset-top))] left-1/2 z-50 flex max-h-[min(560px,calc(100svh-24px))] w-[calc(100%-24px)] max-w-[560px] -translate-x-1/2 flex-col overflow-hidden rounded-[var(--radius-lg)] bg-raised text-ink shadow-pop outline-none duration-200 ease-studi data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] md:top-[14vh]"
        >
          <DialogPrimitive.Title className="sr-only">
            Search and jump to
          </DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-hairline px-4">
            <Search aria-hidden className="size-[18px] shrink-0 text-ink-3" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search pages and actions…"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 md:text-[15px]"
            />
            <kbd className="hidden rounded-[6px] bg-sunken px-1.5 py-0.5 font-sans text-xs font-medium text-ink-3 md:inline">
              Esc
            </kbd>
          </div>

          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          >
            {flat.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-2">
                No pages match “{query}”.
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.label} role="group" aria-label={section.label}>
                  <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-ink-3">
                    {section.label}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === active?.id;
                    return (
                      <div
                        key={item.id}
                        id={`${listId}-${item.id}`}
                        data-command-id={item.id}
                        role="option"
                        aria-selected={isActive}
                        onMouseMove={() => setActiveIndex(flat.indexOf(item))}
                        onClick={() => select(item)}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 md:min-h-10",
                          isActive && "bg-hover",
                        )}
                      >
                        <Icon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-accent-text" : "text-ink-3",
                          )}
                        />
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-sm font-medium">
                            {item.title}
                          </span>
                          <span className="truncate text-xs text-ink-2">
                            {item.hint}
                          </span>
                        </span>
                        {isActive ? (
                          <CornerDownLeft
                            aria-hidden
                            className="size-3.5 shrink-0 text-ink-3"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
