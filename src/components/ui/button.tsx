import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-studi outline-none select-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] active:brightness-[0.97] disabled:pointer-events-none disabled:text-ink-3 disabled:opacity-100 disabled:shadow-none aria-invalid:shadow-[0_0_0_1.5px_var(--danger)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-primary-foreground hover:bg-accent-ink-hover disabled:bg-sunken dark:bg-accent dark:text-ink-on-accent dark:hover:bg-[color-mix(in_srgb,var(--accent)_86%,var(--chrome))] dark:disabled:bg-sunken dark:disabled:text-ink-3",
        outline:
          "border-hairline bg-raised text-ink hover:bg-hover aria-expanded:bg-hover disabled:bg-sunken",
        secondary:
          "bg-sunken text-ink hover:bg-hover aria-expanded:bg-hover disabled:bg-sunken",
        ghost:
          "bg-transparent hover:bg-hover hover:text-ink aria-expanded:bg-hover disabled:bg-transparent",
        destructive:
          "bg-danger-soft font-semibold text-danger hover:bg-[color-mix(in_srgb,var(--danger)_14%,var(--danger-soft))] focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--danger)] disabled:bg-sunken",
        link: "bg-transparent text-accent-text underline-offset-4 hover:text-accent-ink-hover hover:underline disabled:bg-transparent dark:hover:text-ink",
      },
      size: {
        default: "h-11 gap-1.5 px-[18px] md:h-10",
        xs: "h-8 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-3 text-[13px] md:h-8 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 md:h-11",
        icon: "size-11 md:size-10",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 md:size-8",
        "icon-lg": "size-12 md:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
