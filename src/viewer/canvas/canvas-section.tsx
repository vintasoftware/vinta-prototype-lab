import { GripVertical } from 'lucide-react'
import type { KeyboardEvent, ReactNode, PointerEvent as ReactPointerEvent, Ref } from 'react'
import type { CanvasSection } from '../../lib/canvas-layout'
import { cn } from '../../ui'

/** Marks a section's handle, so a drag on it moves the section instead of panning the canvas. */
export const SECTION_HANDLE_ATTRIBUTE = 'data-section-handle'

export interface CanvasSectionBoxProps {
  section: CanvasSection
  /** Offered with the dev server behind the viewer, which saves where the section is put. */
  movable: boolean
  sectionRef?: Ref<HTMLElement>
  onHandlePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onHandleKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
  /** The section's frames, placed relative to it, so moving the section moves them with it. */
  children: ReactNode
}

/**
 * The box around one screen's states, with the screen's name above it. The name keeps one size on
 * screen at any zoom, the way a frame title does. When the section can be moved the name is its
 * handle: drag it, or focus it and use the arrow keys.
 */
export function CanvasSectionBox({
  section,
  movable,
  sectionRef,
  onHandlePointerDown,
  onHandleKeyDown,
  children,
}: CanvasSectionBoxProps) {
  const states = section.frames.length
  const name = section.missing ? `“${section.screenId}”` : section.title

  const label = (
    <>
      <h2 className={cn('font-semibold text-base', section.missing && 'text-destructive')}>{name}</h2>
      {!section.missing && (
        <span className='text-muted-foreground text-xs'>
          {states} {states === 1 ? 'state' : 'states'}
        </span>
      )}
    </>
  )

  return (
    <section
      ref={sectionRef}
      aria-label={section.missing ? `Missing screen ${section.screenId}` : `Screen ${section.title}`}
      data-canvas-section={section.screenId}
      style={{ left: section.x, top: section.y, width: section.width, height: section.height }}
      className={cn(
        'pointer-events-none absolute rounded-xl border-2 border-dashed',
        section.missing ? 'border-destructive-border' : 'border-border bg-background/40'
      )}
    >
      {/* Above the box, growing upward into the gap between sections, so it never meets a frame title. */}
      <div
        className='absolute bottom-full left-2 mb-2 flex origin-bottom-left items-baseline gap-2 whitespace-nowrap'
        style={{ transform: 'scale(var(--canvas-label-scale, 1))' }}
      >
        {movable ? (
          <button
            type='button'
            {...{ [SECTION_HANDLE_ATTRIBUTE]: section.screenId }}
            aria-label={`Move the ${section.title} section`}
            aria-keyshortcuts='ArrowLeft ArrowRight ArrowUp ArrowDown'
            title='Drag to move the section, or use the arrow keys (Shift for a bigger step)'
            className='pointer-events-auto flex cursor-move touch-none items-baseline gap-2 rounded-md px-1 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring'
            onPointerDown={onHandlePointerDown}
            onKeyDown={onHandleKeyDown}
          >
            <GripVertical aria-hidden='true' className='size-4 shrink-0 self-center text-muted-foreground' />
            {label}
          </button>
        ) : (
          label
        )}
      </div>
      {children}
    </section>
  )
}
