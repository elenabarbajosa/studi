import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[var(--radius-md)] border border-transparent bg-sunken px-3.5 py-3 text-base text-ink transition-colors duration-200 ease-studi outline-none placeholder:text-ink-3 focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_1.5px_var(--danger)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
