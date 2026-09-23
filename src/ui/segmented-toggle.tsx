import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "./utils"

/**
 * A segmented control for choosing one option from a small set (2+). The selected
 * segment gets the primary fill. Controlled via `value` / `onValueChange`.
 */

/** Corner radius per shape, shared by the segments and the sliding thumb. */
const SEGMENT_RADIUS = { default: "rounded-sm", pill: "rounded-full" } as const

/**
 * Inset for the thumb layer, which sits over the segments. It pairs with the track padding in the
 * size variant below, so both follow the same size.
 */
const THUMB_INSET = { default: "inset-1", sm: "inset-px" } as const

/**
 * Gap between segments, declared once on the track. The thumb layer lays out the same tracks and the
 * thumb steps across by one segment plus one gap, so all three read it from here.
 */
const segmentedToggleVariants = cva(
  "relative items-center gap-(--segment-gap) border border-input border-transparent bg-muted [--segment-gap:0.125rem]",
  {
    variants: {
      shape: {
        default: "rounded-md",
        pill: "rounded-full",
      },
      /**
       * Track padding, matched by THUMB_INSET. The track's transparent border adds a pixel of its
       * own, so `sm` lands on the 2rem the small buttons are; it also clips its fill to the padding
       * box, the way Button paints, so a small track and a button beside it show the same amount of
       * colour.
       */
      size: {
        default: "p-1",
        sm: "bg-clip-padding p-px",
      },
      /**
       * A sliding thumb needs equal segments to step across. Grid tracks divide the row evenly
       * whatever the labels measure, which flex does not: a flex segment never shrinks below its
       * own label, so an auto-width track leaves each one a different size.
       */
      thumb: {
        true: "inline-grid",
        false: "inline-flex w-full",
      },
    },
    defaultVariants: {
      shape: "default",
      size: "default",
      thumb: false,
    },
  }
)

const segmentedToggleItemVariants = cva(
  "relative inline-flex flex-1 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      selected: {
        true: "text-primary-foreground",
        false: "text-primary hover:text-primary-hover",
      },
      /** The segment paints its own fill. Off when the sliding thumb paints it instead. */
      filled: {
        true: "bg-primary shadow-sm",
        false: "",
      },
      shape: SEGMENT_RADIUS,
      /**
       * Segments are equal width, so every one is as wide as the longest label. `sm` pads tighter
       * to keep a three-option control the size of the buttons it sits beside.
       */
      size: {
        sm: "h-7 px-2",
        default: "h-8 px-3",
      },
    },
    defaultVariants: {
      selected: false,
      filled: false,
      shape: "default",
      size: "default",
    },
  }
)

export interface SegmentedToggleOption<T extends string = string> {
  value: T
  label: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
}

export interface SegmentedToggleProps<T extends string = string>
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  options: ReadonlyArray<SegmentedToggleOption<T>>
  value: T
  onValueChange?: (value: T) => void
  size?: VariantProps<typeof segmentedToggleItemVariants>["size"]
  shape?: VariantProps<typeof segmentedToggleVariants>["shape"]
  /**
   * Draws the fill as one pill that slides from the old segment to the new one, so the control
   * reads as one moving part. Segments are equal width, so the pill is placed from the selected
   * index alone.
   */
  thumb?: boolean
}

function SegmentedToggle<T extends string = string>({
  className,
  options,
  value,
  onValueChange,
  size,
  shape,
  thumb = false,
  style,
  ...props
}: SegmentedToggleProps<T>) {
  const selectedIndex = options.findIndex(option => option.value === value)
  // The track and the thumb layer lay out the same tracks, which is what keeps the thumb over the
  // segment it belongs to.
  const equalColumns = thumb ? `repeat(${options.length}, 1fr)` : undefined

  return (
    <div
      role="tablist"
      data-slot="segmented-toggle"
      className={cn(segmentedToggleVariants({ shape, size, thumb }), className)}
      style={{ gridTemplateColumns: equalColumns, ...style }}
      {...props}
    >
      {thumb && selectedIndex >= 0 && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute grid gap-(--segment-gap)",
            THUMB_INSET[size ?? "default"]
          )}
          style={{ gridTemplateColumns: equalColumns }}
        >
          <span
            data-slot="segmented-toggle-thumb"
            className={cn(
              "bg-primary shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none",
              SEGMENT_RADIUS[shape ?? "default"]
            )}
            style={{
              transform: `translateX(calc(${selectedIndex} * (100% + var(--segment-gap))))`,
            }}
          />
        </span>
      )}
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={option.disabled}
            data-state={selected ? "active" : "inactive"}
            onClick={() => onValueChange?.(option.value)}
            className={segmentedToggleItemVariants({
              selected,
              filled: selected && !thumb,
              shape,
              size,
            })}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedToggle, segmentedToggleItemVariants, segmentedToggleVariants }
