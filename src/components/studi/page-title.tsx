import { cn } from "@/lib/utils";

/** Page title row: 30px title (28px on phones), optional subtitle, trailing actions. */
export function PageTitle({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink md:text-[30px]">
          {title}
        </h1>
        {subtitle ? <p className="text-[14px] text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Pill primary action in the toolbar, matching the "New" button in the handoff. */
export const primaryPillClass =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground outline-none transition-colors duration-200 ease-studi hover:bg-accent-ink-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-9 dark:bg-accent dark:text-ink-on-accent dark:hover:bg-[color-mix(in_srgb,var(--accent)_86%,var(--chrome))]";

export const softPillClass =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-[13.5px] font-semibold text-ink outline-none transition-colors duration-200 ease-studi hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-8";

export const iconPillClass =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink outline-none transition-colors duration-200 ease-studi hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50 md:size-8";
