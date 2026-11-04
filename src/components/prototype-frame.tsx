import type { ReactNode, RefObject } from 'react'
import { FRAME_HEIGHT, VIEWPORT_WIDTH } from '../lib/constants'
import type { FrameSize } from '../lib/device-frame'
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
  /**
   * A size chosen in the device toolbar. Without one the frame takes its viewport's size and
   * narrows with the window; with one it keeps the size, and the stage zooms it instead.
   */
  size?: FrameSize
  className?: string
}

/** Device shell the screen is drawn in. The overlay sits inside it, above the screen. */
export function PrototypeFrame({
  viewport,
  children,
  frameRef,
  overlay,
  inspecting,
  size,
  className,
}: PrototypeFrameProps) {
  return (
    <div
      ref={frameRef}
      data-viewport={viewport}
      style={{ width: size?.width ?? VIEWPORT_WIDTH[viewport], height: size?.height ?? FRAME_HEIGHT[viewport] }}
      className={cn(
        'relative overflow-auto overscroll-contain rounded-lg border border-border bg-background shadow-sm',
        size === undefined && 'max-w-full',
        inspecting && 'cursor-crosshair',
        className
      )}
    >
      {children}
      {overlay}
    </div>
  )
}
