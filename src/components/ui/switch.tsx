"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "cn"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-studi outline-none after:absolute after:-inset-x-3 after:-inset-y-[9px] focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] aria-invalid:shadow-[0_0_0_1.5px_var(--danger)] data-[size=default]:h-[26px] data-[size=default]:w-11 data-[size=default]:p-[3px] data-[size=sm]:h-5 data-[size=sm]:w-8 data-[size=sm]:p-0.5 data-checked:bg-accent-ink data-unchecked:bg-hairline data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-studi group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-3.5 group-data-[size=default]/switch:data-checked:translate-x-[18px] group-data-[size=sm]/switch:data-checked:translate-x-[14px] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
