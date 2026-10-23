import { type ReactNode, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import { MAX_FRAME_SIDE, MIN_FRAME_SIDE } from '../lib/constants'
import { draggedSize, type FrameSize, nudgedSize, type ResizeAxis } from '../lib/device-frame'
import { cn } from '../ui'

export interface ResizableFrameProps {
  size: FrameSize
  /** How big the frame is drawn; the frame keeps its own size and is scaled to this. */
  scale: number
  /** The line above the frame's top right corner, e.g. `390 × 844 · iPhone 15 · 100%`. */
  caption: string
  onResize: (size: FrameSize) => void
  /** A double click on a handle: back to the device's own size. */
  onReset: () => void
  children: ReactNode
}

const HANDLES: readonly { axis: ResizeAxis; label: string; className: string }[] = [
  {
    axis: 'x',
    label: 'Drag to change the width',
    className: '-right-4 top-0 h-full w-3 cursor-ew-resize',
  },
  {
    axis: 'y',
    label: 'Drag to change the height',
    className: '-bottom-4 left-0 h-3 w-full cursor-ns-resize',
  },
  {
    axis: 'xy',
    label: 'Drag to change the size',
    className: '-right-4 -bottom-4 size-3.5 cursor-nwse-resize',
  },
]

/**
 * The frame at a set size, drawn at `scale`, with handles on its right edge, bottom edge and corner
 * to drag it to any size, as in Chrome's responsive mode. Widths snap to the breakpoints; a double
 * click on a handle goes back to the device's own size. A focused handle moves with the arrow keys.
 */
export function ResizableFrame({ size, scale, caption, onResize, onReset, children }: ResizableFrameProps) {
  const sizerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const startDrag = (axis: ResizeAxis) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const sizer = sizerRef.current
    const stage = sizer?.parentElement
    // The stage centers a frame narrower than itself, so that frame grows on both sides.
    const centered = sizer != null && stage != null && sizer.offsetWidth < stage.clientWidth
    const start = { x: event.clientX, y: event.clientY, size }
    setDragging(true)

    // Moves are followed on the window, so the drag keeps up wherever the pointer goes.
    const move = (moveEvent: PointerEvent) => {
      onResize(
        draggedSize({
          axis,
          start: start.size,
          dx: moveEvent.clientX - start.x,
          dy: moveEvent.clientY - start.y,
          scale,
          centered,
        })
      )
    }
    const end = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <div
      ref={sizerRef}
      className='relative mx-auto shrink-0'
      style={{ width: size.width * scale, height: size.height * scale }}
    >
      <p className='absolute -top-5 right-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums'>{caption}</p>

      <div
        className='origin-top-left'
        style={{
          width: size.width,
          height: size.height,
          ...(scale === 1 ? {} : { transform: `scale(${scale})` }),
        }}
      >
        {children}
      </div>

      {HANDLES.map(({ axis, label, className }) => (
        // A focusable separator is the ARIA pattern for a splitter a person moves; an <hr> cannot be.
        // biome-ignore lint/a11y/useSemanticElements: an <hr> takes no focus, pointer drag, or children.
        <div
          key={axis}
          role='separator'
          tabIndex={0}
          aria-label={label}
          aria-orientation={axis === 'y' ? 'horizontal' : 'vertical'}
          aria-valuenow={axis === 'y' ? size.height : size.width}
          aria-valuemin={MIN_FRAME_SIDE}
          aria-valuemax={MAX_FRAME_SIDE}
          title='Drag or use the arrow keys to resize. Double-click to reset.'
          className={cn(
            'absolute flex touch-none select-none items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
          onPointerDown={startDrag(axis)}
          onDoubleClick={onReset}
          onKeyDown={event => {
            const next = nudgedSize(size, axis, event.key, event.shiftKey)
            if (next !== undefined) {
              event.preventDefault()
              onResize(next)
            }
          }}
        >
          {axis !== 'xy' && <span className={cn('rounded-full bg-border', axis === 'x' ? 'h-10 w-1' : 'h-1 w-10')} />}
        </div>
      ))}

      {/* Over the frame while dragging, so the screen under the pointer does not take the moves. */}
      {dragging && <div className='absolute inset-0' />}
    </div>
  )
}
