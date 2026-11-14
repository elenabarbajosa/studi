"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

import {
  SETTINGS_SECTION_META,
  settingsHref,
} from "@/components/settings/settings-nav";

/** Mobile category list. On desktop viewports, replace with Profile. */
export function SettingsIndex() {
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    function go() {
      if (mq.matches) router.replace("/settings/profile");
    }
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [router]);

  return (
    <div className="flex flex-col gap-5 min-[960px]:hidden">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1 rounded-md text-[13.5px] font-medium text-ink-2 outline-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink">
          Settings
        </h1>
        <p className="text-[14px] text-ink-2">
          Profile, appearance, study rhythm, and privacy.
        </p>
      </div>

      <nav aria-label="Settings categories" className="flex flex-col gap-1.5">
        {SETTINGS_SECTION_META.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={settingsHref(item.id)}
              className="flex items-center gap-3 rounded-[18px] bg-raised px-4 py-3.5 shadow-[0_0_0_1px_var(--hairline)] outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">
                  {item.label}
                </span>
                <span className="block truncate text-[12.5px] text-ink-3">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
