"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
};

/** Pill segmented control on a sunken track; one option is always selected. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  stretch = false,
  disabled = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  size?: "sm" | "md";
  stretch?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex gap-0.5 rounded-full bg-sunken p-[3px]",
        stretch ? "w-full" : "w-fit",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap outline-none transition-[background-color,color,box-shadow] duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
              size === "sm" ? "h-7 px-3 text-xs" : "h-[30px] px-3.5 text-[13px]",
              stretch && "flex-1",
              disabled && !selected && "opacity-50",
              selected
                ? "bg-raised text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-hover"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {option.label}
            {option.count !== undefined ? (
              <span className="font-medium tabular-nums opacity-60">
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
