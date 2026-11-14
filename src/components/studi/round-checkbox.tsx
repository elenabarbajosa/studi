"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Round checkbox with a 42px hit area around a 20–24px visual. */
export function RoundCheckbox({
  checked,
  onToggle,
  label,
  size = "md",
  disabled,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "group/check -m-2.5 flex size-[42px] shrink-0 items-center justify-center rounded-full outline-none disabled:opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-[1.8px] transition-colors duration-200 group-focus-visible/check:ring-2 group-focus-visible/check:ring-ring group-focus-visible/check:ring-offset-2 group-focus-visible/check:ring-offset-raised",
          size === "lg" ? "size-6" : size === "md" ? "size-[22px]" : "size-[18px]",
          checked
            ? "border-primary bg-primary text-primary-foreground dark:border-accent dark:bg-accent dark:text-ink-on-accent"
            : "border-ink-4 group-hover/check:border-ink-3",
        )}
      >
        {checked ? (
          <Check className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={3} aria-hidden />
        ) : null}
      </span>
    </button>
  );
}
