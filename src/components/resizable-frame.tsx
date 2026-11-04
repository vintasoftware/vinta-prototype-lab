import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { MAX_FRAME_SIDE, MIN_FRAME_SIDE } from '../lib/constants'
import { draggedSize, type FrameSize, nudgedSize, type ResizeAxis } from '../lib/device-frame'
import { cn } from '../ui'

export interface ResizableFrameProps {
  /** The frame's own size, in CSS pixels. */
  size: FrameSize
  /** The scale it is drawn at; the stage keeps room for the drawn size, not the own size. */
  scale: number
  /** Shown above the frame's right corner: size, device and zoom. */
  caption: string
  onResize: (size: FrameSize) => void
  /** A double click on a handle. */
  onReset: () => void
  children: ReactNode
}

const HANDLE_LABEL: Record<ResizeAxis, string> = {
  x: 'Frame width',
  y: 'Frame height',
  xy: 'Frame size',
}

const HANDLE_CLASS: Record<ResizeAxis, string> = {
  x: '-right-4 top-0 h-full w-3 cursor-ew-resize',
  y: '-bottom-4 left-0 h-3 w-full cursor-ns-resize',
  xy: '-right-4 -bottom-4 size-3.5 cursor-nwse-resize',
}

/**
 * The frame at a set size, drawn at `scale`, with handles on its right edge, bottom edge and corner
 * to drag it to any size, as in Chrome's responsive mode. Widths snap to the breakpoints, a double
 * click on a handle resets the size, and a focused handle takes the arrow keys: 10 px a press, 50
 * with Shift.
 */
export function ResizableFrame({ size, scale, caption, onResize, onReset, children }: ResizableFrameProps) {
  const sizerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  // A drag still running when the frame goes away (the screen changes, presenting starts) is ended.
  const endDrag = useRef<(() => void) | undefined>(undefined)
  useEffect(() => () => endDrag.current?.(), [])

  const startDrag = (axis: ResizeAxis) => (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.currentTarget.focus()
    const sizer = sizerRef.current
    const stage = sizer?.parentElement
    // The stage centres a frame narrower than itself, so the right edge moves half the width change.
    const centered = sizer != null && stage != null && sizer.offsetWidth < stage.clientWidth
    const origin = { x: event.clientX, y: event.clientY, size }

    // Moves are followed on the window, so the drag keeps up wherever the pointer goes.
    const move = (moveEvent: globalThis.PointerEvent) => {
      onResize(
        draggedSize({
          origin: origin.size,
          axis,
          dx: moveEvent.clientX - origin.x,
          dy: moveEvent.clientY - origin.y,
          scale,
          centered,
        })
      )
    }
    const end = () => {
      setDragging(false)
      endDrag.current = undefined
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    endDrag.current?.()
    endDrag.current = end
    setDragging(true)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const nudge = (axis: ResizeAxis) => (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nudgedSize(size, axis, event.key, event.shiftKey)
    if (next !== undefined) {
      event.preventDefault()
      onResize(next)
    }
  }

  const handle = (axis: ResizeAxis) => (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> takes no focus or value; a resize handle is a focusable separator.
    <div
      role='separator'
      tabIndex={0}
      aria-label={HANDLE_LABEL[axis]}
      aria-orientation={axis === 'y' ? 'horizontal' : 'vertical'}
      aria-valuemin={MIN_FRAME_SIDE}
      aria-valuemax={MAX_FRAME_SIDE}
      aria-valuenow={axis === 'y' ? size.height : size.width}
      aria-valuetext={
        axis === 'x'
          ? `${size.width} px wide`
          : axis === 'y'
            ? `${size.height} px tall`
            : `${size.width} × ${size.height}`
      }
      title='Drag or use the arrow keys to resize. Double-click to reset.'
      className={cn(
        'absolute flex touch-none select-none items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        HANDLE_CLASS[axis]
      )}
      onPointerDown={startDrag(axis)}
      onDoubleClick={onReset}
      onKeyDown={nudge(axis)}
    >
      {axis !== 'xy' && <span className={cn('rounded-full bg-border', axis === 'x' ? 'h-10 w-1' : 'h-1 w-10')} />}
    </div>
  )

  return (
    <div
      ref={sizerRef}
      className='relative mx-auto shrink-0'
      style={{ width: size.width * scale, height: size.height * scale }}
    >
      <p className='absolute -top-5 right-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums'>{caption}</p>
      <div
        className='origin-top-left'
        style={{ width: size.width, height: size.height, ...(scale === 1 ? {} : { transform: `scale(${scale})` }) }}
      >
        {children}
      </div>
      {handle('x')}
      {handle('y')}
      {handle('xy')}
      {/* Covers the screen while dragging, so its own hover styles and cursors stay out of the way. */}
      {dragging && <div className='absolute inset-0' />}
    </div>
  )
}
