import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  hint?: string;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  hint = "Coming in a later phase",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "studi-panel flex min-h-[22rem] flex-col items-center justify-center px-8 py-14 text-center",
        className,
      )}
    >
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="font-display text-2xl tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <p className="mt-5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}
