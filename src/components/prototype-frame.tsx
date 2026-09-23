import type { ReactNode, RefObject } from 'react'
import { FRAME_HEIGHT, VIEWPORT_WIDTH } from '../lib/constants'
import type { ScreenViewport } from '../types'
import { cn } from '../ui'

export interface PrototypeFrameProps {
  viewport: ScreenViewport
  children: ReactNode
  /** The overlay measures against this element, so it is both the ref target and the offset parent. */
  frameRef: RefObject<HTMLDivElement | null>
  overlay?: ReactNode
  /** Marks the screen as pickable, so the pointer says the next click selects rather than navigates. */
  inspecting?: boolean
  className?: string
}

/** Device shell the screen is drawn in. The overlay sits inside it, above the screen. */
export function PrototypeFrame({ viewport, children, frameRef, overlay, inspecting, className }: PrototypeFrameProps) {
  return (
    <div
      ref={frameRef}
      data-viewport={viewport}
      style={{ width: VIEWPORT_WIDTH[viewport], height: FRAME_HEIGHT[viewport] }}
      className={cn(
        'relative max-w-full overflow-auto rounded-lg border border-border bg-background shadow-sm',
        inspecting && 'cursor-crosshair',
        className
      )}
    >
      {children}
      {overlay}
    </div>
  )
}
