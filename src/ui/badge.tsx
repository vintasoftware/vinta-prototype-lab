import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "./utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg border border-transparent px-2 py-0.5 font-semibold text-xs transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Filled (back-compat)
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary-hover",
        // Subtle status intents (bg-{role}-subtle + status text)
        neutral: "bg-muted text-muted-foreground [a]:hover:bg-accent",
        primary: "bg-primary-subtle text-primary [a]:hover:bg-primary-subtle-hover",
        info: "bg-info-subtle text-info [a]:hover:bg-secondary-subtle-hover",
        success:
          "bg-success-subtle text-success [a]:hover:bg-success-subtle-hover",
        warning:
          "bg-warning-subtle text-warning [a]:hover:bg-warning-subtle-hover",
        severe:
          "bg-severe-subtle text-severe [a]:hover:bg-severe-subtle-hover",
        danger:
          "bg-destructive-subtle text-destructive [a]:hover:bg-destructive-subtle-hover",
        destructive:
          "bg-destructive-subtle text-destructive [a]:hover:bg-destructive-subtle-hover",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
