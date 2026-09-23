import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "./utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-clip-padding px-2 font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary",
        light:
          "bg-primary-subtle text-primary hover:bg-primary-subtle-hover aria-expanded:bg-primary-subtle",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghostPrimary:
          "hover:bg-primary-subtle-hover hover:text-foreground aria-expanded:bg-primary-subtle-hover aria-expanded:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-6 in-data-[slot=button-group]:rounded-lg text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 in-data-[slot=button-group]:rounded-lg px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9 gap-0 p-0",
        "icon-xs":
          "size-6 gap-0 in-data-[slot=button-group]:rounded-lg p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 gap-0 in-data-[slot=button-group]:rounded-lg p-0",
        "icon-lg": "size-11 gap-0 p-0",
      },
      width: {
        auto: "",
        full: "w-full",
        fit: "w-fit",
        form: "w-full max-w-(--form-button-max-width)",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      width: "auto",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  width = "auto",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-width={width}
      className={cn(buttonVariants({ variant, size, width, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
