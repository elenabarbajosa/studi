"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  getAriaValueText,
  ...props
}: SliderPrimitive.Root.Props & {
  getAriaValueText?: (
    formattedValue: string,
    value: number,
    index: number
  ) => string
}) {
  const values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min]

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      thumbAlignment="edge"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn("w-full data-vertical:h-full", className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full touch-none items-center py-2 select-none data-vertical:h-full data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track className="relative grow rounded-full bg-sunken data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5">
          <SliderPrimitive.Indicator className="absolute bg-accent-ink data-horizontal:h-full data-vertical:w-full" />
          {values.map((_, index) => (
            <SliderPrimitive.Thumb
              key={index}
              index={index}
              getAriaValueText={getAriaValueText}
              className="block size-5 shrink-0 rounded-full border-2 border-accent-ink bg-raised shadow-card outline-none has-focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:pointer-events-none disabled:opacity-50 [&_input]:outline-none"
            />
          ))}
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
