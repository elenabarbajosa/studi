"use client";

import Link from "next/link";
import { ArrowLeft, Check, Cloud, Loader2 } from "lucide-react";

import {
  SETTINGS_SECTION_META,
  settingsHref,
  type SettingsSection,
} from "@/components/settings/settings-nav";
import type { SaveStatus } from "@/components/settings/use-autosave";
import { cn } from "@/lib/utils";

export function SettingsSaveBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] font-medium",
        status === "error" ? "text-danger" : "text-ink-2",
      )}
      role="status"
      aria-live="polite"
    >
      {status === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          Saving…
        </>
      ) : status === "saved" ? (
        <>
          <Check className="size-3.5 text-success" aria-hidden />
          Saved
        </>
      ) : (
        "Couldn’t save"
      )}
    </span>
  );
}

export function SettingsShell({
  section,
  saveStatus = "idle",
  children,
}: {
  section: SettingsSection;
  saveStatus?: SaveStatus;
  children: React.ReactNode;
}) {
  const meta = SETTINGS_SECTION_META.find((s) => s.id === section)!;

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-5 md:gap-6">
      <div className="hidden flex-wrap items-end justify-between gap-3 min-[960px]:flex">
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink">
          Settings
        </h1>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-3">
          {saveStatus === "idle" ? (
            <>
              <Cloud className="size-3.5" aria-hidden />
              Changes save automatically
            </>
          ) : (
            <SettingsSaveBadge status={saveStatus} />
          )}
        </span>
      </div>

      <div className="grid items-start gap-5 min-[960px]:grid-cols-[220px_minmax(0,1fr)] min-[960px]:gap-8">
        <aside className="sticky top-4 hidden min-[960px]:block">
          <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-1.5 rounded-md px-2.5 text-[13.5px] font-medium text-ink-2 outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to app
            </Link>
            {SETTINGS_SECTION_META.map((item) => {
              const Icon = item.icon;
              const active = item.id === section;
              return (
                <Link
                  key={item.id}
                  href={settingsHref(item.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-[14px] outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                    active
                      ? "bg-raised font-semibold text-ink shadow-[0_0_0_1px_var(--hairline)]"
                      : "font-medium text-ink-2 hover:bg-hover hover:text-ink",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-accent-text" : "text-ink-3",
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-2 min-[960px]:hidden">
            <div>
              <Link
                href="/settings"
                className="mb-1 inline-flex items-center gap-1 text-[13.5px] font-medium text-ink-2 outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)]"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                All settings
              </Link>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
                {meta.label}
              </h2>
              <p className="text-[13.5px] text-ink-2">{meta.description}</p>
            </div>
            <SettingsSaveBadge status={saveStatus} />
          </div>

          <div className="hidden min-[960px]:block">
            <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">
              {meta.label}
            </h2>
            <p className="mt-1 text-[14px] text-ink-2">{meta.description}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
