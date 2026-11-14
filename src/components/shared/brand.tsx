import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  /** Pass `null` for a non-linked wordmark (e.g. the landing hero). */
  href?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function Brand({
  href = "/",
  className,
  size = "md",
}: BrandProps) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl md:text-5xl",
  };

  const content = (
    <span
      className={cn(
        "font-display tracking-tight text-foreground",
        sizes[size],
        className,
      )}
    >
      studi
      <span className="text-primary">.</span>
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-baseline gap-0.5">
      {content}
      <span className="sr-only">Studi home</span>
    </Link>
  );
}
