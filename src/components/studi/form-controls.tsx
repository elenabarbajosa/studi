"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function FieldLabel({
  htmlFor,
  children,
  optional,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-ink-2", className)}
    >
      {children}
      {optional ? <span className="text-xs font-normal text-ink-3">Optional</span> : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <FieldLabel htmlFor={htmlFor} optional={optional}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

/** Native select in the input style, so mobile keeps the system picker. */
export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        className="h-11 w-full min-w-0 appearance-none truncate rounded-[var(--radius-md)] border border-transparent bg-sunken pr-9 pl-3.5 text-base text-ink outline-none transition-colors duration-200 ease-studi focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-50 md:h-10 md:text-sm"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}

/**
 * Progressive disclosure that keeps its fields in the form while closed,
 * so editing never drops saved values.
 */
export function MoreOptions({
  label = "More options",
  defaultOpen,
  children,
}: {
  label?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group/more">
      <summary className="flex h-9 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-1 text-[13.5px] font-medium text-ink-2 outline-none select-none hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="size-4 -rotate-90 transition-transform duration-200 group-open/more:rotate-0"
          aria-hidden
        />
        {label}
      </summary>
      <div className="flex flex-col gap-4 pt-3">{children}</div>
    </details>
  );
}

export function SwitchRow({
  name,
  label,
  checked,
  defaultChecked,
  onChange,
}: {
  name?: string;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] bg-sunken px-3.5 text-[14px] text-ink">
      {label}
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-[26px] w-[44px] shrink-0 rounded-full bg-ink-4 transition-colors duration-200 peer-checked:bg-primary peer-focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:after:translate-x-[18px] dark:peer-checked:bg-accent"
      />
    </label>
  );
}

export function PrimaryActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 pt-1", className)}>{children}</div>
  );
}
