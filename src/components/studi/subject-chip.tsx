"use client";

import { subjectTone, subjectToneVars, type SubjectColor } from "@/lib/subjects";
import { cn } from "@/lib/utils";

export function SubjectDot({
  color,
  className,
}: {
  color: SubjectColor | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("size-[7px] shrink-0 rounded-full", !color && "bg-ink-4", className)}
      style={color ? { background: subjectTone(color).dot } : undefined}
    />
  );
}

/** Subject identity: dot + tint + text. Static label, or a toggle when `onClick` is set. */
export function SubjectChip({
  name,
  color,
  selected,
  onClick,
  size = "md",
  className,
}: {
  name: string;
  color: SubjectColor | null;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing =
    size === "sm"
      ? "h-6 gap-1.5 pr-2.5 pl-2 text-[12.5px]"
      : "h-9 gap-1.5 pr-3 pl-2.5 text-[13.5px] md:h-8 md:text-[13px]";
  const tone = color ? (subjectToneVars(color) as React.CSSProperties) : undefined;
  const body = (
    <>
      <SubjectDot color={color} />
      <span className="truncate">{name}</span>
    </>
  );

  if (!onClick) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 items-center rounded-full font-semibold",
          color ? "subject-tone" : "bg-sunken text-ink-2",
          sizing,
          className,
        )}
        style={tone}
      >
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full min-w-0 shrink-0 items-center rounded-full font-semibold outline-none transition-[background-color,box-shadow,color] duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
        sizing,
        selected
          ? color
            ? "subject-tone shadow-[0_0_0_1.5px_var(--subject-dot)]"
            : "bg-ink text-canvas"
          : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
        className,
      )}
      style={tone}
    >
      {body}
    </button>
  );
}

/** Radio-style subject picker with a hidden input, for server-action forms. */
export function SubjectPicker({
  name,
  subjects,
  value,
  onChange,
  noneLabel = "No subject",
  className,
}: {
  name?: string;
  subjects: { id: string; name: string; color: SubjectColor }[];
  value: string;
  onChange: (id: string) => void;
  noneLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Subject">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <SubjectChip name={noneLabel} color={null} selected={value === ""} onClick={() => onChange("")} />
      {subjects.map((s) => (
        <SubjectChip
          key={s.id}
          name={s.name}
          color={s.color}
          selected={value === s.id}
          onClick={() => onChange(s.id)}
        />
      ))}
    </div>
  );
}
