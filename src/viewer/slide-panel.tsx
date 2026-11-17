import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../ui'

/** How long a panel takes to open or close, matching `duration-200` below. */
export const SLIDE_DURATION_MS = 200

export interface SlidePanelProps {
  open: boolean
  /** The side of the stage the panel sits on; it slides in from that edge. */
  side: 'left' | 'right'
  /** The panel's width as a Tailwind class, the same as the panel's own, e.g. `w-64`. */
  widthClass: string
  /**
   * Whether it slides. Off on the canvas, which redraws as the room it has changes, so a slide there
   * would stall and then jump.
   */
  animate?: boolean
  children: ReactNode
}

/**
 * Opens and closes a side panel by sliding it in from its edge while the stage makes room, so the
 * layout change reads as the panel moving rather than a jump. Closing keeps the panel drawn until
 * it is out of sight, and reopening mid-way turns it back from where it is. With reduced motion
 * it opens and closes at once.
 */
export function SlidePanel({ open, side, widthClass, animate = true, children }: SlidePanelProps) {
  const [drawn, setDrawn] = useState(open)
  // Open at its full width. A panel open from the start is drawn that way, with no slide.
  const [expanded, setExpanded] = useState(open)
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) {
      setExpanded(false)
      return
    }
    setDrawn(true)
    // The panel is laid out at no width first, so widening it is a change the browser animates.
    void box.current?.offsetWidth
    setExpanded(true)
  }, [open])

  useEffect(() => {
    if (open) {
      return
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduced || !animate) {
      setDrawn(false)
      return
    }
    const timer = setTimeout(() => setDrawn(false), SLIDE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [open, animate])

  if (!open && !drawn) {
    return null
  }

  return (
    <div
      ref={box}
      className={cn(
        'relative shrink-0 overflow-hidden transition-[width] duration-200 motion-reduce:transition-none',
        !animate && 'transition-none',
        expanded ? widthClass : 'w-0',
        open ? 'ease-out' : 'ease-in'
      )}
    >
      <div
        // A closing panel is gone for the keyboard and assistive technology at once; only the picture lingers.
        inert={!open}
        aria-hidden={open ? undefined : 'true'}
        className={cn(
          'absolute inset-y-0 flex transition-opacity duration-200 motion-reduce:transition-none',
          !animate && 'transition-none',
          side === 'left' ? 'right-0' : 'left-0',
          expanded ? 'opacity-100' : 'opacity-0',
          open ? 'ease-out' : 'ease-in'
        )}
      >
        {children}
      </div>
    </div>
  )
}
