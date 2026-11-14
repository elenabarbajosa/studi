import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-transparent bg-sunken px-3.5 text-base text-ink transition-colors duration-200 ease-studi outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-3 focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_1.5px_var(--danger)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
