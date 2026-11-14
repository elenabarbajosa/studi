import { cn } from "@/lib/utils";

const TILE_VARIANTS = {
  hero: "bg-accent-soft",
  data: "bg-sunken",
  list: "bg-raised shadow-[0_0_0_1px_var(--hairline)]",
  live: "bg-success-soft",
} as const;

export type TileVariant = keyof typeof TILE_VARIANTS;

/** Borderless bento surface: radius 22 on phones, 26 from tablet up. */
export function Tile({
  variant = "list",
  className,
  ...props
}: React.ComponentProps<"section"> & { variant?: TileVariant }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[22px] md:rounded-[26px]",
        TILE_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function TileHeader({
  title,
  id,
  action,
  className,
}: {
  title: React.ReactNode;
  id?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-baseline justify-between gap-3", className)}
    >
      <h2 id={id} className="type-tile text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

export const tileLinkClass =
  "rounded-md text-[13px] font-medium text-accent-text outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring";
