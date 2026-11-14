"use client";

import { cn } from "@/lib/utils";

export const FOCUS_PAGE_PRESETS = [
  { id: "classic", label: "Classic", focusMinutes: 25 },
  { id: "deep", label: "Deep", focusMinutes: 45 },
  { id: "long", label: "Long", focusMinutes: 60 },
] as const;

export type FocusPagePresetId = (typeof FOCUS_PAGE_PRESETS)[number]["id"] | "custom";

export function resolveFocusPreset(focusMinutes: number): FocusPagePresetId {
  const match = FOCUS_PAGE_PRESETS.find((p) => p.focusMinutes === focusMinutes);
  return match?.id ?? "custom";
}

export function FocusPresetChips({
  focusMinutes,
  disabled,
  onSelect,
  className,
}: {
  focusMinutes: number;
  disabled?: boolean;
  onSelect: (minutes: number | "custom") => void;
  className?: string;
}) {
  const active = resolveFocusPreset(focusMinutes);

  return (
    <div
      role="group"
      aria-label="Focus duration presets"
      className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}
    >
      {FOCUS_PAGE_PRESETS.map((preset) => {
        const selected = active === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onSelect(preset.focusMinutes)}
            className={cn(
              "h-8 rounded-full px-3.5 text-[12.5px] font-semibold outline-none transition-[background-color,color,box-shadow,transform] duration-200 ease-studi disabled:opacity-50",
              "focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
              selected
                ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)] dark:bg-accent dark:text-ink-on-accent"
                : "bg-raised/80 text-ink-2 hover:bg-hover hover:text-ink dark:bg-white/10 dark:hover:bg-white/14",
            )}
          >
            {preset.label}
            <span className="ml-1.5 tabular-nums opacity-80">{preset.focusMinutes}m</span>
          </button>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active === "custom"}
        onClick={() => onSelect("custom")}
        className={cn(
          "h-8 rounded-full px-3.5 text-[12.5px] font-semibold outline-none transition-[background-color,color] duration-200 ease-studi disabled:opacity-50",
          "focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
          active === "custom"
            ? "bg-ink text-canvas dark:bg-white dark:text-ink"
            : "bg-raised/80 text-ink-2 hover:bg-hover hover:text-ink dark:bg-white/10 dark:hover:bg-white/14",
        )}
      >
        Custom
        {active === "custom" ? (
          <span className="ml-1.5 tabular-nums opacity-80">{focusMinutes}m</span>
        ) : null}
      </button>
    </div>
  );
}
